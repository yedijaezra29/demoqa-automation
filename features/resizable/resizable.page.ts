import type { Page } from 'playwright';

import { env } from '../../src/config/env.ts';
import { UIAction } from '../../src/core/UIAction.ts';
import { UIAssert } from '../../src/core/UIAssert.ts';
import type { Size } from '../../test-data/test-data.ts';
import { ResizableLocators } from './resizable.locators.ts';

const MAX_DRAG_ATTEMPTS = 3;

export class ResizablePage {
  private readonly locators: ResizableLocators;

  constructor(private readonly page: Page) {
    this.locators = new ResizableLocators(page);
  }

  async open(): Promise<void> {
    await UIAction.goto(this.page, `${env.baseUrl}/resizable`, {
      waitUntil: 'domcontentloaded',
    });
    await UIAction.waitForVisible(this.locators.handle);
  }

  async resizeTo({ width, height }: Size): Promise<void> {
    for (let attempt = 0; attempt < MAX_DRAG_ATTEMPTS; attempt++) {
      const box = await this.locators.box.boundingBox();

      if (!box) {
        throw new Error('Kotak Resizable tidak terlihat di layar');
      }
      if (box.width === width && box.height === height) {
        return;
      }

      await UIAction.dragBy(
        this.page,
        this.locators.handle,
        width - box.width,
        height - box.height,
      );
    }
  }

  async verifySize({ width, height }: Size): Promise<void> {
    await UIAssert.css(
      this.locators.box,
      'width',
      `${width}px`,
      'Kotak Resizable',
    );
    await UIAssert.css(
      this.locators.box,
      'height',
      `${height}px`,
      'Kotak Resizable',
    );
    await UIAssert.size(
      this.locators.box,
      { width, height },
      'Kotak Resizable',
    );
  }
}
