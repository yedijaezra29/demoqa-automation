import { sep } from 'node:path';

import {
  toMillis,
  type Attachment,
  type Envelope,
  type FeatureChild,
  type GherkinDocument,
  type Hook,
  type Meta,
  type Pickle,
  type StepResult,
  type TestCase,
} from './messages.ts';
import type { RunInfo } from './run-info.ts';

const REPORT_TITLE = 'demoqa Automation';
const APPLICATION_NAME = 'demoqa.com';

const SEVERITY = [
  'FAILED',
  'AMBIGUOUS',
  'UNDEFINED',
  'PENDING',
  'SKIPPED',
  'UNKNOWN',
  'PASSED',
];
const FAILED_STATUSES = ['FAILED', 'AMBIGUOUS', 'UNDEFINED'];
const SKIPPED_STATUSES = ['SKIPPED', 'PENDING', 'UNKNOWN'];
const CUCUMBER_LOG = 'text/x.cucumber.log+plain';
const STATUS_MESSAGES: Record<string, string> = {
  UNDEFINED: 'No step definition matches this step.',
  AMBIGUOUS: 'More than one step definition matches this step.',
};

interface LogLine {
  level: string;
  message: string;
  time: number;
}

interface Screenshot {
  id: string;
  name: string;
  time: number;
}

export const FAILURE_SCREENSHOT = 'Gagal';

interface ReportStep {
  index: number;
  kind: 'HOOK' | 'STEP';
  keyword: string;
  name: string;
  background: boolean;
  status: string;
  startTime: number;
  durationMs: number;
  message: string;
  stackTrace: string;
  logs: LogLine[];
  screenshots: Screenshot[];
}

interface ReportCase {
  code: string;
  name: string;
  description: string;
  feature: string;
  location: string;
  tags: string[];
  status: string;
  attempts: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  message: string;
  failedStep: string;
  stepCount: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  steps: ReportStep[];
}

interface Anomaly {
  level: 'FAILED' | 'ERROR' | 'WARNING';
  message: string;
  stackTrace: string;
  testCase: string;
  caseIndex: number;
  step: string;
  time: number;
  occurrences: number;
}

export interface ReportPayload {
  title: string;
  application: string;
  generatedAt: number;
  run: {
    startTime: number;
    endTime: number;
    durationMs: number;
    success: boolean;
    tags: string;
  };
  environment: Record<string, string>;
  features: string[];
  summary: Record<string, number>;
  testCases: ReportCase[];
  screenshots: (Screenshot & {
    testCase: string;
    code: string;
    caseIndex: number;
    step: string;
    status: string;
  })[];
  anomalies: Anomaly[];
  assets: Record<string, string>;
}

interface StepRun {
  start: number;
  result?: StepResult;
  attachments: Attachment[];
}

interface CaseRun {
  id: string;
  testCaseId: string;
  attempt: number;
  start: number;
  end: number;
  willBeRetried: boolean;
  steps: Map<string, StepRun>;
}

interface StepSource {
  keyword: string;
  background: boolean;
}

export function buildPayload(
  envelopes: Envelope[],
  runInfo: Partial<RunInfo>,
  playwrightVersion: string,
): ReportPayload {
  const index = new MessageIndex(envelopes);
  const assets = new AssetStore();
  const anomalies: Anomaly[] = [];

  const finalRuns = index.caseRuns
    .filter((run) => !run.willBeRetried)
    .sort((a, b) => a.start - b.start);

  const testCases = finalRuns.map((run, position) =>
    describeCase(index, assets, run, position),
  );

  testCases.forEach((item, caseIndex) =>
    anomalies.push(...caseAnomalies(item, caseIndex)),
  );
  anomalies.push(...retryAnomalies(index, testCases, finalRuns));
  anomalies.push(...index.runHookFailures);

  const screenshots = testCases.flatMap((item, caseIndex) =>
    item.steps.flatMap((step) =>
      step.screenshots.map((shot) => ({
        ...shot,
        testCase: item.name,
        code: item.code,
        caseIndex,
        step: stepLabel(step),
        status: step.status,
      })),
    ),
  );

  const features = [...new Set(testCases.map((item) => item.feature))];
  const startTime = index.runStarted || finalRuns[0]?.start || 0;
  const endTime =
    index.runFinished || Math.max(0, ...testCases.map((item) => item.endTime));

  return {
    title: REPORT_TITLE,
    application: APPLICATION_NAME,
    generatedAt: Date.now(),
    run: {
      startTime,
      endTime,
      durationMs: Math.max(0, endTime - startTime),
      success:
        index.runSuccess ??
        testCases.every((item) => !FAILED_STATUSES.includes(item.status)),
      tags: runInfo.tags ?? '',
    },
    environment: describeEnvironment(index.meta, runInfo, playwrightVersion),
    features,
    summary: summarize(testCases, endTime - startTime),
    testCases,
    screenshots,
    anomalies: collapse(anomalies),
    assets: assets.entries,
  };
}

class MessageIndex {
  meta?: Meta;
  runStarted = 0;
  runFinished = 0;
  runSuccess?: boolean;
  documents = new Map<string, GherkinDocument>();
  pickles = new Map<string, Pickle>();
  hooks = new Map<string, Hook>();
  testCases = new Map<string, TestCase>();
  stepSources = new Map<string, StepSource>();
  nodeLines = new Map<string, number>();
  descriptions = new Map<string, string>();
  exampleValues = new Map<string, Record<string, string>>();
  caseRuns: CaseRun[] = [];
  runHookFailures: Anomaly[] = [];

  private runsById = new Map<string, CaseRun>();
  private runHooks = new Map<string, { hookId: string; start: number }>();

  constructor(envelopes: Envelope[]) {
    envelopes.forEach((envelope) => this.consume(envelope));
  }

  private consume(envelope: Envelope): void {
    if (envelope.meta) {
      this.meta = envelope.meta;
    }
    if (envelope.gherkinDocument) {
      this.indexDocument(envelope.gherkinDocument);
    }
    if (envelope.pickle) {
      this.pickles.set(envelope.pickle.id, envelope.pickle);
    }
    if (envelope.hook) {
      this.hooks.set(envelope.hook.id, envelope.hook);
    }
    if (envelope.testCase) {
      this.testCases.set(envelope.testCase.id, envelope.testCase);
    }
    if (envelope.testRunStarted) {
      this.runStarted = toMillis(envelope.testRunStarted.timestamp);
    }
    if (envelope.testRunFinished) {
      this.runFinished = toMillis(envelope.testRunFinished.timestamp);
      this.runSuccess = envelope.testRunFinished.success;
    }

    const started = envelope.testCaseStarted;
    if (started) {
      const run: CaseRun = {
        id: started.id,
        testCaseId: started.testCaseId,
        attempt: started.attempt,
        start: toMillis(started.timestamp),
        end: 0,
        willBeRetried: false,
        steps: new Map(),
      };
      this.runsById.set(run.id, run);
      this.caseRuns.push(run);
    }

    const finished = envelope.testCaseFinished;
    if (finished) {
      const run = this.runsById.get(finished.testCaseStartedId);
      if (run) {
        run.end = toMillis(finished.timestamp);
        run.willBeRetried = finished.willBeRetried;
      }
    }

    const stepStarted = envelope.testStepStarted;
    if (stepStarted) {
      this.stepRun(
        stepStarted.testCaseStartedId,
        stepStarted.testStepId,
      ).start = toMillis(stepStarted.timestamp);
    }

    const stepFinished = envelope.testStepFinished;
    if (stepFinished) {
      this.stepRun(
        stepFinished.testCaseStartedId,
        stepFinished.testStepId,
      ).result = stepFinished.testStepResult;
    }

    const attachment = envelope.attachment;
    if (attachment?.testCaseStartedId && attachment.testStepId) {
      this.stepRun(
        attachment.testCaseStartedId,
        attachment.testStepId,
      ).attachments.push(attachment);
    }

    if (envelope.testRunHookStarted) {
      this.runHooks.set(envelope.testRunHookStarted.id, {
        hookId: envelope.testRunHookStarted.hookId,
        start: toMillis(envelope.testRunHookStarted.timestamp),
      });
    }

    const runHook = envelope.testRunHookFinished;
    if (runHook && FAILED_STATUSES.includes(runHook.result.status)) {
      const started = this.runHooks.get(runHook.testRunHookStartedId);
      const hook = started ? this.hooks.get(started.hookId) : undefined;
      const error = describeError(runHook.result);
      this.runHookFailures.push({
        level: 'FAILED',
        message: error.message || 'Test run hook failed',
        stackTrace: error.stackTrace,
        testCase: 'Test run',
        caseIndex: -1,
        step: `${hookPhase(hook) ?? 'Run'} hook: ${hookName(hook)}`,
        time: started?.start ?? toMillis(runHook.timestamp),
        occurrences: 1,
      });
    }
  }

  private stepRun(caseRunId: string, stepId: string): StepRun {
    const run = this.runsById.get(caseRunId);
    if (!run) {
      return { start: 0, attachments: [] };
    }

    let step = run.steps.get(stepId);
    if (!step) {
      step = { start: 0, attachments: [] };
      run.steps.set(stepId, step);
    }
    return step;
  }

  private indexDocument(document: GherkinDocument): void {
    this.documents.set(document.uri, document);
    const visit = (children: FeatureChild[]): void => {
      children.forEach((child) => {
        child.background?.steps.forEach((step) =>
          this.stepSources.set(step.id, {
            keyword: step.keyword,
            background: true,
          }),
        );
        if (child.scenario) {
          this.nodeLines.set(child.scenario.id, child.scenario.location.line);
          this.descriptions.set(
            child.scenario.id,
            dedent(child.scenario.description ?? ''),
          );
          child.scenario.steps.forEach((step) =>
            this.stepSources.set(step.id, {
              keyword: step.keyword,
              background: false,
            }),
          );
          child.scenario.examples?.forEach((examples) =>
            examples.tableBody.forEach((row) => {
              this.nodeLines.set(row.id, row.location.line);
              this.exampleValues.set(
                row.id,
                Object.fromEntries(
                  row.cells.map((cell, column) => [
                    examples.tableHeader?.cells[column]?.value ?? '',
                    cell.value,
                  ]),
                ),
              );
            }),
          );
        }
        if (child.rule) {
          visit(child.rule.children);
        }
      });
    };
    visit(document.feature?.children ?? []);
  }
}

function describeCase(
  index: MessageIndex,
  assets: AssetStore,
  run: CaseRun,
  position: number,
): ReportCase {
  const testCase = index.testCases.get(run.testCaseId);
  const pickle = testCase ? index.pickles.get(testCase.pickleId) : undefined;
  const feature = pickle
    ? index.documents.get(pickle.uri)?.feature?.name
    : undefined;
  const tags = pickle?.tags.map((tag) => tag.name) ?? [];
  const lastNode = pickle?.astNodeIds[pickle.astNodeIds.length - 1] ?? '';
  const line = index.nodeLines.get(lastNode);

  const testSteps = testCase?.testSteps ?? [];
  const firstStep = testSteps.findIndex((step) => step.pickleStepId);

  const steps = testSteps.map((testStep, position) => {
    const stepRun = run.steps.get(testStep.id);
    const result = stepRun?.result;
    const error = describeError(result);
    const logs: LogLine[] = [];
    const screenshots: Screenshot[] = [];

    stepRun?.attachments.forEach((attachment) => {
      const time = toMillis(attachment.timestamp) || stepRun.start;
      if (attachment.mediaType.startsWith('image/')) {
        screenshots.push({
          id: assets.add(attachment),
          name: attachment.fileName ?? 'Screenshot',
          time,
        });
      } else {
        logs.push({
          level: 'INFO',
          message: describeAttachment(attachment),
          time,
        });
      }
    });

    const base = {
      index: position + 1,
      status: result?.status ?? 'SKIPPED',
      startTime: stepRun?.start ?? 0,
      durationMs: result ? toMillis(result.duration) : 0,
      message: error.message,
      stackTrace: error.stackTrace,
      logs,
      screenshots,
    };

    if (testStep.hookId) {
      const hook = index.hooks.get(testStep.hookId);
      const phase =
        hookPhase(hook) ??
        (firstStep >= 0 && position > firstStep ? 'After' : 'Before');
      return {
        ...base,
        kind: 'HOOK' as const,
        keyword: phase,
        name: hookName(hook),
        background: false,
      };
    }

    const pickleStep = pickle?.steps.find(
      (step) => step.id === testStep.pickleStepId,
    );
    const source = index.stepSources.get(pickleStep?.astNodeIds[0] ?? '');
    return {
      ...base,
      kind: 'STEP' as const,
      keyword: source?.keyword.trim() ?? '',
      name: pickleStep?.text ?? '',
      background: source?.background ?? false,
    };
  });

  const gherkinSteps = steps.filter((step) => step.kind === 'STEP');
  const status = worstStatus(steps.map((step) => step.status));
  const failing = steps.find(
    (step) => FAILED_STATUSES.includes(step.status) && step.message,
  );

  return {
    code: caseCode(tags, position),
    name: pickle?.name ?? run.testCaseId,
    description: fillPlaceholders(
      index.descriptions.get(pickle?.astNodeIds[0] ?? '') ?? '',
      index.exampleValues.get(lastNode),
    ),
    feature: feature ?? pickle?.uri ?? '-',
    location: pickle ? `${pickle.uri}${line ? `:${line}` : ''}` : '-',
    tags,
    status,
    attempts: run.attempt + 1,
    startTime: run.start,
    endTime: run.end,
    durationMs: Math.max(0, run.end - run.start),
    message: failing?.message ?? '',
    failedStep: failing ? stepLabel(failing) : '',
    stepCount: gherkinSteps.length,
    passedSteps: gherkinSteps.filter((step) => step.status === 'PASSED').length,
    failedSteps: gherkinSteps.filter((step) =>
      FAILED_STATUSES.includes(step.status),
    ).length,
    skippedSteps: gherkinSteps.filter((step) =>
      SKIPPED_STATUSES.includes(step.status),
    ).length,
    steps,
  };
}

function caseAnomalies(item: ReportCase, caseIndex: number): Anomaly[] {
  const found: Anomaly[] = [];
  const base = { testCase: item.name, caseIndex, occurrences: 1 };

  item.steps.forEach((step, position) => {
    const where = { ...base, step: stepLabel(step), time: step.startTime };

    if (step.status === 'FAILED') {
      found.push({
        ...where,
        level: 'FAILED',
        message: step.message || 'Step failed',
        stackTrace: step.stackTrace,
      });
    } else if (step.status === 'UNDEFINED') {
      found.push({
        ...where,
        level: 'ERROR',
        message: step.message,
        stackTrace: '',
      });
    } else if (step.status === 'AMBIGUOUS') {
      found.push({
        ...where,
        level: 'ERROR',
        message: step.message,
        stackTrace: step.stackTrace,
      });
    } else if (step.status === 'PENDING') {
      found.push({
        ...where,
        level: 'WARNING',
        message: 'Step is marked as pending.',
        stackTrace: '',
      });
    } else if (
      step.status === 'SKIPPED' &&
      step.kind === 'STEP' &&
      item.steps.slice(0, position).every((prior) => prior.status === 'PASSED')
    ) {
      found.push({
        ...where,
        level: 'WARNING',
        message: 'Scenario was skipped at this step.',
        stackTrace: '',
      });
    }
  });

  return found;
}

function retryAnomalies(
  index: MessageIndex,
  testCases: ReportCase[],
  finalRuns: CaseRun[],
): Anomaly[] {
  return index.caseRuns
    .filter((run) => run.willBeRetried)
    .map((run) => {
      const caseIndex = finalRuns.findIndex(
        (final) => final.testCaseId === run.testCaseId,
      );
      const failed = [...run.steps.values()].find(
        (step) => step.result && FAILED_STATUSES.includes(step.result.status),
      );
      const error = describeError(failed?.result);
      return {
        level: 'WARNING' as const,
        message: `Attempt ${run.attempt + 1} failed and was retried: ${error.message || 'no message'}`,
        stackTrace: error.stackTrace,
        testCase: testCases[caseIndex]?.name ?? run.testCaseId,
        caseIndex,
        step: 'Retry',
        time: run.start,
        occurrences: 1,
      };
    });
}

function collapse(anomalies: Anomaly[]): Anomaly[] {
  const unique = new Map<string, Anomaly>();
  anomalies.forEach((item) => {
    const key = [item.level, item.testCase, item.step, item.message].join('|');
    const existing = unique.get(key);
    if (existing) {
      existing.occurrences += 1;
    } else {
      unique.set(key, { ...item });
    }
  });
  return [...unique.values()];
}

function summarize(
  testCases: ReportCase[],
  durationMs: number,
): Record<string, number> {
  const sum = (pick: (item: ReportCase) => number): number =>
    testCases.reduce((total, item) => total + pick(item), 0);

  return {
    totalTestCases: testCases.length,
    passedTestCases: testCases.filter((item) => item.status === 'PASSED')
      .length,
    failedTestCases: testCases.filter((item) =>
      FAILED_STATUSES.includes(item.status),
    ).length,
    skippedTestCases: testCases.filter((item) =>
      SKIPPED_STATUSES.includes(item.status),
    ).length,
    totalSteps: sum((item) => item.stepCount),
    passedSteps: sum((item) => item.passedSteps),
    failedSteps: sum((item) => item.failedSteps),
    skippedSteps: sum((item) => item.skippedSteps),
    durationMs: Math.max(0, durationMs),
  };
}

function describeEnvironment(
  meta: Meta | undefined,
  runInfo: Partial<RunInfo>,
  playwrightVersion: string,
): Record<string, string> {
  const browser = [runInfo.browser, runInfo.browserVersion]
    .filter(Boolean)
    .join(' ');
  const mode =
    runInfo.headless === undefined
      ? ''
      : runInfo.headless
        ? 'headless'
        : 'headed';

  return {
    baseUrl: runInfo.baseUrl ?? '',
    browser: browser + (browser && mode ? ` (${mode})` : ''),
    viewport: runInfo.viewport ?? '',
    locale: runInfo.locale ?? '',
    timeout: runInfo.timeoutMs ? `${runInfo.timeoutMs} ms` : '',
    tags: runInfo.tags ?? '',
    node:
      runInfo.nodeVersion ??
      [meta?.runtime.name, meta?.runtime.version].filter(Boolean).join(' '),
    cucumber: meta?.implementation.version ?? '',
    playwright: playwrightVersion,
  };
}

class AssetStore {
  entries: Record<string, string> = {};
  private ids = new Map<string, string>();

  add(attachment: Attachment): string {
    const body =
      attachment.contentEncoding === 'BASE64'
        ? attachment.body
        : Buffer.from(attachment.body).toString('base64');

    let id = this.ids.get(body);
    if (!id) {
      id = `img${this.ids.size + 1}`;
      this.ids.set(body, id);
      this.entries[id] = `data:${attachment.mediaType};base64,${body}`;
    }
    return id;
  }
}

function describeError(result?: StepResult): {
  message: string;
  stackTrace: string;
} {
  if (!result || !FAILED_STATUSES.includes(result.status)) {
    return { message: '', stackTrace: '' };
  }

  const raw = withoutLocalPaths(stripAnsi(result.message ?? ''));
  const message =
    withoutLocalPaths(
      stripAnsi(result.exception?.message ?? raw.split('\n')[0] ?? ''),
    ).trim() ||
    STATUS_MESSAGES[result.status] ||
    '';
  const stack = withoutLocalPaths(
    stripAnsi(result.exception?.stackTrace ?? raw),
  ).trim();

  const frames = stack
    .split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n');

  return { message, stackTrace: frames };
}

function attachmentText(attachment: Attachment): string {
  return attachment.contentEncoding === 'BASE64'
    ? Buffer.from(attachment.body, 'base64').toString('utf8')
    : attachment.body;
}

function describeAttachment(attachment: Attachment): string {
  const text = attachmentText(attachment);

  if (
    attachment.mediaType === CUCUMBER_LOG ||
    attachment.mediaType.startsWith('text/') ||
    attachment.mediaType === 'application/json'
  ) {
    return attachment.fileName ? `${attachment.fileName}: ${text}` : text;
  }
  return `Attachment ${attachment.fileName ?? ''} (${attachment.mediaType})`.replace(
    /\s+/g,
    ' ',
  );
}

function hookPhase(hook?: Hook): string | undefined {
  if (!hook?.type) {
    return undefined;
  }
  if (hook.type.startsWith('BEFORE')) {
    return 'Before';
  }
  if (hook.type.startsWith('AFTER')) {
    return 'After';
  }
  return undefined;
}

function hookName(hook?: Hook): string {
  return hook?.name || 'unnamed';
}

function stepLabel(step: ReportStep): string {
  return step.kind === 'HOOK'
    ? `${step.keyword} hook: ${step.name}`
    : `${step.keyword} ${step.name}`.trim();
}

function worstStatus(statuses: string[]): string {
  if (!statuses.length) {
    return 'SKIPPED';
  }
  return statuses.reduce((worst, status) =>
    SEVERITY.indexOf(status) < SEVERITY.indexOf(worst) ? status : worst,
  );
}

function caseCode(tags: string[], position: number): string {
  const tag = tags.find((name) => /^@[A-Za-z][A-Za-z0-9_]*-\d+$/.test(name));
  return tag
    ? tag.slice(1).toUpperCase()
    : `TC${String(position + 1).padStart(3, '0')}`;
}

function fillPlaceholders(
  text: string,
  values: Record<string, string> = {},
): string {
  return text.replace(/<([^>]+)>/g, (match, name: string) =>
    name in values ? values[name] : match,
  );
}

function dedent(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function withoutLocalPaths(text: string): string {
  return text.split(`${process.cwd()}${sep}`).join('');
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}
