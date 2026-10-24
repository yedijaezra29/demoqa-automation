import type { Locator, Page } from '@playwright/test';

export type UserField =
  'First Name' | 'Last Name' | 'Email' | 'Age' | 'Salary' | 'Department';

export class WebTablesLocators {
  constructor(private readonly page: Page) {}

  get addButton(): Locator {
    return this.page.getByRole('button', { name: 'Add' });
  }

  get searchBox(): Locator {
    return this.page.getByPlaceholder('Type to search');
  }

  get form(): Locator {
    return this.page.getByRole('dialog');
  }

  field(name: UserField): Locator {
    const placeholder = name === 'Email' ? 'name@example.com' : name;

    return this.form.getByPlaceholder(placeholder, { exact: true });
  }

  get submitButton(): Locator {
    return this.form.getByRole('button', { name: 'Submit' });
  }

  get invalidFields(): Locator {
    return this.form.locator('input:invalid');
  }

  get pageSize(): Locator {
    return this.page.getByRole('combobox');
  }

  get rows(): Locator {
    return this.page
      .getByRole('table')
      .getByRole('rowgroup')
      .nth(1)
      .getByRole('row');
  }

  rowByEmail(email: string): Locator {
    return this.page
      .getByRole('table')
      .getByRole('row')
      .filter({
        has: this.page.getByRole('cell', { name: email, exact: true }),
      });
  }

  cellsByEmail(email: string): Locator {
    return this.rowByEmail(email).getByRole('cell');
  }

  deleteButton(email: string): Locator {
    return this.rowByEmail(email).getByTitle('Delete');
  }
}
