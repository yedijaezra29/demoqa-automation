import type { Locator, Page } from 'playwright';

export class ResizableLocators {
  constructor(private readonly page: Page) {}

  get box(): Locator {
    return this.page.locator('#resizableBoxWithRestriction');
  }

  get handle(): Locator {
    return this.box.locator('.react-resizable-handle');
  }
}
