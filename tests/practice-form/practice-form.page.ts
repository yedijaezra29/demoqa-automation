import { expect, type Locator, type Page } from '@playwright/test';

import type {
  InvalidInput,
  RequiredField,
  Student,
} from '../../test-data/test-data.ts';
import {
  PracticeFormLocators,
  type FormField,
} from './practice-form.locators.ts';
import { INVALID_RED } from '../support/validation.ts';

const CONFIRMATION_TITLE = 'Thanks for submitting the form';

export class PracticeFormPage {
  private readonly locators: PracticeFormLocators;

  constructor(private readonly page: Page) {
    this.locators = new PracticeFormLocators(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/automation-practice-form', {
      waitUntil: 'domcontentloaded',
    });
    await this.locators.field('First Name').waitFor();
  }

  async fillAllFields(student: Student): Promise<void> {
    await this.fillRequiredFields(student);
    await this.locators.field('Email').fill(student.email);
    await this.pickSubjects(student.subjects);
    await this.pickHobbies(student.hobbies);
    await this.locators.picture.setInputFiles(student.picture);
    await this.locators.address.fill(student.address);
    await this.pickStateAndCity(student.state, student.city);
    await this.pickDateOfBirth(student.dateOfBirth);
  }

  async fillRequiredFields(
    student: Student,
    { withGender = true } = {},
  ): Promise<void> {
    await this.locators.field('First Name').fill(student.firstName);
    await this.locators.field('Last Name').fill(student.lastName);
    if (withGender) {
      await this.locators.gender(student.gender).click();
    }
    await this.locators.field('Mobile').fill(student.mobile);
  }

  async fillRequiredFieldsWith(
    student: Student,
    invalid: InvalidInput,
  ): Promise<void> {
    if (invalid.field === 'Gender') {
      await this.fillRequiredFields(student, { withGender: false });
      return;
    }

    await this.fillRequiredFields(student);
    await this.locators.field(invalid.field).fill(invalid.value ?? '');
  }

  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }

  async verifyFieldValue(field: FormField, value: string): Promise<void> {
    await expect(this.locators.field(field)).toHaveValue(value);
  }

  async verifyConfirmation(expected: Record<string, string>): Promise<void> {
    const popup = this.locators.confirmation;

    await expect(popup).toBeVisible();
    await expect(popup).toHaveCSS('opacity', '1');
    await expect(popup).toContainText(CONFIRMATION_TITLE);

    for (const [label, value] of Object.entries(expected)) {
      await expect(this.locators.confirmationValue(label)).toHaveText(value);
    }
  }

  async verifyRejected(fields: RequiredField[]): Promise<void> {
    for (const field of fields) {
      await expect(this.validationMark(field)).toHaveCSS(
        field === 'Gender' ? 'color' : 'border-color',
        INVALID_RED,
      );
    }
    await expect(this.locators.invalidFields).not.toHaveCount(0);
    await expect(this.locators.confirmation).toBeHidden();
  }

  private validationMark(field: RequiredField): Locator {
    return field === 'Gender'
      ? this.locators.gender('Male')
      : this.locators.field(field);
  }

  private async pickSubjects(subjects: string[]): Promise<void> {
    for (const subject of subjects) {
      await this.locators.subjects.pressSequentially(subject);
      await this.locators.option(subject).click();
    }
  }

  private async pickHobbies(hobbies: string[]): Promise<void> {
    for (const hobby of hobbies) {
      await this.locators.hobby(hobby).click();
    }
  }

  private async pickStateAndCity(state: string, city: string): Promise<void> {
    await this.locators.state.click();
    await this.locators.option(state).click();
    await this.locators.city.click();
    await this.locators.option(city).click();
  }

  private async pickDateOfBirth({
    day,
    month,
    year,
  }: Student['dateOfBirth']): Promise<void> {
    await this.locators.dateOfBirth.click();
    await this.locators.monthSelect.selectOption(month);
    await this.locators.yearSelect.selectOption(String(year));
    await this.locators.day(day).click();
    await this.locators.datePicker.waitFor({ state: 'hidden' });
  }
}
