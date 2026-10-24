import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readEnvelopes } from './messages.ts';
import {
  MESSAGES_FILE,
  REPORT_FILE,
  REPORTS_DIR,
  RUN_INFO_FILE,
  TEMPLATE_FILE,
} from './paths.ts';
import { buildPayload, type ReportPayload } from './payload.ts';
import { prerender } from './prerender.ts';
import type { RunInfo } from './run-info.ts';

const DATA_TOKEN = '__EXECUTION_DATA__';

async function generateReport(payload = loadPayload()): Promise<string> {
  const data = JSON.stringify(payload).replace(/<\//g, '<\\/');
  const html = readFileSync(TEMPLATE_FILE, 'utf8').replace(
    DATA_TOKEN,
    () => data,
  );
  const file = resolve(REPORT_FILE);
  writeFileSync(file, html);

  try {
    writeFileSync(file, await prerender(file));
  } catch (error) {
    console.warn(
      `Report HTML tidak di-pre-render, preview file akan tampil kosong: ${(error as Error).message}`,
    );
  }
  return file;
}

function loadPayload(): ReportPayload {
  if (!existsSync(MESSAGES_FILE)) {
    throw new Error(
      `${MESSAGES_FILE} tidak ada. Jalankan test dulu, mis. npm test.`,
    );
  }

  return buildPayload(
    readEnvelopes(MESSAGES_FILE),
    readJson<Partial<RunInfo>>(RUN_INFO_FILE) ?? {},
    readJson<{ version: string }>('node_modules/@playwright/test/package.json')
      ?.version ?? '',
  );
}

function openReport(file = resolve(REPORT_FILE)): void {
  if (!existsSync(file)) {
    throw new Error(`${file} tidak ada. Jalankan npm test dulu.`);
  }

  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [file]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', file]]
        : ['xdg-open', [file]];

  spawn(command, args, { detached: true, stdio: 'ignore' })
    .on('error', () => console.log(`Buka report secara manual: ${file}`))
    .unref();
}

async function runAndReport(script: string, args: string[]): Promise<number> {
  rmSync(MESSAGES_FILE, { force: true });
  rmSync(RUN_INFO_FILE, { force: true });

  const windows = process.platform === 'win32';
  const forwarded = windows
    ? args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
    : args;
  const result = spawnSync(
    windows ? 'npm.cmd' : 'npm',
    ['run', script, ...(forwarded.length ? ['--', ...forwarded] : [])],
    { stdio: 'inherit', shell: windows },
  );

  const file = await generateReport();
  console.log(`\nReport: ${file}`);

  if (shouldOpen()) {
    openReport(file);
  }
  return result.status ?? 1;
}

function shouldOpen(): boolean {
  return (
    !process.env.CI &&
    (process.env.REPORT_OPEN ?? 'true').toLowerCase() !== 'false'
  );
}

function clean(): void {
  if (!existsSync(REPORTS_DIR)) {
    console.log(`${REPORTS_DIR}/ sudah kosong.`);
    return;
  }
  rmSync(REPORTS_DIR, { recursive: true, force: true });
  console.log(`${REPORTS_DIR}/ dihapus.`);
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

async function main(): Promise<number> {
  const [command, argument, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'run':
      if (!argument) {
        console.error('Pemakaian: cli.ts run <npm-script> [argumen cucumber]');
        return 1;
      }
      return runAndReport(argument, rest);
    case 'generate':
      console.log(`Report: ${await generateReport()}`);
      return 0;
    case 'open':
      openReport();
      return 0;
    case 'clean':
      clean();
      return 0;
    default:
      console.error(
        'Pemakaian: cli.ts <run <npm-script> | generate | open | clean>',
      );
      return 1;
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
