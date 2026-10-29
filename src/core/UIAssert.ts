import type { Locator, Page } from 'playwright';

export class UIAssert {
  private static readonly DEFAULT_TIMEOUT = 5000;
  private static readonly POLL_INTERVAL = 100;

  // Retries until the assertion passes or the timeout runs out, always trying at least once.
  // Cucumber prints only `message`, so the last attempt's detail is appended to it.
  private static async poll(
    assertion: () => Promise<void>,
    errorMessage: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    const startTime = Date.now();
    let lastError: unknown;
    let attempts = 0;

    for (;;) {
      attempts += 1;
      try {
        await assertion();
        return;
      } catch (error) {
        lastError = error;

        if (UIAssert.isFatal(error)) break;

        const remaining = timeout - (Date.now() - startTime);
        if (remaining <= 0) break;

        await new Promise<void>((resolve) =>
          setTimeout(resolve, Math.min(UIAssert.POLL_INTERVAL, remaining)),
        );
      }
    }

    const elapsedMs = Date.now() - startTime;
    const detail =
      lastError instanceof Error
        ? lastError.message
        : String(lastError ?? 'assertion failed without an error message');

    throw new Error(
      `${errorMessage} | last attempt: ${detail} | attempts: ${attempts}, elapsed: ${elapsedMs}ms, timeout: ${timeout}ms`,
      { cause: lastError },
    );
  }

  // Errors that retrying cannot fix: strict mode violations and a closed page, context, or browser.
  private static isFatal(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('strict mode violation')) return true;

    return /(target|page|context|browser|connection)[\w\s]*closed/i.test(
      message,
    );
  }

  static async visible(
    locator: Locator,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        if (!(await locator.isVisible())) {
          throw new Error('Element is not visible');
        }
      },
      `${elementName} should be visible`,
      timeout,
    );
  }

  // Passes when the element is hidden or not in the DOM at all.
  static async hidden(
    locator: Locator,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        if (await locator.isVisible()) {
          throw new Error('Element is still visible');
        }
      },
      `${elementName} should be hidden`,
      timeout,
    );
  }

  static async attached(
    locator: Locator,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        if ((await locator.count()) === 0) {
          throw new Error('Element is not attached');
        }
      },
      `${elementName} should be attached to the DOM`,
      timeout,
    );
  }

  static async detached(
    locator: Locator,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        if ((await locator.count()) > 0) {
          throw new Error('Element is still attached');
        }
      },
      `${elementName} should be detached from the DOM`,
      timeout,
    );
  }

  static async count(
    locator: Locator,
    expectedCount: number,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const actualCount = await locator.count();

        if (actualCount !== expectedCount) {
          throw new Error(`Expected ${expectedCount}, received ${actualCount}`);
        }
      },
      `${elementName} should have ${expectedCount} element(s)`,
      timeout,
    );
  }

  // Ignores leading and trailing whitespace.
  static async text(
    locator: Locator,
    expectedText: string,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const actualText = (await locator.textContent())?.trim() ?? '';

        if (actualText !== expectedText) {
          throw new Error(
            `Expected "${expectedText}", received "${actualText}"`,
          );
        }
      },
      `${elementName} should display "${expectedText}"`,
      timeout,
    );
  }

  // Compares the trimmed text of every matched element, in order.
  static async texts(
    locator: Locator,
    expectedTexts: string[],
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    const expected = JSON.stringify(expectedTexts);

    await UIAssert.poll(
      async () => {
        const actualTexts = (await locator.allTextContents()).map((text) =>
          text.trim(),
        );
        const actual = JSON.stringify(actualTexts);

        if (actual !== expected) {
          throw new Error(`Expected ${expected}, received ${actual}`);
        }
      },
      `${elementName} should display ${expected}`,
      timeout,
    );
  }

  static async containsText(
    locator: Locator,
    expectedText: string,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const actualText = (await locator.textContent()) ?? '';

        if (!actualText.includes(expectedText)) {
          throw new Error(
            `Expected text to contain "${expectedText}", received "${actualText}"`,
          );
        }
      },
      `${elementName} should contain text "${expectedText}"`,
      timeout,
    );
  }

  static async notContainsText(
    locator: Locator,
    unexpectedText: string,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const actualText = (await locator.textContent()) ?? '';

        if (actualText.includes(unexpectedText)) {
          throw new Error(
            `Unexpected text "${unexpectedText}" found in "${actualText}"`,
          );
        }
      },
      `${elementName} should not contain "${unexpectedText}"`,
      timeout,
    );
  }

  static async value(
    locator: Locator,
    expectedValue: string,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const actualValue = await locator.inputValue();

        if (actualValue !== expectedValue) {
          throw new Error(
            `Expected "${expectedValue}", received "${actualValue}"`,
          );
        }
      },
      `${elementName} should have value "${expectedValue}"`,
      timeout,
    );
  }

  static async attribute(
    locator: Locator,
    attributeName: string,
    expectedValue: string,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const actualValue = await locator.getAttribute(attributeName);

        if (actualValue !== expectedValue) {
          throw new Error(
            `Expected ${attributeName}="${expectedValue}", received "${actualValue}"`,
          );
        }
      },
      `${elementName} should have ${attributeName}="${expectedValue}"`,
      timeout,
    );
  }

  // Reads the computed style, so colors come back as rgb(...).
  static async css(
    locator: Locator,
    propertyName: string,
    expectedValue: string,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const actualValue = await locator.evaluate(
          (element, property) =>
            getComputedStyle(element).getPropertyValue(property),
          propertyName,
        );

        if (actualValue !== expectedValue) {
          throw new Error(
            `Expected ${propertyName}="${expectedValue}", received "${actualValue}"`,
          );
        }
      },
      `${elementName} should have CSS ${propertyName}="${expectedValue}"`,
      timeout,
    );
  }

  static async className(
    locator: Locator,
    expectedClass: string,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const className = await locator.getAttribute('class');
        const classes = (className ?? '').split(/\s+/).filter(Boolean);

        if (!classes.includes(expectedClass)) {
          throw new Error(`Class "${expectedClass}" was not found`);
        }
      },
      `${elementName} should have class "${expectedClass}"`,
      timeout,
    );
  }

  static async notClassName(
    locator: Locator,
    unexpectedClass: string,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const className = await locator.getAttribute('class');
        const classes = (className ?? '').split(/\s+/).filter(Boolean);

        if (classes.includes(unexpectedClass)) {
          throw new Error(`Class "${unexpectedClass}" is still present`);
        }
      },
      `${elementName} should not have class "${unexpectedClass}"`,
      timeout,
    );
  }

  // Checks the rendered size on screen, in CSS pixels.
  static async size(
    locator: Locator,
    expected: { width: number; height: number },
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const box = await locator.boundingBox();
        const actual = box ? `${box.width} × ${box.height}` : 'not rendered';

        if (box?.width !== expected.width || box.height !== expected.height) {
          throw new Error(
            `Expected ${expected.width} × ${expected.height}, received ${actual}`,
          );
        }
      },
      `${elementName} should be ${expected.width} × ${expected.height} px`,
      timeout,
    );
  }

  static async enabled(
    locator: Locator,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        if (!(await locator.isEnabled())) {
          throw new Error('Element is disabled');
        }
      },
      `${elementName} should be enabled`,
      timeout,
    );
  }

  static async disabled(
    locator: Locator,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        if (!(await locator.isDisabled())) {
          throw new Error('Element is enabled');
        }
      },
      `${elementName} should be disabled`,
      timeout,
    );
  }

  static async checked(
    locator: Locator,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        if (!(await locator.isChecked())) {
          throw new Error('Element is not checked');
        }
      },
      `${elementName} should be checked`,
      timeout,
    );
  }

  static async unchecked(
    locator: Locator,
    elementName: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        if (await locator.isChecked()) {
          throw new Error('Element is checked');
        }
      },
      `${elementName} should be unchecked`,
      timeout,
    );
  }

  static async urlContains(
    page: Page,
    expectedPath: string,
    timeout: number = UIAssert.DEFAULT_TIMEOUT,
  ): Promise<void> {
    await UIAssert.poll(
      async () => {
        const actualPath = new URL(page.url()).pathname;

        if (!actualPath.endsWith(expectedPath)) {
          throw new Error(
            `Expected pathname to end with "${expectedPath}", received "${actualPath}"`,
          );
        }
      },
      `URL pathname should end with "${expectedPath}"`,
      timeout,
    );
  }
}
