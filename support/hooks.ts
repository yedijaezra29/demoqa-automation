import fs from 'node:fs/promises';
import path from 'node:path';

import {
  After,
  AfterAll,
  AfterStep,
  Before,
  BeforeStep,
  Status,
  setDefaultTimeout,
} from '@cucumber/cucumber';

import { env } from '../src/config/env.ts';
import { BrowserManager } from '../src/utils/browser.ts';
import { FAILURE_SCREENSHOT } from '../tools/report/payload.ts';
import {
  recordBrowserVersion,
  writeRunInfo,
} from '../tools/report/run-info.ts';
import type { TestWorld } from './world.ts';

const OUTCOME_STEP = 'Outcome';

setDefaultTimeout(env.timeout * 4);

const browserManagers = new WeakMap<TestWorld, BrowserManager>();

Before({ name: 'Buka browser' }, async function (this: TestWorld) {
  const manager = new BrowserManager();
  browserManagers.set(this, manager);
  this.page = await manager.start();
  recordBrowserVersion(manager.browserVersion());
});

BeforeStep(function (this: TestWorld, { pickleStep }) {
  this.screenshotsInStep = 0;
  this.evidenceStep =
    env.screenshot === 'all' ||
    (env.screenshot === 'expected' && String(pickleStep.type) === OUTCOME_STEP);
});

AfterStep(async function (this: TestWorld, { pickleStep, result }) {
  if (
    this.evidenceStep &&
    result.status === Status.PASSED &&
    this.screenshotsInStep === 0
  ) {
    await this.screenshot(pickleStep.text, { fullPage: false });
  }
  this.evidenceStep = false;
});

After(
  { name: 'Tutup browser' },
  async function (this: TestWorld, { pickle, result }) {
    const manager = browserManagers.get(this);
    // The video file only gets its final path after the context closes.
    const video = this.page?.video();

    try {
      if (result?.status === Status.FAILED && this.page) {
        await this.screenshot(FAILURE_SCREENSHOT, { always: true });
      }
    } finally {
      await manager?.stop();
      browserManagers.delete(this);
    }

    if (!video) {
      return;
    }

    await fs.mkdir('reports/videos', { recursive: true });
    await fs.rename(
      await video.path(),
      path.join('reports', 'videos', `${videoName(pickle)}.webm`),
    );
  },
);

AfterAll(function () {
  writeRunInfo();
});

function videoName(pickle: {
  name: string;
  tags: readonly { name: string }[];
}): string {
  const tag = pickle.tags
    .map((item) => item.name)
    .find((name) => /^@[A-Z]+-\d+$/i.test(name));
  const scenarioName = pickle.name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_');

  return tag ? `${tag.slice(1)}_${scenarioName}` : scenarioName;
}
