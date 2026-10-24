import { Given, Then, When } from '@cucumber/cucumber';

import { pick, testData } from '../../test-data/test-data.ts';
import { WebTablesPage } from './web-tables.page.ts';
import type { TestWorld } from '../support/world.ts';

const webTablesPage = (world: TestWorld): WebTablesPage =>
  new WebTablesPage(world.page);

Given('user membuka halaman Web Tables', async function (this: TestWorld) {
  const page = webTablesPage(this);

  await page.open();
  this.rowsBefore = await page.countRows();
});

Given(
  'user menambahkan semua user dari data test',
  async function (this: TestWorld) {
    this.addedUsers = testData.webTables().users;
    this.log(
      `${this.addedUsers.length} user dibaca dari test-data/web-tables.json`,
    );
    await webTablesPage(this).addUsers(this.addedUsers);
  },
);

When(
  'user mencari salah satu user lewat kotak search',
  async function (this: TestWorld) {
    await webTablesPage(this).search(testData.webTables().search.keyword);
  },
);

When(
  'user mencari nama yang tidak ada di tabel',
  async function (this: TestWorld) {
    await webTablesPage(this).search(testData.webTables().searchWithoutResult);
  },
);

When('user menghapus salah satu user', async function (this: TestWorld) {
  await webTablesPage(this).deleteUser(testData.webTables().userToDelete);
});

When(
  'user mengisi form Add dengan {string}',
  async function (this: TestWorld, caseName: string) {
    const data = testData.webTables();
    const invalid = pick(data.invalidInputs, caseName);
    const page = webTablesPage(this);

    this.rejectedUserField = invalid.field;
    await page.fillAddForm(data.newUser);
    await page.changeField(invalid.field, invalid.value);
  },
);

When('user menekan Submit di form Add', async function (this: TestWorld) {
  await webTablesPage(this).submitAddForm();
});

When(
  'user menekan Submit di form Add tanpa mengisi apa pun',
  async function (this: TestWorld) {
    const page = webTablesPage(this);

    await page.openAddForm();
    await page.submitAddForm();
  },
);

Then('semua user tersebut tampil di tabel', async function (this: TestWorld) {
  await webTablesPage(this).verifyUsersShown(this.addedUsers, this.rowsBefore);
});

Then(
  'tabel hanya menampilkan user yang dicari',
  async function (this: TestWorld) {
    await webTablesPage(this).verifyOnlyUserShown(
      testData.webTables().search.expectedEmail,
    );
  },
);

Then('tabel tidak menampilkan user apa pun', async function (this: TestWorld) {
  await webTablesPage(this).verifyNoUserShown();
});

Then('user tersebut hilang dari tabel', async function (this: TestWorld) {
  await webTablesPage(this).verifyUserDeleted(
    testData.webTables().userToDelete,
    this.rowsBefore,
  );
});

Then('form Add menolak isian tersebut', async function (this: TestWorld) {
  await webTablesPage(this).verifyAddFormRejected(
    this.rejectedUserField ? [this.rejectedUserField] : [],
    this.rowsBefore,
  );
});

Then(
  'form Add menolak semua field yang kosong',
  async function (this: TestWorld) {
    await webTablesPage(this).verifyAllAddFieldsRejected(this.rowsBefore);
  },
);
