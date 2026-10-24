try {
  process.loadEnvFile();
} catch {}

const browsers = ['chromium', 'firefox', 'webkit'] as const;

type BrowserName = (typeof browsers)[number];

const screenshotModes = {
  true: 'all',
  expected: 'expected',
  false: 'failure',
} as const;

type ScreenshotMode = (typeof screenshotModes)[keyof typeof screenshotModes];

function browserName(value = 'chromium'): BrowserName {
  if (!browsers.includes(value as BrowserName)) {
    throw new Error(
      `BROWSER="${value}" tidak didukung, pilih salah satu: ${browsers.join(', ')}`,
    );
  }
  return value as BrowserName;
}

function screenshotMode(value = 'expected'): ScreenshotMode {
  const mode =
    screenshotModes[value.toLowerCase() as keyof typeof screenshotModes];

  if (!mode) {
    throw new Error(
      `STEP_SCREENSHOT="${value}" tidak didukung, pilih salah satu: ${Object.keys(screenshotModes).join(', ')}`,
    );
  }
  return mode;
}

export const env = {
  baseUrl: process.env.BASE_URL ?? 'https://demoqa.com',
  browser: browserName(process.env.BROWSER),
  headless: (process.env.HEADLESS ?? 'true').toLowerCase() !== 'false',
  timeout: Number(process.env.DEFAULT_TIMEOUT ?? 15000),
  screenshot: screenshotMode(process.env.STEP_SCREENSHOT),
  locale: 'en-US',
  viewport: { width: 1366, height: 900 },
};
