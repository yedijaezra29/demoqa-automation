import { isAbsolute, relative } from 'node:path';
import type { WriteStream } from 'node:tty';

import { Formatter, type IFormatterOptions } from '@cucumber/cucumber';
import {
  type Envelope,
  type GherkinDocument,
  type Hook,
  type Pickle,
  type StepDefinition,
  type TestCase,
  type TestCaseFinished,
  type TestCaseStarted,
  type TestStepFinished,
  type Timestamp,
  TestStepResultStatus,
} from '@cucumber/messages';

import { reasons } from './failure-message.ts';

const STATUS_RANK: Record<TestStepResultStatus, number> = {
  [TestStepResultStatus.UNKNOWN]: 0,
  [TestStepResultStatus.PASSED]: 1,
  [TestStepResultStatus.SKIPPED]: 2,
  [TestStepResultStatus.PENDING]: 3,
  [TestStepResultStatus.UNDEFINED]: 4,
  [TestStepResultStatus.AMBIGUOUS]: 5,
  [TestStepResultStatus.FAILED]: 6,
};

const STATUS_LABEL: Record<TestStepResultStatus, string> = {
  [TestStepResultStatus.UNKNOWN]: 'TIDAK DIKETAHUI',
  [TestStepResultStatus.PASSED]: 'LOLOS',
  [TestStepResultStatus.SKIPPED]: 'DILEWATI',
  [TestStepResultStatus.PENDING]: 'BELUM DIBUAT',
  [TestStepResultStatus.UNDEFINED]: 'STEP BELUM ADA',
  [TestStepResultStatus.AMBIGUOUS]: 'STEP GANDA',
  [TestStepResultStatus.FAILED]: 'GAGAL',
};

const STEP_ICON: Record<TestStepResultStatus, string> = {
  [TestStepResultStatus.UNKNOWN]: '?',
  [TestStepResultStatus.PASSED]: '✔',
  [TestStepResultStatus.SKIPPED]: '○',
  [TestStepResultStatus.PENDING]: '…',
  [TestStepResultStatus.UNDEFINED]: '?',
  [TestStepResultStatus.AMBIGUOUS]: '‼',
  [TestStepResultStatus.FAILED]: '✘',
};

const TC_TAG = /^@[A-Z][A-Z0-9]*-\d+(_\d+)?$/;
const STACK_FRAME = /\(?((?:\/|[A-Za-z]:\\)[^():]+):(\d+):\d+\)?$/;

interface CaseState {
  testCase: TestCase;
  pickle: Pickle;
  status: TestStepResultStatus;
  startedAt: number;
  number: number;
  attempt: number;
  lines: string[];
}

interface Failure {
  tc: string;
  name: string;
  location: string;
}

export default class ProgressFormatter extends Formatter {
  static readonly documentation =
    'Progress per skenario dan step dalam bahasa biasa, dengan lokasi gagal yang bisa di-cmd+klik di VS Code';

  private readonly stepLines = new Map<string, number>();
  private readonly stepKeywords = new Map<string, string>();
  private readonly scenarioLines = new Map<string, number>();
  private readonly pickles = new Map<string, Pickle>();
  private readonly testCases = new Map<string, TestCase>();
  private readonly hooks = new Map<string, Hook>();
  private readonly stepDefinitions = new Map<string, StepDefinition>();
  private readonly running = new Map<string, CaseState>();
  private readonly failures: Failure[] = [];
  private readonly totals = new Map<TestStepResultStatus, number>();
  private started = 0;
  private runStartedAt = 0;

  private readonly colored: boolean;
  private readonly detail = process.env.PROGRESS === 'detail';
  private readonly live: boolean;

  constructor(options: IFormatterOptions) {
    super(options);
    this.colored = this.colorFns.location('x') !== 'x';
    this.live =
      !this.detail && (this.stream as WriteStream | undefined)?.isTTY === true;
    options.eventBroadcaster.on('envelope', (envelope: Envelope) =>
      this.onEnvelope(envelope),
    );
  }

  private onEnvelope(envelope: Envelope): void {
    if (envelope.gherkinDocument) {
      this.indexSteps(envelope.gherkinDocument);
    } else if (envelope.pickle) {
      this.pickles.set(envelope.pickle.id, envelope.pickle);
    } else if (envelope.hook) {
      this.hooks.set(envelope.hook.id, envelope.hook);
    } else if (envelope.stepDefinition) {
      this.stepDefinitions.set(
        envelope.stepDefinition.id,
        envelope.stepDefinition,
      );
    } else if (envelope.testCase) {
      this.testCases.set(envelope.testCase.id, envelope.testCase);
    } else if (envelope.testRunStarted) {
      this.runStartedAt = this.millis(envelope.testRunStarted.timestamp);
    } else if (envelope.testCaseStarted) {
      this.onCaseStarted(envelope.testCaseStarted);
    } else if (envelope.testStepFinished) {
      this.onStepFinished(envelope.testStepFinished);
    } else if (envelope.testCaseFinished) {
      this.onCaseFinished(envelope.testCaseFinished);
    } else if (envelope.testRunFinished) {
      this.onRunFinished(envelope.testRunFinished.timestamp);
    }
  }

  private indexSteps(document: GherkinDocument): void {
    for (const child of document.feature?.children ?? []) {
      const scenarios = [
        child.background,
        child.scenario,
        ...(child.rule?.children ?? []).flatMap((ruleChild) => [
          ruleChild.background,
          ruleChild.scenario,
        ]),
      ];
      for (const scenario of scenarios) {
        for (const step of scenario?.steps ?? []) {
          this.stepLines.set(step.id, step.location.line);
          this.stepKeywords.set(step.id, step.keyword.trim());
        }
        if (scenario && 'examples' in scenario) {
          this.scenarioLines.set(scenario.id, scenario.location.line);
          for (const row of scenario.examples.flatMap(
            (examples) => examples.tableBody,
          )) {
            this.scenarioLines.set(row.id, row.location.line);
          }
        }
      }
    }
  }

  private onCaseStarted(started: TestCaseStarted): void {
    const testCase = this.testCases.get(started.testCaseId);
    const pickle = testCase && this.pickles.get(testCase.pickleId);

    if (!testCase || !pickle) {
      return;
    }

    const retry = started.attempt > 0;
    if (!retry) {
      this.started += 1;
    }
    this.running.set(started.id, {
      testCase,
      pickle,
      status: TestStepResultStatus.PASSED,
      startedAt: this.millis(started.timestamp),
      number: this.started,
      attempt: started.attempt,
      lines: [],
    });

    if (this.detail) {
      this.log(
        `\n${this.colorFns.tag(`▶ ${this.counter(this.started)}`)} ${this.title(pickle, started.attempt)}\n`,
      );
    } else if (this.live) {
      const tc = this.tcTag(pickle);
      const text = `▶ ${this.counter(this.started)} ${tc ? `${tc}  ` : ''}${pickle.name}`;
      const width = ((this.stream as WriteStream).columns ?? 80) - 1;
      this.log(
        this.dim(text.length > width ? `${text.slice(0, width - 1)}…` : text),
      );
    }
  }

  private onStepFinished(finished: TestStepFinished): void {
    const state = this.running.get(finished.testCaseStartedId);
    const step = state?.testCase.testSteps.find(
      (testStep) => testStep.id === finished.testStepId,
    );

    if (!state || !step) {
      return;
    }

    const { status, message } = finished.testStepResult;
    const seconds = this.dim(this.seconds(finished.testStepResult.duration));
    const color = this.colorFns.forStatus(status);

    if (STATUS_RANK[status] > STATUS_RANK[state.status]) {
      state.status = status;
    }

    if (step.hookId) {
      if (status === TestStepResultStatus.FAILED) {
        const hook = this.hooks.get(step.hookId);
        this.write(
          state,
          `  ${color(STEP_ICON[status])} ${hook?.name ?? 'Hook'}  ${seconds}\n`,
        );
        this.logProblem(
          state,
          message,
          `${this.path(state.pickle.uri)}:${this.scenarioLine(state.pickle)}`,
          undefined,
          this.hookLocation(hook),
        );
      }
      return;
    }

    const pickleStep = state.pickle.steps.find(
      (candidate) => candidate.id === step.pickleStepId,
    );
    const text = pickleStep?.text ?? '';
    const keyword =
      (pickleStep && this.stepKeywords.get(pickleStep.astNodeIds[0])) ?? '';
    const featureLine =
      pickleStep && this.stepLines.get(pickleStep.astNodeIds[0]);
    const featureLocation = featureLine
      ? `${this.path(state.pickle.uri)}:${featureLine}`
      : this.path(state.pickle.uri);

    if (status === TestStepResultStatus.SKIPPED) {
      this.write(
        state,
        `  ${this.dim(`${STEP_ICON[status]} ${keyword} ${text}  tidak dijalankan`)}\n`,
      );
      return;
    }

    const line =
      status === TestStepResultStatus.PASSED
        ? `${this.dim(keyword)} ${text}`
        : color(`${keyword} ${text}`);
    this.write(state, `  ${color(STEP_ICON[status])} ${line}  ${seconds}\n`);

    if (status === TestStepResultStatus.UNDEFINED) {
      this.logDetail(
        state,
        'Step ini belum punya step definition',
        featureLocation,
      );
    } else if (status === TestStepResultStatus.AMBIGUOUS) {
      this.logDetail(
        state,
        'Step ini cocok dengan lebih dari satu step definition',
        featureLocation,
      );
    } else if (status === TestStepResultStatus.FAILED) {
      this.logProblem(
        state,
        message,
        featureLocation,
        step.stepDefinitionIds?.[0],
      );
    }
  }

  private onCaseFinished(finished: TestCaseFinished): void {
    const state = this.running.get(finished.testCaseStartedId);

    if (!state) {
      return;
    }
    this.running.delete(finished.testCaseStartedId);

    const duration = this.seconds({
      seconds: (this.millis(finished.timestamp) - state.startedAt) / 1000,
      nanos: 0,
    });
    const color = this.colorFns.forStatus(state.status);
    const label = finished.willBeRetried
      ? `${STATUS_LABEL[state.status]}, akan diulang`
      : this.bold(STATUS_LABEL[state.status]);

    if (this.detail) {
      this.log(`  ${color(label)}  ${this.dim(duration)}\n`);
    } else {
      const problem =
        STATUS_RANK[state.status] > STATUS_RANK[TestStepResultStatus.SKIPPED];
      this.log(
        `${this.live ? '\r\u001b[2K' : ''}${color(STEP_ICON[state.status])} ${this.dim(this.counter(state.number))} ${this.title(state.pickle, state.attempt)}  ${this.dim(duration)}${finished.willBeRetried ? `  ${color('akan diulang')}` : ''}\n`,
      );
      if (problem) {
        this.log(state.lines.join(''));
      }
    }

    if (finished.willBeRetried) {
      return;
    }
    this.totals.set(state.status, (this.totals.get(state.status) ?? 0) + 1);

    if (STATUS_RANK[state.status] > STATUS_RANK[TestStepResultStatus.SKIPPED]) {
      this.failures.push({
        tc: this.tcTag(state.pickle) ?? '',
        name: state.pickle.name,
        location: `${this.path(state.pickle.uri)}:${this.scenarioLine(state.pickle)}`,
      });
    }
  }

  private onRunFinished(timestamp: Timestamp): void {
    const elapsed = this.millis(timestamp) - this.runStartedAt;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.round((elapsed % 60000) / 1000);
    const counts = [...this.totals.entries()]
      .sort(([a], [b]) => STATUS_RANK[a] - STATUS_RANK[b])
      .map(([status, count]) =>
        this.colorFns.forStatus(status)(`${count} ${STATUS_LABEL[status]}`),
      )
      .join(', ');
    const total = [...this.totals.values()].reduce(
      (sum, count) => sum + count,
      0,
    );

    this.log(`\n${'─'.repeat(60)}\n`);
    this.log(
      `Selesai: ${total} skenario dalam ${minutes} mnt ${seconds} dtk. ${counts}\n`,
    );

    if (this.failures.length > 0) {
      this.log('\nYang perlu dicek:\n');
      for (const failure of this.failures) {
        this.log(
          `  ${this.colorFns.forStatus(TestStepResultStatus.FAILED)('✘')} ${failure.tc ? `${this.bold(failure.tc)}  ` : ''}${failure.name}\n      ${this.colorFns.location(failure.location)}\n`,
        );
      }
    }
  }

  private write(state: CaseState, text: string): void {
    if (this.detail) {
      this.log(text);
    } else {
      state.lines.push(text);
    }
  }

  private label(name: string): string {
    return name.padEnd(12);
  }

  private counter(number: number): string {
    return `[${number}/${this.testCases.size}]`;
  }

  private title(pickle: Pickle, attempt: number): string {
    const tc = this.tcTag(pickle);
    return `${tc ? `${this.bold(tc)}  ` : ''}${pickle.name}${attempt > 0 ? this.dim(` (ulang ke-${attempt})`) : ''}`;
  }

  private logProblem(
    state: CaseState,
    message: string | undefined,
    location: string | undefined,
    stepDefinitionId?: string,
    hookLocation?: string,
  ): void {
    const failed = this.colorFns.forStatus(TestStepResultStatus.FAILED);
    const passed = this.colorFns.forStatus(TestStepResultStatus.PASSED);
    const [headline, ...details] = reasons(message);
    this.write(state, `      ${failed(headline)}\n`);
    for (const detail of details) {
      const [, label, value] = /^(\w+:)\s+(.*)$/s.exec(detail) ?? [];
      const paint =
        label === 'Seharusnya:'
          ? passed
          : label === 'Tertulis:'
            ? failed
            : (text: string) => this.dim(text);
      this.write(
        state,
        value === undefined
          ? `      ${this.dim(detail)}\n`
          : `      ${this.label(label)}${paint(value)}\n`,
      );
    }
    if (location) {
      this.write(
        state,
        `      ${this.label('Skenario:')}${this.colorFns.location(location)}\n`,
      );
    }

    const code = this.codeLocation(message);
    const definition =
      stepDefinitionId && this.stepDefinitions.get(stepDefinitionId);
    const step =
      definition &&
      definition.sourceReference.uri &&
      `${this.path(definition.sourceReference.uri)}:${definition.sourceReference.location?.line ?? 1}`;

    if (code) {
      this.write(
        state,
        `      ${this.label('Kode:')}${this.colorFns.location(code)}\n`,
      );
    }
    if (step && step !== code) {
      this.write(
        state,
        `      ${this.label('Step:')}${this.colorFns.location(step)}\n`,
      );
    }
    if (hookLocation && hookLocation !== code) {
      this.write(
        state,
        `      ${this.label('Hook:')}${this.colorFns.location(hookLocation)}\n`,
      );
    }
  }

  private logDetail(state: CaseState, reason: string, location: string): void {
    this.write(
      state,
      `      ${reason}\n      ${this.label('Skenario:')}${this.colorFns.location(location)}\n`,
    );
  }

  private codeLocation(message: string | undefined): string | undefined {
    for (const line of message?.split('\n') ?? []) {
      const frame = STACK_FRAME.exec(line.trim());
      if (!frame) {
        continue;
      }
      const file = this.path(frame[1]);
      // Skip the shared core layer so Kode points at the page object that made the call.
      if (
        !file.startsWith('.') &&
        !file.includes('node_modules') &&
        !file.startsWith('src/core/')
      ) {
        return `${file}:${frame[2]}`;
      }
    }
    return undefined;
  }

  private hookLocation(hook: Hook | undefined): string | undefined {
    const uri = hook?.sourceReference.uri;
    return uri
      ? `${this.path(uri)}:${hook.sourceReference.location?.line ?? 1}`
      : undefined;
  }

  private scenarioLine(pickle: Pickle): number {
    const lines = pickle.astNodeIds
      .map((id) => this.scenarioLines.get(id))
      .filter((line): line is number => line !== undefined);
    return lines.at(-1) ?? 1;
  }

  private tcTag(pickle: Pickle): string | undefined {
    return pickle.tags
      .map((tag) => tag.name)
      .find((name) => TC_TAG.test(name))
      ?.slice(1);
  }

  private path(file: string): string {
    return (isAbsolute(file) ? relative(this.cwd, file) : file).replace(
      /\\/g,
      '/',
    );
  }

  private seconds(duration: { seconds: number; nanos: number }): string {
    const total = duration.seconds + duration.nanos / 1e9;
    return `${total.toFixed(1).replace('.', ',')} dtk`;
  }

  private millis(timestamp: Timestamp): number {
    return timestamp.seconds * 1000 + timestamp.nanos / 1e6;
  }

  private bold(text: string): string {
    return this.colored ? `\u001b[1m${text}\u001b[22m` : text;
  }

  private dim(text: string): string {
    return this.colored ? `\u001b[2m${text}\u001b[22m` : text;
  }
}
