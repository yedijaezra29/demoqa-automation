import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  unwatchFile,
  watchFile,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

import * as vscode from 'vscode';

import { reasons } from '../../report/failure-message.ts';
import { parseFeature, type ParsedScenario } from './gherkin';
import {
  RunReader,
  type RunListener,
  type Status,
  type StepResult,
} from './messages';
import { ORDER_FILE } from './order-plugin';
import { registerSuites, type ScenarioRef } from './suites';

const TC_TAG = /^@[A-Z][A-Z0-9]*-\d+(_\d+)?$/;
const SAFE_TAG = /^@[\w\-.]+$/;
const TAG_EXPRESSION = /^[@\w\-()\s]+$/;
const TAIL = 64;
const WINDOWS = process.platform === 'win32';
const FEATURES = 'features/**/*.feature';
const CHUNK = 4 * 1024 * 1024;
const FRAME = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?$/;
const INTERNAL_FRAME = /\(node:|at node:|node_modules[\\/]/;

interface Failure {
  text: string;
  stack?: string;
  range?: vscode.Range;
}

interface ItemInfo {
  tag?: string;
  filter?: string;
  featureTag?: string;
  names: string[];
}

export function activate(context: vscode.ExtensionContext): void {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }
  const root = folder.uri.fsPath;
  if (!existsSync(join(root, 'tests'))) {
    return;
  }
  void vscode.commands.executeCommand(
    'setContext',
    'demoqaTests.enabled',
    true,
  );
  const controller = vscode.tests.createTestController(
    'demoqaTests',
    'Demoqa Tests',
  );
  const info = new WeakMap<vscode.TestItem, ItemInfo>();
  const reporter = new Reporter(controller, root);
  let busyTerminal: vscode.Terminal | undefined;
  let ownTerminal: vscode.Terminal | undefined;
  let suiteOrder: string[] | undefined;

  const loadFile = (uri: vscode.Uri): void => {
    const path = relativePath(uri);
    const feature = parseFeature(readFileSync(uri.fsPath, 'utf8'));
    if (!feature) {
      controller.items.delete(path);
      return;
    }

    const featureItem = controller.createTestItem(path, feature.name, uri);
    featureItem.range = lineRange(feature.line);
    featureItem.description = path;
    info.set(featureItem, {
      tag: safeTag(feature.tags.at(-1)),
      featureTag: safeTag(feature.tags.at(-1)),
      names: feature.scenarios.map((scenario) => scenario.name),
    });
    featureItem.children.replace(
      feature.scenarios.map((scenario) =>
        scenarioItem(
          scenario,
          path,
          uri,
          safeTag(feature.tags.at(-1)),
          twinFilter(scenario, feature.scenarios),
        ),
      ),
    );
    controller.items.add(featureItem);
  };

  const scenarioItem = (
    scenario: ParsedScenario,
    path: string,
    uri: vscode.Uri,
    featureTag: string | undefined,
    filter: string | undefined,
  ): vscode.TestItem => {
    const id = `${path}:${scenario.line}`;
    const tag = scenario.tags.find((name) => TC_TAG.test(name));
    const item = controller.createTestItem(
      id,
      tag ? `${tag.slice(1)}  ${scenario.name}` : scenario.name,
      uri,
    );
    item.range = lineRange(scenario.line);
    info.set(item, {
      tag,
      filter,
      featureTag,
      names: [scenario.name],
    });
    item.children.replace(
      scenario.steps.map((step) => {
        const child = controller.createTestItem(
          `${id}:${step.line}`,
          step.text,
          uri,
        );
        child.range = lineRange(step.line);
        return child;
      }),
    );
    return item;
  };

  const loadAll = async (): Promise<void> => {
    const files = await vscode.workspace.findFiles(FEATURES);
    const paths = new Set(files.map(relativePath));
    controller.items.forEach((item) => {
      if (!paths.has(item.id)) {
        controller.items.delete(item.id);
      }
    });
    files.sort((a, b) => a.fsPath.localeCompare(b.fsPath)).forEach(loadFile);
  };

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(folder, FEATURES),
  );
  watcher.onDidCreate(loadFile);
  watcher.onDidChange(loadFile);
  watcher.onDidDelete((uri) => controller.items.delete(relativePath(uri)));

  const ended = vscode.window.onDidEndTerminalShellExecution((event) => {
    if (event.terminal === busyTerminal) {
      busyTerminal = undefined;
      setTimeout(() => reporter.finish(), 1000);
    }
  });
  const closed = vscode.window.onDidCloseTerminal((terminal) => {
    if (terminal === busyTerminal) {
      busyTerminal = undefined;
      reporter.finish();
    }
  });

  controller.refreshHandler = loadAll;

  const profile = controller.createRunProfile(
    'Jalankan',
    vscode.TestRunProfileKind.Run,
    async (request, token) => {
      const order = suiteOrder;
      suiteOrder = undefined;
      if (reporter.busy() || busyTerminal) {
        const answer = await vscode.window.showWarningMessage(
          'Masih ada run yang berjalan',
          {
            modal: true,
            detail:
              'Dua run bersamaan menulis ke reports/messages.ndjson yang sama. Tunggu run sebelumnya selesai atau hentikan dulu dengan tombol Stop.',
          },
          'Tetap jalankan',
        );
        if (answer !== 'Tetap jalankan') {
          return;
        }
        reporter.detach();
      }

      const selected: vscode.TestItem[] = [];
      for (const item of request.include ?? []) {
        const target = info.has(item) ? item : item.parent;
        if (target && !selected.includes(target)) {
          selected.push(target);
        }
      }

      const configured = vscode.workspace
        .getConfiguration('demoqaTests')
        .get<string>('runCommand', 'npm run test:raw');
      const command = WINDOWS
        ? configured.replace(/^npm(?=\s)/, 'npm.cmd')
        : configured;
      let line: string;
      if (selected.length > 0) {
        line = commandLine(
          selected.map((item) => info.get(item) as ItemInfo),
          command,
        );
      } else {
        const features: vscode.TestItem[] = [];
        controller.items.forEach((item) => features.push(item));
        const target = await pickTarget(features, info);
        if (!target) {
          return;
        }
        selected.push(...target.items);
        line = target.tags
          ? `${command} -- --tags ${shellQuote(target.tags)}`
          : commandLine(
              target.items.map((item) => info.get(item) as ItemInfo),
              command,
            );
      }

      if (order) {
        mkdirSync(dirname(join(root, ORDER_FILE)), { recursive: true });
        writeFileSync(join(root, ORDER_FILE), JSON.stringify({ order }));
        line += ` --plugin ${shellQuote(join(context.extensionPath, 'out', 'order-plugin.mjs'))}`;
      }

      await vscode.commands.executeCommand('testing.clearTestResults');
      const run = controller.createTestRun(request);
      enqueueScenarios(run, selected);
      if (!ownTerminal || ownTerminal.exitStatus) {
        ownTerminal = vscode.window.createTerminal({
          name: 'Demoqa Test',
          cwd: root,
          shellPath: WINDOWS
            ? 'powershell.exe'
            : existsSync('/bin/zsh')
              ? '/bin/zsh'
              : '/bin/bash',
          env: { TAGS: '' },
        });
      }
      const terminal = ownTerminal;
      const cwd = terminal.shellIntegration?.cwd?.fsPath;
      terminal.show(true);
      terminal.sendText(
        cwd === root
          ? line
          : WINDOWS
            ? `Set-Location -LiteralPath ${shellQuote(root)}; ${line}`
            : `cd ${shellQuote(root)} && ${line}`,
      );
      busyTerminal = terminal;

      await new Promise<void>((resolve) => {
        reporter.attach(run, resolve);
        token.onCancellationRequested(() => {
          terminal.sendText('\u0003', false);
          reporter.detach();
        });
      });
    },
    true,
  );

  const suites = registerSuites(context, root, {
    scenarios: () => {
      const refs: ScenarioRef[] = [];
      controller.items.forEach((feature) =>
        feature.children.forEach((item) => {
          const detail = info.get(item);
          if (detail) {
            refs.push({
              item,
              feature: feature.id,
              featureName: feature.label,
              name: detail.names[0],
              tag: detail.tag,
            });
          }
        }),
      );
      return refs.sort(
        (a, b) =>
          a.feature.localeCompare(b.feature) ||
          (a.item.range?.start.line ?? 0) - (b.item.range?.start.line ?? 0),
      );
    },
    run: async (items) => {
      suiteOrder = items.map((item) => item.id);
      const cancel = new vscode.CancellationTokenSource();
      await profile.runHandler(new vscode.TestRunRequest(items), cancel.token);
      cancel.dispose();
    },
  });
  watcher.onDidChange(() => suites.refresh());
  watcher.onDidCreate(() => suites.refresh());
  watcher.onDidDelete(() => suites.refresh());

  context.subscriptions.push(controller, watcher, reporter, ended, closed);
  void loadAll().then(() => {
    reporter.start();
    suites.refresh();
  });
}

export function deactivate(): void {}

interface PickItem extends vscode.QuickPickItem {
  kind?: vscode.QuickPickItemKind;
  target: 'tag' | 'all' | vscode.TestItem | undefined;
}

async function pickTarget(
  features: vscode.TestItem[],
  info: WeakMap<vscode.TestItem, ItemInfo>,
): Promise<{ tags?: string; items: vscode.TestItem[] } | undefined> {
  const picked = await vscode.window.showQuickPick<PickItem>(
    [
      {
        label: '$(tag) Berdasarkan tag…',
        detail: 'Contoh: @WEBTABLES-01 or @FORM-01, @droppable, not @resizable',
        target: 'tag',
      },
      {
        label: 'Feature',
        kind: vscode.QuickPickItemKind.Separator,
        target: undefined,
      },
      ...features.map((feature) => ({
        label: feature.label,
        description: `${info.get(feature)?.tag ?? ''}  ${feature.children.size} skenario`,
        target: feature,
      })),
      {
        label: '',
        kind: vscode.QuickPickItemKind.Separator,
        target: undefined,
      },
      {
        label: '$(run-all) Semua skenario',
        target: 'all',
      },
    ],
    {
      title: 'Jalankan skenario',
      placeHolder: 'Pilih tag atau feature yang mau dijalankan',
    },
  );

  if (!picked?.target) {
    return undefined;
  }
  if (picked.target === 'tag') {
    const tags = await vscode.window.showInputBox({
      title: 'Jalankan berdasarkan tag',
      prompt: 'Ekspresi tag Cucumber, dipakai sebagai TAGS',
      placeHolder: '@WEBTABLES-01 or @FORM-01',
      validateInput: (value) =>
        value.trim() === '' ||
        (TAG_EXPRESSION.test(value) && value.includes('@'))
          ? undefined
          : 'Isi dengan tag (@FORM-01), and, or, not, dan tanda kurung',
    });
    return tags?.trim() ? { tags: tags.trim(), items: [] } : undefined;
  }
  if (picked.target === 'all') {
    return { items: features };
  }
  return { items: [picked.target] };
}

function commandLine(details: ItemInfo[], command: string): string {
  if (details.every((detail) => detail.tag)) {
    return `${command} -- --tags ${shellQuote(details.map((detail) => detail.filter ?? detail.tag).join(' or '))}`;
  }
  const featureTags = [
    ...new Set(details.map((detail) => detail.featureTag).filter(Boolean)),
  ];
  const names = details
    .flatMap((detail) => detail.names)
    .map((name) => `--name ${shellQuote(namePattern(name))}`);
  const tags =
    featureTags.length > 0
      ? ` --tags ${shellQuote(featureTags.join(' or '))}`
      : '';
  return `${command} --${tags} ${names.join(' ')}`;
}

function twinFilter(
  scenario: ParsedScenario,
  scenarios: ParsedScenario[],
): string | undefined {
  const tag = scenario.tags.find((name) => TC_TAG.test(name));
  const twins = scenarios.filter(
    (other) => other !== scenario && tag && other.tags.includes(tag),
  );
  if (!tag || twins.length === 0) {
    return undefined;
  }
  const shared = new Set(twins.flatMap((other) => other.tags));
  const own = scenario.tags.filter(
    (name) => !shared.has(name) && SAFE_TAG.test(name),
  );
  const excluded = [...shared].filter(
    (name) =>
      !scenario.tags.includes(name) &&
      !TC_TAG.test(name) &&
      SAFE_TAG.test(name),
  );
  const parts = [
    tag,
    ...own,
    ...(own.length === 0 ? excluded.map((name) => `not ${name}`) : []),
  ];
  return parts.length > 1 ? `(${parts.join(' and ')})` : undefined;
}

function namePattern(name: string): string {
  const parts = name
    .split(/<[^>]+>/)
    .map((part) => part.replace(/[^\p{L}\p{N} _\-,:/]/gu, '.'));
  return `^${parts.join('.*')}$`;
}

function safeTag(tag: string | undefined): string | undefined {
  return tag && SAFE_TAG.test(tag) ? tag : undefined;
}

function shellQuote(text: string): string {
  return WINDOWS
    ? `'${text.replace(/['\u2018\u2019\u201a\u201b]/g, '$&$&')}'`
    : `'${text.replace(/'/g, `'\\''`)}'`;
}

function relativePath(uri: vscode.Uri): string {
  return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
}

const PROBLEM_STATUSES: Status[] = ['FAILED', 'UNDEFINED', 'AMBIGUOUS'];

function statusText(status: Status): string | undefined {
  return status === 'UNDEFINED'
    ? 'Step ini belum punya step definition'
    : status === 'AMBIGUOUS'
      ? 'Step ini cocok dengan lebih dari satu step definition'
      : undefined;
}

function failureText(message: string | undefined): string {
  return reasons(message).join('\n');
}

class Reporter implements RunListener, vscode.Disposable {
  private readonly file: string;
  private offset = 0;
  private tail = Buffer.alloc(0);
  private pending = '';
  private decoder = new StringDecoder('utf8');
  private reader: RunReader;
  private run: vscode.TestRun | undefined;
  private waiting: vscode.TestRun | undefined;
  private done: (() => void) | undefined;
  private readonly failures = new Map<string, Failure>();

  constructor(
    private readonly controller: vscode.TestController,
    root: string,
  ) {
    this.file = join(root, 'reports', 'messages.ndjson');
    this.reader = new RunReader(this);
  }

  start(): void {
    this.poll();
    watchFile(this.file, { interval: 300 }, () => this.poll());
  }

  busy(): boolean {
    return this.run !== undefined || this.waiting !== undefined;
  }

  attach(run: vscode.TestRun, done: () => void): void {
    this.waiting = run;
    this.done = done;
  }

  detach(): void {
    for (const run of [this.run, this.waiting]) {
      run?.end();
    }
    this.run = undefined;
    this.waiting = undefined;
    this.done?.();
    this.done = undefined;
  }

  finish(): void {
    this.poll();
    if (this.busy() || this.done) {
      this.detach();
    }
  }

  dispose(): void {
    unwatchFile(this.file);
    this.detach();
  }

  runStarted(): void {
    this.run?.end();
    this.run =
      this.waiting ??
      this.controller.createTestRun(
        new vscode.TestRunRequest(),
        'Run dari terminal',
        false,
      );
    this.waiting = undefined;
  }

  caseQueued(scenario: string): void {
    const item = this.item(scenario);
    if (item && this.run) {
      this.run.enqueued(item);
    }
  }

  caseStarted(scenario: string): void {
    const item = this.item(scenario);
    if (item && this.run) {
      this.run.started(item);
      this.failures.delete(item.id);
    }
  }

  stepFinished(result: StepResult): void {
    const scenario = this.item(result.scenario);
    if (
      !scenario ||
      !this.run ||
      !PROBLEM_STATUSES.includes(result.status) ||
      this.failures.has(scenario.id)
    ) {
      return;
    }

    const step = result.step ? scenario.children.get(result.step) : undefined;
    const reason = statusText(result.status) ?? failureText(result.message);
    const text = result.hook ? `${result.hook}: ${reason}` : reason;

    this.output(
      step ? `${scenario.label} › ${step.label}` : scenario.label,
      text,
      result.stack,
    );
    this.failures.set(scenario.id, {
      text,
      stack: result.stack,
      range: step?.range ?? scenario.range,
    });
  }

  caseFinished(
    scenario: string,
    status: Status,
    duration: number,
    willBeRetried: boolean,
  ): void {
    const item = this.item(scenario);
    if (item && this.run && !willBeRetried) {
      this.mark(item, status, duration, this.failures.get(item.id));
    }
  }

  runFinished(): void {
    this.run?.end();
    this.run = undefined;
    this.done?.();
    this.done = undefined;
  }

  private mark(
    item: vscode.TestItem,
    status: Status,
    duration: number,
    failure: Failure | undefined,
  ): void {
    const run = this.run;
    if (!run) {
      return;
    }
    if (status === 'PASSED') {
      run.passed(item, duration);
    } else if (status === 'SKIPPED' || status === 'PENDING') {
      run.skipped(item);
    } else {
      const text =
        failure?.text ?? statusText(status) ?? failureText(undefined);
      const message = new vscode.TestMessage(text);
      const range = failure?.range ?? item.range;
      if (item.uri && range) {
        message.location = new vscode.Location(item.uri, range);
      }
      message.stackTrace = stackFrames(failure?.stack);
      run.failed(item, message, duration);
    }
  }

  private output(title: string, text: string, stack: string | undefined): void {
    const frames = (stack ?? '')
      .split('\n')
      .filter((line) => FRAME.test(line) && !INTERNAL_FRAME.test(line));
    this.run?.appendOutput(
      [title, text, ...frames, ''].join('\n').replace(/\n/g, '\r\n'),
    );
  }

  private item(id: string): vscode.TestItem | undefined {
    const feature = this.controller.items.get(id.replace(/:\d+$/, ''));
    return feature?.children.get(id);
  }

  private poll(): void {
    if (!existsSync(this.file)) {
      return;
    }
    let fd: number | undefined;
    try {
      fd = openSync(this.file, 'r');
      const size = fstatSync(fd).size;
      if (size < this.offset || !this.sameTail(fd)) {
        this.reset();
      }
      const buffer = Buffer.alloc(Math.min(CHUNK, size - this.offset));
      while (this.offset < size) {
        const length = readSync(
          fd,
          buffer,
          0,
          Math.min(buffer.length, size - this.offset),
          this.offset,
        );
        if (length === 0) {
          break;
        }
        const bytes = buffer.subarray(0, length);
        this.offset += length;
        this.tail = Buffer.concat([this.tail, bytes]).subarray(-TAIL);
        this.consume(this.decoder.write(bytes));
      }
    } catch {
      return;
    } finally {
      if (fd !== undefined) {
        closeSync(fd);
      }
    }
  }

  private consume(text: string): void {
    const lines = (this.pending + text).split('\n');
    this.pending = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '' || line.startsWith('{"attachment"')) {
        continue;
      }
      try {
        this.reader.read(line);
      } catch {
        continue;
      }
    }
  }

  private sameTail(fd: number): boolean {
    if (this.tail.length === 0) {
      return true;
    }
    const current = Buffer.alloc(this.tail.length);
    readSync(fd, current, 0, current.length, this.offset - this.tail.length);
    return current.equals(this.tail);
  }

  private reset(): void {
    this.offset = 0;
    this.tail = Buffer.alloc(0);
    this.pending = '';
    this.decoder = new StringDecoder('utf8');
    this.failures.clear();
    this.run?.end();
    this.run = undefined;
    this.reader = new RunReader(this);
  }
}

function enqueueScenarios(run: vscode.TestRun, items: vscode.TestItem[]): void {
  for (const item of items) {
    if (item.parent) {
      run.enqueued(item);
    } else {
      item.children.forEach((scenario) => run.enqueued(scenario));
    }
  }
}

function lineRange(line: number): vscode.Range {
  return new vscode.Range(line - 1, 0, line - 1, 0);
}

function stackFrames(
  stack: string | undefined,
): vscode.TestMessageStackFrame[] {
  return (stack ?? '')
    .split('\n')
    .filter((line) => !INTERNAL_FRAME.test(line))
    .flatMap((line) => {
      const match = FRAME.exec(line);
      if (!match) {
        return [];
      }
      const [, name, file, row, column] = match;
      return [
        new vscode.TestMessageStackFrame(
          `${name?.replace(/^async /, '') ?? basename(file)}  ${basename(file)}:${row}`,
          vscode.Uri.file(file),
          new vscode.Position(Number(row) - 1, Number(column) - 1),
        ),
      ];
    });
}
