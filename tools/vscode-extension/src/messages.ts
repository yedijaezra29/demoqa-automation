export type Status =
  | 'UNKNOWN'
  | 'PASSED'
  | 'SKIPPED'
  | 'PENDING'
  | 'UNDEFINED'
  | 'AMBIGUOUS'
  | 'FAILED';

const RANK: Record<Status, number> = {
  UNKNOWN: 0,
  PASSED: 1,
  SKIPPED: 2,
  PENDING: 3,
  UNDEFINED: 4,
  AMBIGUOUS: 5,
  FAILED: 6,
};

export interface StepResult {
  scenario: string;
  step?: string;
  hook?: string;
  status: Status;
  duration: number;
  message?: string;
  stack?: string;
}

export interface RunListener {
  runStarted(): void;
  caseQueued(scenario: string): void;
  caseStarted(scenario: string, attempt: number): void;
  stepFinished(result: StepResult): void;
  caseFinished(
    scenario: string,
    status: Status,
    duration: number,
    willBeRetried: boolean,
  ): void;
  runFinished(): void;
}

interface Duration {
  seconds: number;
  nanos: number;
}

interface Location {
  line: number;
}

interface GherkinNode {
  id: string;
  location: Location;
  steps?: GherkinNode[];
  examples?: { tableBody: GherkinNode[] }[];
}

interface GherkinChild {
  background?: GherkinNode;
  scenario?: GherkinNode;
  rule?: { children: GherkinChild[] };
}

interface Envelope {
  gherkinDocument?: {
    uri: string;
    feature?: { children: GherkinChild[] };
  };
  pickle?: {
    id: string;
    uri: string;
    astNodeIds: string[];
    steps: { id: string; astNodeIds: string[] }[];
  };
  hook?: { id: string; name?: string };
  testCase?: {
    id: string;
    pickleId: string;
    testSteps: { id: string; pickleStepId?: string; hookId?: string }[];
  };
  testRunStarted?: object;
  testCaseStarted?: {
    id: string;
    testCaseId: string;
    attempt: number;
    timestamp: Duration;
  };
  testStepFinished?: {
    testCaseStartedId: string;
    testStepId: string;
    testStepResult: {
      status: Status;
      duration: Duration;
      message?: string;
      exception?: { stackTrace?: string };
    };
  };
  testCaseFinished?: {
    testCaseStartedId: string;
    timestamp: Duration;
    willBeRetried: boolean;
  };
  testRunFinished?: object;
}

interface Target {
  step?: string;
  hook?: string;
}

interface Running {
  scenario: string;
  steps: Map<string, Target>;
  status: Status;
  startedAt: number;
}

export class RunReader {
  private readonly lines = new Map<string, number>();
  private readonly hooks = new Map<string, string>();
  private readonly pickles = new Map<string, NonNullable<Envelope['pickle']>>();
  private readonly testCases = new Map<
    string,
    NonNullable<Envelope['testCase']>
  >();
  private readonly running = new Map<string, Running>();

  constructor(private readonly listener: RunListener) {}

  read(line: string): void {
    this.handle(JSON.parse(line) as Envelope);
  }

  private handle(envelope: Envelope): void {
    if (envelope.gherkinDocument) {
      this.index(envelope.gherkinDocument.feature?.children ?? []);
    } else if (envelope.pickle) {
      this.pickles.set(envelope.pickle.id, envelope.pickle);
    } else if (envelope.hook) {
      this.hooks.set(envelope.hook.id, envelope.hook.name ?? 'Hook');
    } else if (envelope.testCase) {
      this.testCases.set(envelope.testCase.id, envelope.testCase);
      this.caseQueued(envelope.testCase);
    } else if (envelope.testRunStarted) {
      this.listener.runStarted();
    } else if (envelope.testCaseStarted) {
      this.caseStarted(envelope.testCaseStarted);
    } else if (envelope.testStepFinished) {
      this.stepFinished(envelope.testStepFinished);
    } else if (envelope.testCaseFinished) {
      this.caseFinished(envelope.testCaseFinished);
    } else if (envelope.testRunFinished) {
      this.listener.runFinished();
    }
  }

  private index(children: GherkinChild[]): void {
    for (const child of children) {
      for (const node of [child.background, child.scenario]) {
        if (!node) {
          continue;
        }
        this.lines.set(node.id, node.location.line);
        for (const step of node.steps ?? []) {
          this.lines.set(step.id, step.location.line);
        }
        for (const row of (node.examples ?? []).flatMap(
          (examples) => examples.tableBody,
        )) {
          this.lines.set(row.id, row.location.line);
        }
      }
      this.index(child.rule?.children ?? []);
    }
  }

  private scenarioId(pickle: NonNullable<Envelope['pickle']>): string {
    return `${pickle.uri}:${this.lines.get(pickle.astNodeIds[pickle.astNodeIds.length - 1]) ?? 1}`;
  }

  private caseQueued(testCase: NonNullable<Envelope['testCase']>): void {
    const pickle = this.pickles.get(testCase.pickleId);
    if (pickle) {
      this.listener.caseQueued(this.scenarioId(pickle));
    }
  }

  private caseStarted(started: NonNullable<Envelope['testCaseStarted']>): void {
    const testCase = this.testCases.get(started.testCaseId);
    const pickle = testCase && this.pickles.get(testCase.pickleId);
    if (!testCase || !pickle) {
      return;
    }

    const scenario = this.scenarioId(pickle);
    const steps = new Map<string, Target>();
    for (const testStep of testCase.testSteps) {
      if (testStep.hookId) {
        steps.set(testStep.id, { hook: this.hooks.get(testStep.hookId) });
        continue;
      }
      const pickleStep = pickle.steps.find(
        (candidate) => candidate.id === testStep.pickleStepId,
      );
      const line = pickleStep && this.lines.get(pickleStep.astNodeIds[0]);
      steps.set(testStep.id, {
        step: line ? `${scenario}:${line}` : undefined,
      });
    }

    this.running.set(started.id, {
      scenario,
      steps,
      status: 'PASSED',
      startedAt: millis(started.timestamp),
    });
    this.listener.caseStarted(scenario, started.attempt);
  }

  private stepFinished(
    finished: NonNullable<Envelope['testStepFinished']>,
  ): void {
    const state = this.running.get(finished.testCaseStartedId);
    const target = state?.steps.get(finished.testStepId);
    if (!state || !target) {
      return;
    }

    const result = finished.testStepResult;
    const { duration, status, message } = result;
    const stack =
      status === 'PASSED'
        ? undefined
        : (result.exception?.stackTrace ?? result.message);
    if (RANK[status] > RANK[state.status]) {
      state.status = status;
    }
    this.listener.stepFinished({
      scenario: state.scenario,
      step: target.step,
      hook: target.hook,
      status,
      duration: millis(duration),
      message,
      stack,
    });
  }

  private caseFinished(
    finished: NonNullable<Envelope['testCaseFinished']>,
  ): void {
    const state = this.running.get(finished.testCaseStartedId);
    if (!state) {
      return;
    }
    this.running.delete(finished.testCaseStartedId);
    this.listener.caseFinished(
      state.scenario,
      state.status,
      millis(finished.timestamp) - state.startedAt,
      finished.willBeRetried,
    );
  }
}

function millis(duration: Duration): number {
  return duration.seconds * 1000 + duration.nanos / 1e6;
}
