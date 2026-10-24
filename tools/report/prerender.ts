import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

const THUMBNAIL_WIDTH = 480;

export async function prerender(file: string): Promise<string> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(file).href);

    return await page.evaluate(async (thumbnailWidth) => {
      if (document.querySelector('.fatal')) {
        throw new Error(document.querySelector('.fatal')?.textContent ?? '');
      }

      const thumbnails = [
        ...document.querySelectorAll<HTMLImageElement>('#gallery .shot img'),
      ];
      for (const img of thumbnails) {
        await img.decode();
        const scale = Math.min(1, thumbnailWidth / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas
          .getContext('2d')
          ?.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = canvas.toDataURL('image/jpeg', 0.8);
      }

      const data = document.getElementById('execution-data');
      if (data) {
        const payload = JSON.parse(data.textContent ?? '{}');
        delete payload.assets;
        data.textContent = JSON.stringify(payload).replace(/<\//g, '<\\/');
      }

      document.documentElement.classList.add('no-js');
      document.documentElement.setAttribute('data-prerendered', '');
      return `<!doctype html>\n${document.documentElement.outerHTML}`;
    }, THUMBNAIL_WIDTH);
  } finally {
    await browser.close();
  }
}
