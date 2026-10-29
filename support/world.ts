import { setWorldConstructor, World } from '@cucumber/cucumber';
import type { Page } from 'playwright';

import type { DroppableTab } from '../features/droppable/droppable.locators.ts';
import type { UserField } from '../features/web-tables/web-tables.locators.ts';
import { env } from '../src/config/env.ts';
import type { RequiredField, User } from '../test-data/test-data.ts';

export class TestWorld extends World {
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
