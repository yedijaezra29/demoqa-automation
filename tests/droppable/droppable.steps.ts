import { Given, Then, When } from '@cucumber/cucumber';

import { testData } from '../../test-data/test-data.ts';
import type { DroppableTab } from './droppable.locators.ts';
import { DroppablePage } from './droppable.page.ts';
import type { TestWorld } from '../support/world.ts';

const droppablePage = (world: TestWorld): DroppablePage =>
  new DroppablePage(world.page, world.droppableTab);

Given(
  'user membuka tab {string} di halaman Droppable',
  async function (this: TestWorld, tab: DroppableTab) {
    this.droppableTab = tab;
    await droppablePage(this).open();
  },
);

When(
  'user menyeret kotak {string} ke area target',
  async function (this: TestWorld, box: string) {
    await droppablePage(this).dragIntoDropBox(box);
  },
);

When(
  'user menyeret kotak {string} lalu melepasnya di luar area target',
  async function (this: TestWorld, box: string) {
    await droppablePage(this).dragOutsideDropBox(box);
  },
);

Then('area target menerima kotak tersebut', async function (this: TestWorld) {
  await droppablePage(this).verifyBoxAccepted(testData.droppable());
});

Then('area target tetap kosong', async function (this: TestWorld) {
  await droppablePage(this).verifyBoxNotAccepted(testData.droppable());
});
