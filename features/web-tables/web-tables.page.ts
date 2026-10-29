import type { Page } from 'playwright';

import { env } from '../../src/config/env.ts';
import { INVALID_RED } from '../../src/config/validation.ts';
import { UIAction } from '../../src/core/UIAction.ts';
import { UIAssert } from '../../src/core/UIAssert.ts';
import type { User } from '../../test-data/test-data.ts';
import { WebTablesLocators, type UserField } from './web-tables.locators.ts';

const MAX_ROWS_PER_PAGE = 50;

const ALL_FIELDS: UserField[] = [
  'First Name',
  'Last Name',
  'Email',
  'Age',
  'Salary',
  'Department',
];

export class WebTablesPage {
  private readonly locators: WebTablesLocators;

  constructor(private readonly page: Page) {
    this.locators = new WebTablesLocators(page);
  }

  async open(): Promise<void> {
    await UIAction.goto(this.page, `${env.baseUrl}/webtables`, {
      waitUntil: 'domcontentloaded',
    });
    await UIAction.waitForVisible(this.locators.rows.first());
  }

  async countRows(): Promise<number> {
    return this.locators.rows.count();
  }

  async addUsers(users: User[]): Promise<void> {
    for (const user of users) {
      await this.addUser(user);
    }
  }

  async addUser(user: User): Promise<void> {
    await this.fillAddForm(user);
    await this.submitAddForm();

    try {
      await UIAction.waitForHidden(this.locators.form);
    } catch {
      const rejected = await this.rejectedFields();

      throw new Error(
        `Form Registration tidak tertutup setelah Submit untuk ${user.email}. Field yang ditolak: ${rejected.join(', ') || 'tidak diketahui'}`,
      );
    }
  }

  async openAddForm(): Promise<void> {
    await UIAction.click(this.locators.addButton);
    await UIAction.waitForVisible(this.locators.form);
  }

  async fillAddForm(user: User): Promise<void> {
    await this.openAddForm();
    await UIAction.inputText(this.locators.field('First Name'), user.firstName);
    await UIAction.inputText(this.locators.field('Last Name'), user.lastName);
    await UIAction.inputText(this.locators.field('Email'), user.email);
    await UIAction.inputText(this.locators.field('Age'), user.age);
    await UIAction.inputText(this.locators.field('Salary'), user.salary);
    await UIAction.inputText(
      this.locators.field('Department'),
      user.department,
    );
  }

  async changeField(name: UserField, value: string): Promise<void> {
    await UIAction.inputText(this.locators.field(name), value);
  }

  async submitAddForm(): Promise<void> {
    await UIAction.click(this.locators.submitButton);
  }

  async search(text: string): Promise<void> {
    await UIAction.inputText(this.locators.searchBox, text);
  }

  async deleteUser(email: string): Promise<void> {
    await UIAction.click(this.locators.deleteButton(email));
  }

  async verifyUsersShown(users: User[], rowsBefore: number): Promise<void> {
    await UIAction.selectOption(
      this.locators.pageSize,
      String(MAX_ROWS_PER_PAGE),
    );
    await UIAssert.count(
      this.locators.rows,
      rowsBefore + users.length,
      'Baris tabel',
    );

    for (const user of users) {
      await UIAssert.texts(
        this.locators.cellsByEmail(user.email),
        [
          user.firstName,
          user.lastName,
          user.age,
          user.email,
          user.salary,
          user.department,
          '',
        ],
        `Baris user ${user.email}`,
      );
    }
  }

  async verifyOnlyUserShown(email: string): Promise<void> {
    await UIAssert.count(this.locators.rows, 1, 'Baris tabel');
    await UIAssert.visible(
      this.locators.rowByEmail(email),
      `Baris user ${email}`,
    );
  }

  async verifyNoUserShown(): Promise<void> {
    await UIAssert.count(this.locators.rows, 0, 'Baris tabel');
  }

  async verifyUserDeleted(email: string, rowsBefore: number): Promise<void> {
    await UIAssert.detached(
      this.locators.rowByEmail(email),
      `Baris user ${email}`,
    );
    await UIAssert.count(this.locators.rows, rowsBefore - 1, 'Baris tabel');
  }

  async verifyAddFormRejected(
    fields: UserField[],
    rowsBefore: number,
  ): Promise<void> {
    for (const field of fields) {
      await UIAssert.css(
        this.locators.field(field),
        'border-color',
        INVALID_RED,
        `Field ${field} di form Registration`,
      );
    }
    await UIAssert.attached(
      this.locators.invalidFields,
      'Field yang ditolak di form Registration',
    );
    await UIAssert.visible(this.locators.form, 'Form Registration');
    await UIAssert.count(this.locators.rows, rowsBefore, 'Baris tabel');
  }

  async verifyAllAddFieldsRejected(rowsBefore: number): Promise<void> {
    await this.verifyAddFormRejected(ALL_FIELDS, rowsBefore);
  }

  private async rejectedFields(): Promise<string[]> {
    return this.locators.invalidFields.evaluateAll((fields) =>
      fields.map((input) => (input as HTMLInputElement).placeholder),
    );
  }
}
