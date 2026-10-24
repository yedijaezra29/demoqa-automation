import { readFileSync } from 'node:fs';

export interface Timestamp {
  seconds: number;
  nanos: number;
}

interface Tag {
  name: string;
}

interface GherkinStep {
  id: string;
  keyword: string;
  text: string;
}

interface TableRow {
  cells: { value: string }[];
}

export interface Scenario {
  id: string;
  description: string;
  location: { line: number };
  steps: GherkinStep[];
  examples?: {
    tableHeader?: TableRow;
    tableBody: (TableRow & { id: string; location: { line: number } })[];
  }[];
}

export interface FeatureChild {
  background?: { steps: GherkinStep[] };
  scenario?: Scenario;
  rule?: { children: FeatureChild[] };
}

export interface GherkinDocument {
  uri: string;
  feature?: {
    name: string;
    description: string;
    tags: Tag[];
    children: FeatureChild[];
  };
}

export interface Pickle {
  id: string;
  uri: string;
  name: string;
  astNodeIds: string[];
  tags: Tag[];
  steps: { id: string; text: string; astNodeIds: string[] }[];
}

export interface Hook {
  id: string;
  name?: string;
  type?: string;
  sourceReference?: { uri?: string };
}

export interface TestCase {
  id: string;
  pickleId: string;
  testSteps: { id: string; pickleStepId?: string; hookId?: string }[];
}

export interface StepResult {
  status: string;
  duration: Timestamp;
  message?: string;
  exception?: { type: string; message?: string; stackTrace?: string };
}

export interface Attachment {
  testCaseStartedId?: string;
  testStepId?: string;
  body: string;
  mediaType: string;
  contentEncoding: 'BASE64' | 'IDENTITY';
  fileName?: string;
  timestamp?: Timestamp;
}

export interface Meta {
  implementation: { name: string; version?: string };
  runtime: { name: string; version?: string };
  os: { name: string; version?: string };
  cpu: { name: string };
}

export interface Envelope {
  meta?: Meta;
  gherkinDocument?: GherkinDocument;
  pickle?: Pickle;
  hook?: Hook;
  testRunStarted?: { timestamp: Timestamp };
  testRunFinished?: {
    success: boolean;
    timestamp: Timestamp;
    message?: string;
  };
  testCase?: TestCase;
  testCaseStarted?: {
    id: string;
    testCaseId: string;
    attempt: number;
    timestamp: Timestamp;
  };
  testCaseFinished?: {
    testCaseStartedId: string;
    timestamp: Timestamp;
    willBeRetried: boolean;
  };
  testStepStarted?: {
    testCaseStartedId: string;
    testStepId: string;
    timestamp: Timestamp;
  };
  testStepFinished?: {
    testCaseStartedId: string;
    testStepId: string;
    testStepResult: StepResult;
    timestamp: Timestamp;
  };
  attachment?: Attachment;
  testRunHookStarted?: { id: string; hookId: string; timestamp: Timestamp };
  testRunHookFinished?: {
    testRunHookStartedId: string;
    result: StepResult;
    timestamp: Timestamp;
  };
}

export function readEnvelopes(file: string): Envelope[] {
  const envelopes: Envelope[] = [];
  let corrupt = 0;

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) {
      continue;
    }

    try {
      envelopes.push(JSON.parse(line) as Envelope);
    } catch {
      corrupt++;
    }
  }

  if (corrupt) {
    console.warn(
      `${corrupt} baris rusak di ${file} dilewati. Jangan jalankan dua run test bersamaan, karena keduanya menulis ke file yang sama.`,
    );
  }
  return envelopes;
}

export function toMillis(timestamp?: Timestamp): number {
  if (!timestamp) {
    return 0;
  }

  return timestamp.seconds * 1000 + Math.round(timestamp.nanos / 1e6);
}
