import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { env } from '../../tests/support/env.ts';
import { RUN_INFO_FILE } from './paths.ts';

export interface RunInfo {
  baseUrl: string;
  headless: boolean;
  browser: string;
  browserVersion: string;
  locale: string;
  viewport: string;
  timeoutMs: number;
  tags: string;
  nodeVersion: string;
}

const BROWSER_NAMES = {
  chromium: 'Chromium',
  firefox: 'Firefox',
  webkit: 'WebKit',
};

let browserVersion = '';

export function recordBrowserVersion(version: string): void {
  browserVersion ||= version;
}

export function writeRunInfo(): void {
  const info: RunInfo = {
    baseUrl: env.baseUrl,
    headless: env.headless,
    browser: BROWSER_NAMES[env.browser],
    browserVersion,
    locale: env.locale,
    viewport: `${env.viewport.width} x ${env.viewport.height}`,
    timeoutMs: env.timeout,
    tags: process.env.TAGS ?? '',
    nodeVersion: process.version,
  };

  mkdirSync(dirname(RUN_INFO_FILE), { recursive: true });
  writeFileSync(RUN_INFO_FILE, JSON.stringify(info, null, 2));
}
