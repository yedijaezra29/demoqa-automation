import type { Locator, Page } from '@playwright/test';

export type FormField = 'First Name' | 'Last Name' | 'Email' | 'Mobile';

const FIELD_PLACEHOLDER: Record<FormField, string> = {
  'First Name': 'First Name',
  'Last Name': 'Last Name',
  Email: 'name@example.com',
  Mobile: 'Mobile Number',
};

export class PracticeFormLocators {
  constructor(private readonly page: Page) {}

  field(name: FormField): Locator {
    return this.page.getByPlaceholder(FIELD_PLACEHOLDER[name], {
      exact: true,
    });
  }

  get genderGroup(): Locator {
    return this.page.locator('#genterWrapper');
  }

  gender(value: string): Locator {
    return this.genderGroup.getByText(value, { exact: true });
  }

  get dateOfBirth(): Locator {
    return this.page.locator('#dateOfBirthInput');
  }

  get datePicker(): Locator {
    return this.page.locator('.react-datepicker');
  }

  get monthSelect(): Locator {
    return this.datePicker.locator('.react-datepicker__month-select');
  }

  get yearSelect(): Locator {
    return this.datePicker.locator('.react-datepicker__year-select');
  }

  day(day: number): Locator {
    return this.datePicker.locator(
      `.react-datepicker__day--${String(day).padStart(3, '0')}:not(.react-datepicker__day--outside-month)`,
    );
  }

  get subjects(): Locator {
    return this.page.locator('#subjectsInput');
  }

  option(name: string): Locator {
    return this.page.getByRole('option', { name, exact: true });
  }

  hobby(name: string): Locator {
    return this.page
      .locator('#hobbiesWrapper')
      .getByText(name, { exact: true });
  }

  get picture(): Locator {
    return this.page.locator('#uploadPicture');
  }

  get address(): Locator {
    return this.page.getByPlaceholder('Current Address');
  }

  get state(): Locator {
    return this.page.locator('#state');
  }

  get city(): Locator {
    return this.page.locator('#city');
  }

  get invalidFields(): Locator {
    return this.page.locator('#userForm :invalid');
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: 'Submit' });
  }

  get confirmation(): Locator {
    return this.page.getByRole('dialog', {
      name: 'Thanks for submitting the form',
    });
  }

  confirmationValue(label: string): Locator {
    return this.confirmation
      .getByRole('row')
      .filter({
        has: this.page.getByRole('cell', { name: label, exact: true }),
      })
      .getByRole('cell')
      .nth(1);
  }
}
