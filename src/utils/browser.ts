import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';

import { env } from '../config/env.ts';

const engines = { chromium, firefox, webkit };

// demoqa ads load slowly and sometimes cover the elements under test.
const AD_HOSTS =
  /googlesyndication|doubleclick|adservice|googletagservices|pagead/;

export class BrowserManager {
  private browser?: Browser;
  private context?: BrowserContext;

  async start(): Promise<Page> {
    this.browser = await engines[env.browser].launch({
      headless: env.headless,
    });

    const contextOptions: Parameters<Browser['newContext']>[0] = {
      baseURL: env.baseUrl,
      ignoreHTTPSErrors: env.ignoreHTTPSErrors,
      locale: env.locale,
      viewport: env.viewport,
    };

    if (env.isRecordingVideo) {
      contextOptions.recordVideo = {
        dir: 'reports/videos',
        size: env.viewport,
      };
    }

    this.context = await this.browser.newContext(contextOptions);
    this.context.setDefaultTimeout(env.timeout);
    await this.context.route(AD_HOSTS, (route) => route.abort());

    return this.context.newPage();
  }

  browserVersion(): string {
    return this.browser?.version() ?? '';
  }

  async stop(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();

    this.context = undefined;
    this.browser = undefined;
  }
}
