import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { parseFeature } from './vscode-extension/src/gherkin.ts';
import { ORDER_FILE } from './vscode-extension/src/order-plugin.ts';

const SUITES_FILE = 'test-suites.json';
const ORDER_PLUGIN = './tools/vscode-extension/src/order-plugin.ts';
const WINDOWS = process.platform === 'win32';

interface SuiteEntry {
  feature: string;
  name: string;
  tag?: string;
  checked: boolean;
}

interface Suite {
  name: string;
  entries: SuiteEntry[];
}

function readSuites(): Suite[] {
  if (!existsSync(SUITES_FILE)) {
    throw new Error(`${SUITES_FILE} tidak ditemukan di folder ini.`);
  }
  return (JSON.parse(readFileSync(SUITES_FILE, 'utf8')) as { suites: Suite[] })
    .suites;
}

function printSuites(suites: Suite[]): void {
  console.log('Test suite yang tersedia:\n');
  for (const suite of suites) {
    const checked = suite.entries.filter((entry) => entry.checked).length;
    console.log(`  ${suite.name.padEnd(12)} ${checked} skenario`);
  }
  console.log('\nContoh: npm run suite -- Smoke');
  console.log('Tanpa report: npm run suite -- Smoke --no-report');
}

function scenarioLocation(entry: SuiteEntry): string | undefined {
  const feature = parseFeature(readFileSync(entry.feature, 'utf8'));
  const scenario = feature?.scenarios.find(
    (candidate) =>
      candidate.name === entry.name &&
      (!entry.tag || candidate.tags.includes(entry.tag)),
  );

  return scenario ? `${entry.feature}:${scenario.line}` : undefined;
}

function runSuite(suite: Suite, withReport: boolean): number {
  const locations: string[] = [];

  console.log(`Menjalankan suite "${suite.name}":\n`);
  for (const entry of suite.entries.filter((item) => item.checked)) {
    const location = scenarioLocation(entry);

    if (location) {
      locations.push(location);
      console.log(`  ${entry.tag?.slice(1) ?? ''}  ${entry.name}`);
    } else {
      console.warn(
        `  Dilewati, tidak ada di ${entry.feature}: ${entry.name} (judulnya mungkin sudah diganti)`,
      );
    }
  }
  console.log('');

  if (locations.length === 0) {
    console.error('Tidak ada skenario yang bisa dijalankan di suite ini.');
    return 1;
  }

  mkdirSync(dirname(ORDER_FILE), { recursive: true });
  writeFileSync(ORDER_FILE, JSON.stringify({ order: locations }));

  const script = withReport ? 'test' : 'test:raw';
  const args = ['run', script, '--', ...locations, '--plugin', ORDER_PLUGIN];
  const result = spawnSync(
    WINDOWS ? 'npm.cmd' : 'npm',
    WINDOWS ? args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)) : args,
    { stdio: 'inherit', shell: WINDOWS },
  );

  return result.status ?? 1;
}

function main(): number {
  const args = process.argv.slice(2);
  const withReport = !args.includes('--no-report');
  const name = args.filter((arg) => !arg.startsWith('--')).join(' ');
  const suites = readSuites();

  if (!name) {
    printSuites(suites);
    return 0;
  }

  const suite = suites.find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  );
  if (!suite) {
    console.error(`Suite "${name}" tidak ada.\n`);
    printSuites(suites);
    return 1;
  }
  return runSuite(suite, withReport);
}

try {
  process.exitCode = main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
