import { expect, type Page } from '@playwright/test';

import type { Size } from '../../test-data/test-data.ts';
import { ResizableLocators } from './resizable.locators.ts';

const MAX_DRAG_ATTEMPTS = 3;

export class ResizablePage {
  private readonly locators: ResizableLocators;

  constructor(private readonly page: Page) {
    this.locators = new ResizableLocators(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/resizable', { waitUntil: 'domcontentloaded' });
    await this.locators.handle.waitFor();
  }

  async resizeTo({ width, height }: Size): Promise<void> {
    for (let attempt = 0; attempt < MAX_DRAG_ATTEMPTS; attempt++) {
      const box = await this.locators.box.boundingBox();
      const handle = await this.locators.handle.boundingBox();

      if (!box || !handle) {
        throw new Error('Kotak Resizable tidak terlihat di layar');
      }
      if (box.width === width && box.height === height) {
        return;
      }

      const startX = handle.x + handle.width / 2;
      const startY = handle.y + handle.height / 2;

      await this.page.mouse.move(startX, startY);
      await this.page.mouse.down();
      await this.page.mouse.move(
        startX + width - box.width,
        startY + height - box.height,
      );
      await this.page.mouse.up();
    }
  }

  async verifySize({ width, height }: Size): Promise<void> {
    await expect(this.locators.box).toHaveCSS('width', `${width}px`);
    await expect(this.locators.box).toHaveCSS('height', `${height}px`);
    expect(await this.locators.box.boundingBox()).toMatchObject({
      width,
      height,
    });
  }
}
