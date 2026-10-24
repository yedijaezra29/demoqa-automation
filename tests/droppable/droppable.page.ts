import { expect, type Page } from '@playwright/test';

import type { DroppableData } from '../../test-data/test-data.ts';
import { DroppableLocators, type DroppableTab } from './droppable.locators.ts';

const ACCEPTED_CLASS = /\bui-state-highlight\b/;

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
    await this.page.goto('/droppable', { waitUntil: 'domcontentloaded' });
    await this.locators.tab.click();
    await this.locators.panel.waitFor();
  }

  async dragIntoDropBox(boxText: string): Promise<void> {
    await this.locators.readyBox(boxText).waitFor();
    await this.locators.box(boxText).dragTo(this.locators.dropBox);
  }

  async dragOutsideDropBox(boxText: string): Promise<void> {
    await this.locators.readyBox(boxText).waitFor();

    const box = await this.locators.box(boxText).boundingBox();
    if (!box) {
      throw new Error(`Kotak "${boxText}" tidak terlihat di layar`);
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX, startY + DROP_OUTSIDE_OFFSET, {
      steps: 10,
    });
    await this.page.mouse.up();
  }

  async verifyBoxAccepted(expected: DroppableData): Promise<void> {
    await expect(this.locators.dropBox).toHaveText(expected.acceptedText);
    await expect(this.locators.dropBox).toHaveClass(ACCEPTED_CLASS);
  }

  async verifyBoxNotAccepted(expected: DroppableData): Promise<void> {
    await expect(this.locators.dropBox).toHaveText(
      expected.emptyText[this.tab],
    );
    await expect(this.locators.dropBox).not.toHaveClass(ACCEPTED_CLASS);
  }
}
