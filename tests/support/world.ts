import { setWorldConstructor, World } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';

import type { RequiredField, User } from '../../test-data/test-data.ts';
import type { DroppableTab } from '../droppable/droppable.locators.ts';
import type { UserField } from '../web-tables/web-tables.locators.ts';
import { env } from './env.ts';

export class TestWorld extends World {
  browser!: Browser;

  context!: BrowserContext;

  page!: Page;

  rowsBefore = 0;

  addedUsers: User[] = [];

  rejectedUserField?: UserField;

  rejectedFormField?: RequiredField;

  droppableTab: DroppableTab = 'Simple';

  resizeCase = '';

  screenshotsInStep = 0;

  evidenceStep = false;

  async screenshot(
    name: string,
    { fullPage = true, always = false } = {},
  ): Promise<void> {
    if (env.screenshot !== 'all' && !this.evidenceStep && !always) {
      return;
    }

    const image = await this.page.screenshot({ fullPage });

    this.attach(image, { mediaType: 'image/png', fileName: name });
    this.screenshotsInStep++;
  }
}

setWorldConstructor(TestWorld);
