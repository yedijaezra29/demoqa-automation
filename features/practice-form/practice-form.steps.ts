import { Given, Then, When } from '@cucumber/cucumber';

import { pick, testData } from '../../test-data/test-data.ts';
import { PracticeFormPage } from './practice-form.page.ts';
import type { TestWorld } from '../../support/world.ts';

const practiceFormPage = (world: TestWorld): PracticeFormPage =>
  new PracticeFormPage(world.page);

Given(
  'user membuka halaman Student Registration Form',
  async function (this: TestWorld) {
    await practiceFormPage(this).open();
  },
);

When(
  'user mengisi semua field dengan data student',
  async function (this: TestWorld) {
    const { student } = testData.practiceForm();

    this.log(
      `Data student: ${student.firstName} ${student.lastName} (${student.email})`,
    );
    await practiceFormPage(this).fillAllFields(student);
  },
);

When('user hanya mengisi field wajib', async function (this: TestWorld) {
  await practiceFormPage(this).fillRequiredFields(
    testData.practiceForm().student,
  );
});

When(
  'user mengisi Mobile dengan lebih dari 10 digit',
  async function (this: TestWorld) {
    const { student, longMobile } = testData.practiceForm();

    await practiceFormPage(this).fillRequiredFields({
      ...student,
      mobile: longMobile.typed,
    });
  },
);

When(
  'user mengisi field wajib dengan {string}',
  async function (this: TestWorld, caseName: string) {
    const data = testData.practiceForm();
    const invalid = pick(data.invalidInputs, caseName);

    this.rejectedFormField = invalid.field;
    await practiceFormPage(this).fillRequiredFieldsWith(data.student, invalid);
  },
);

When('user menekan tombol Submit', async function (this: TestWorld) {
  await practiceFormPage(this).submit();
});

Then(
  'field Mobile hanya menyimpan 10 digit pertama',
  async function (this: TestWorld) {
    await practiceFormPage(this).verifyFieldValue(
      'Mobile',
      testData.practiceForm().longMobile.saved,
    );
  },
);

Then(
  'popup konfirmasi menampilkan semua data student',
  async function (this: TestWorld) {
    await practiceFormPage(this).verifyConfirmation(
      testData.practiceForm().confirmation,
    );
  },
);

Then(
  'popup konfirmasi hanya menampilkan data field wajib',
  async function (this: TestWorld) {
    await practiceFormPage(this).verifyConfirmation(
      testData.practiceForm().requiredOnlyConfirmation,
    );
  },
);

Then(
  'popup konfirmasi menampilkan Mobile 10 digit tersebut',
  async function (this: TestWorld) {
    await practiceFormPage(this).verifyConfirmation({
      Mobile: testData.practiceForm().longMobile.saved,
    });
  },
);

Then('form menolak isian tersebut', async function (this: TestWorld) {
  await practiceFormPage(this).verifyRejected(
    this.rejectedFormField ? [this.rejectedFormField] : [],
  );
});

Then(
  'form menolak semua field wajib yang kosong',
  async function (this: TestWorld) {
    await practiceFormPage(this).verifyRejected(
      testData.practiceForm().requiredFields,
    );
  },
);
