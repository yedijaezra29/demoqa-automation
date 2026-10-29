import type { Page } from 'playwright';

import { env } from '../../src/config/env.ts';
import { UIAction } from '../../src/core/UIAction.ts';
import { UIAssert } from '../../src/core/UIAssert.ts';
import type { DroppableData } from '../../test-data/test-data.ts';
import { DroppableLocators, type DroppableTab } from './droppable.locators.ts';

const ACCEPTED_CLASS = 'ui-state-highlight';

const DROP_OUTSIDE_OFFSET = 250;

export class DroppablePage {
  private readonly locators: DroppableLocators;

  constructor(
    private readonly page: Page,
    private readonly tab: DroppableTab,
  ) {
    this.locators = new DroppableLocators(page, tab);
  }

  async open(): Promise<void> {
    await UIAction.goto(this.page, `${env.baseUrl}/droppable`, {
      waitUntil: 'domcontentloaded',
    });
    await UIAction.click(this.locators.tab);
    await UIAction.waitForVisible(this.locators.panel);
  }

  async dragIntoDropBox(boxText: string): Promise<void> {
    await UIAction.waitForVisible(this.locators.readyBox(boxText));
    await UIAction.dragTo(this.locators.box(boxText), this.locators.dropBox);
  }

  async dragOutsideDropBox(boxText: string): Promise<void> {
    await UIAction.waitForVisible(this.locators.readyBox(boxText));
    await UIAction.dragBy(
      this.page,
      this.locators.box(boxText),
      0,
      DROP_OUTSIDE_OFFSET,
      { steps: 10 },
    );
  }

  async verifyBoxAccepted(expected: DroppableData): Promise<void> {
    await UIAssert.text(
      this.locators.dropBox,
      expected.acceptedText,
      `Area target di tab ${this.tab}`,
    );
    await UIAssert.className(
      this.locators.dropBox,
      ACCEPTED_CLASS,
      `Area target di tab ${this.tab}`,
    );
  }

  async verifyBoxNotAccepted(expected: DroppableData): Promise<void> {
    await UIAssert.text(
      this.locators.dropBox,
      expected.emptyText[this.tab],
      `Area target di tab ${this.tab}`,
    );
    await UIAssert.notClassName(
      this.locators.dropBox,
      ACCEPTED_CLASS,
      `Area target di tab ${this.tab}`,
    );
  }
}
