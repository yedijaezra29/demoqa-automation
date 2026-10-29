import { Given, Then, When } from '@cucumber/cucumber';

import { pick, testData } from '../../test-data/test-data.ts';
import { ResizablePage } from './resizable.page.ts';
import type { TestWorld } from '../../support/world.ts';

const resizablePage = (world: TestWorld): ResizablePage =>
  new ResizablePage(world.page);

const sizeCase = (name: string) => pick(testData.resizable().sizes, name);

Given('user membuka halaman Resizable', async function (this: TestWorld) {
  await resizablePage(this).open();
});

When(
  'user menarik sudut kotak sampai {string} piksel',
  async function (this: TestWorld, size: string) {
    this.resizeCase = size;
    await resizablePage(this).resizeTo(sizeCase(size).drag);
  },
);

Then(
  /^ukuran kotak (?:sesuai yang diharapkan|tertahan di batas yang diizinkan)$/,
  async function (this: TestWorld) {
    await resizablePage(this).verifySize(sizeCase(this.resizeCase).expected);
  },
);
