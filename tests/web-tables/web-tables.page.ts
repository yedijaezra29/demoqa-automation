import { expect, type Page } from '@playwright/test';

import type { User } from '../../test-data/test-data.ts';
import { WebTablesLocators, type UserField } from './web-tables.locators.ts';
import { INVALID_RED } from '../support/validation.ts';

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
    await this.page.goto('/webtables', { waitUntil: 'domcontentloaded' });
    await this.locators.rows.first().waitFor();
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
      await this.locators.form.waitFor({ state: 'hidden' });
    } catch {
      const rejected = await this.rejectedFields();

      throw new Error(
        `Form Registration tidak tertutup setelah Submit untuk ${user.email}. Field yang ditolak: ${rejected.join(', ') || 'tidak diketahui'}`,
      );
    }
  }

  async openAddForm(): Promise<void> {
    await this.locators.addButton.click();
    await this.locators.form.waitFor();
  }

  async fillAddForm(user: User): Promise<void> {
    await this.openAddForm();
    await this.locators.field('First Name').fill(user.firstName);
    await this.locators.field('Last Name').fill(user.lastName);
    await this.locators.field('Email').fill(user.email);
    await this.locators.field('Age').fill(user.age);
    await this.locators.field('Salary').fill(user.salary);
    await this.locators.field('Department').fill(user.department);
  }

  async changeField(name: UserField, value: string): Promise<void> {
    await this.locators.field(name).fill(value);
  }

  async submitAddForm(): Promise<void> {
    await this.locators.submitButton.click();
  }

  async search(text: string): Promise<void> {
    await this.locators.searchBox.fill(text);
  }

  async deleteUser(email: string): Promise<void> {
    await this.locators.deleteButton(email).click();
  }

  async verifyUsersShown(users: User[], rowsBefore: number): Promise<void> {
    await this.locators.pageSize.selectOption(String(MAX_ROWS_PER_PAGE));
    await expect(this.locators.rows).toHaveCount(rowsBefore + users.length);

    for (const user of users) {
      await expect(this.locators.cellsByEmail(user.email)).toHaveText([
        user.firstName,
        user.lastName,
        user.age,
        user.email,
        user.salary,
        user.department,
        '',
      ]);
    }
  }

  async verifyOnlyUserShown(email: string): Promise<void> {
    await expect(this.locators.rows).toHaveCount(1);
    await expect(this.locators.rowByEmail(email)).toBeVisible();
  }

  async verifyNoUserShown(): Promise<void> {
    await expect(this.locators.rows).toHaveCount(0);
  }

  async verifyUserDeleted(email: string, rowsBefore: number): Promise<void> {
    await expect(this.locators.rowByEmail(email)).toHaveCount(0);
    await expect(this.locators.rows).toHaveCount(rowsBefore - 1);
  }

  async verifyAddFormRejected(
    fields: UserField[],
    rowsBefore: number,
  ): Promise<void> {
    for (const field of fields) {
      await expect(this.locators.field(field)).toHaveCSS(
        'border-color',
        INVALID_RED,
      );
    }
    await expect(this.locators.invalidFields).not.toHaveCount(0);
    await expect(this.locators.form).toBeVisible();
    await expect(this.locators.rows).toHaveCount(rowsBefore);
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
