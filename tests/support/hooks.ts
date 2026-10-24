import {
  After,
  AfterAll,
  AfterStep,
  Before,
  BeforeStep,
  Status,
  setDefaultTimeout,
} from '@cucumber/cucumber';
import { chromium, firefox, webkit } from '@playwright/test';

import { FAILURE_SCREENSHOT } from '../../tools/report/payload.ts';
import {
  recordBrowserVersion,
  writeRunInfo,
} from '../../tools/report/run-info.ts';
import { env } from './env.ts';
import type { TestWorld } from './world.ts';

const engines = { chromium, firefox, webkit };

const AD_HOSTS =
  /googlesyndication|doubleclick|adservice|googletagservices|pagead/;

const OUTCOME_STEP = 'Outcome';

setDefaultTimeout(env.timeout * 4);

Before({ name: 'Buka browser' }, async function (this: TestWorld) {
  this.browser = await engines[env.browser].launch({ headless: env.headless });
  this.context = await this.browser.newContext({
    baseURL: env.baseUrl,
    locale: env.locale,
    viewport: env.viewport,
  });
  this.context.setDefaultTimeout(env.timeout);
  await this.context.route(AD_HOSTS, (route) => route.abort());
  this.page = await this.context.newPage();
  recordBrowserVersion(this.browser.version());
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

After({ name: 'Tutup browser' }, async function (this: TestWorld, { result }) {
  try {
    if (result?.status === Status.FAILED && this.page) {
      await this.screenshot(FAILURE_SCREENSHOT, { always: true });
    }
  } finally {
    await this.context?.close();
    await this.browser?.close();
  }
});

AfterAll(function () {
  writeRunInfo();
});
