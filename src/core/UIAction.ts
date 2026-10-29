import type { Locator, Page } from 'playwright';

export class UIAction {
  private constructor() {}

  static async goto(
    page: Page,
    url: string,
    options?: Parameters<Page['goto']>[1],
  ): Promise<void> {
    await page.goto(url, options);
  }

  static async click(
    locator: Locator,
    options?: Parameters<Locator['click']>[0],
  ): Promise<void> {
    await locator.click(options);
  }

  static async doubleClick(
    locator: Locator,
    options?: Parameters<Locator['dblclick']>[0],
  ): Promise<void> {
    await locator.dblclick(options);
  }

  static async hover(
    locator: Locator,
    options?: Parameters<Locator['hover']>[0],
  ): Promise<void> {
    await locator.hover(options);
  }

  // Replaces any existing text.
  static async inputText(
    locator: Locator,
    value: string,
    options?: Parameters<Locator['fill']>[1],
  ): Promise<void> {
    await locator.fill(value, options);
  }

  static async clearText(
    locator: Locator,
    options?: Parameters<Locator['fill']>[1],
  ): Promise<void> {
    await locator.fill('', options);
  }

  // Alias for inputText, kept for compatibility.
  static async fill(
    locator: Locator,
    value: string,
    options?: Parameters<Locator['fill']>[1],
  ): Promise<void> {
    await locator.fill(value, options);
  }

  // Alias for clearText, kept for compatibility.
  static async clear(
    locator: Locator,
    options?: Parameters<Locator['fill']>[1],
  ): Promise<void> {
    await locator.fill('', options);
  }

  // Types key by key, for inputs that react to each keystroke (autocomplete).
  static async type(
    locator: Locator,
    value: string,
    options?: Parameters<Locator['pressSequentially']>[1],
  ): Promise<void> {
    await locator.pressSequentially(value, options);
  }

  static async press(
    locator: Locator,
    key: string,
    options?: Parameters<Locator['press']>[1],
  ): Promise<void> {
    await locator.press(key, options);
  }

  static async check(
    locator: Locator,
    options?: Parameters<Locator['check']>[0],
  ): Promise<void> {
    await locator.check(options);
  }

  static async uncheck(
    locator: Locator,
    options?: Parameters<Locator['uncheck']>[0],
  ): Promise<void> {
    await locator.uncheck(options);
  }

  static async selectOption(
    locator: Locator,
    value: Parameters<Locator['selectOption']>[0],
    options?: Parameters<Locator['selectOption']>[1],
  ): Promise<void> {
    await locator.selectOption(value, options);
  }

  static async uploadFile(
    locator: Locator,
    files: Parameters<Locator['setInputFiles']>[0],
    options?: Parameters<Locator['setInputFiles']>[1],
  ): Promise<void> {
    await locator.setInputFiles(files, options);
  }

  static async focus(locator: Locator): Promise<void> {
    await locator.focus();
  }

  static async blur(locator: Locator): Promise<void> {
    await locator.evaluate((element) => {
      (element as HTMLElement).blur();
    });
  }

  static async scrollIntoView(
    locator: Locator,
    options?: Parameters<Locator['scrollIntoViewIfNeeded']>[0],
  ): Promise<void> {
    await locator.scrollIntoViewIfNeeded(options);
  }

  static async dragTo(
    source: Locator,
    target: Locator,
    options?: Parameters<Locator['dragTo']>[1],
  ): Promise<void> {
    await source.dragTo(target, options);
  }

  // Drags from the element's center by a pixel offset, for drops that have no target element.
  static async dragBy(
    page: Page,
    locator: Locator,
    offsetX: number,
    offsetY: number,
    { steps = 1 }: { steps?: number } = {},
  ): Promise<void> {
    await locator.waitFor({ state: 'visible' });
    const box = await locator.boundingBox();
    if (!box) {
      throw new Error('Element has no bounding box to drag from');
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + offsetX, startY + offsetY, { steps });
    await page.mouse.up();
  }

  static async waitForAttached(
    locator: Locator,
    options?: Parameters<Locator['waitFor']>[0],
  ): Promise<void> {
    await locator.waitFor({
      state: 'attached',
      ...options,
    });
  }

  static async waitForVisible(
    locator: Locator,
    options?: Parameters<Locator['waitFor']>[0],
  ): Promise<void> {
    await locator.waitFor({
      state: 'visible',
      ...options,
    });
  }

  // The element may still exist in the DOM.
  static async waitForHidden(
    locator: Locator,
    options?: Parameters<Locator['waitFor']>[0],
  ): Promise<void> {
    await locator.waitFor({
      state: 'hidden',
      ...options,
    });
  }

  static async waitForDetached(
    locator: Locator,
    options?: Parameters<Locator['waitFor']>[0],
  ): Promise<void> {
    await locator.waitFor({
      state: 'detached',
      ...options,
    });
  }
}
