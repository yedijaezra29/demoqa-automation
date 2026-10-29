import type { Locator, Page } from 'playwright';

export type DroppableTab = 'Simple' | 'Accept';

export class DroppableLocators {
  constructor(
    private readonly page: Page,
    private readonly tabName: DroppableTab,
  ) {}

  get tab(): Locator {
    return this.page.getByRole('tab', { name: this.tabName });
  }

  get panel(): Locator {
    return this.page.getByRole('tabpanel', { name: this.tabName });
  }

  box(text: string): Locator {
    return this.panel.getByText(text, { exact: true });
  }

  readyBox(text: string): Locator {
    return this.box(text).and(this.page.locator('.ui-draggable'));
  }

  get dropBox(): Locator {
    return this.panel.locator('.drop-box');
  }
}
