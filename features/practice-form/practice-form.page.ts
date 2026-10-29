import type { Locator, Page } from 'playwright';

import { env } from '../../src/config/env.ts';
import { INVALID_RED } from '../../src/config/validation.ts';
import { UIAction } from '../../src/core/UIAction.ts';
import { UIAssert } from '../../src/core/UIAssert.ts';
import type {
  InvalidInput,
  RequiredField,
  Student,
} from '../../test-data/test-data.ts';
import {
  PracticeFormLocators,
  type FormField,
} from './practice-form.locators.ts';

const CONFIRMATION_TITLE = 'Thanks for submitting the form';

export class PracticeFormPage {
  private readonly locators: PracticeFormLocators;

  constructor(private readonly page: Page) {
    this.locators = new PracticeFormLocators(page);
  }

  async open(): Promise<void> {
    await UIAction.goto(this.page, `${env.baseUrl}/automation-practice-form`, {
      waitUntil: 'domcontentloaded',
    });
    await UIAction.waitForVisible(this.locators.field('First Name'));
  }

  async fillAllFields(student: Student): Promise<void> {
    await this.fillRequiredFields(student);
    await UIAction.inputText(this.locators.field('Email'), student.email);
    await this.pickSubjects(student.subjects);
    await this.pickHobbies(student.hobbies);
    await UIAction.uploadFile(this.locators.picture, student.picture);
    await UIAction.inputText(this.locators.address, student.address);
    await this.pickStateAndCity(student.state, student.city);
    await this.pickDateOfBirth(student.dateOfBirth);
  }

  async fillRequiredFields(
    student: Student,
    { withGender = true } = {},
  ): Promise<void> {
    await UIAction.inputText(
      this.locators.field('First Name'),
      student.firstName,
    );
    await UIAction.inputText(
      this.locators.field('Last Name'),
      student.lastName,
    );
    if (withGender) {
      await UIAction.click(this.locators.gender(student.gender));
    }
    await UIAction.inputText(this.locators.field('Mobile'), student.mobile);
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
    await UIAction.inputText(
      this.locators.field(invalid.field),
      invalid.value ?? '',
    );
  }

  async submit(): Promise<void> {
    await UIAction.click(this.locators.submitButton);
  }

  async verifyFieldValue(field: FormField, value: string): Promise<void> {
    await UIAssert.value(this.locators.field(field), value, `Field ${field}`);
  }

  async verifyConfirmation(expected: Record<string, string>): Promise<void> {
    const popup = this.locators.confirmation;

    await UIAssert.visible(popup, 'Popup konfirmasi');
    await UIAssert.css(popup, 'opacity', '1', 'Popup konfirmasi');
    await UIAssert.containsText(popup, CONFIRMATION_TITLE, 'Popup konfirmasi');

    for (const [label, value] of Object.entries(expected)) {
      await UIAssert.text(
        this.locators.confirmationValue(label),
        value,
        `Nilai ${label} di popup konfirmasi`,
      );
    }
  }

  async verifyRejected(fields: RequiredField[]): Promise<void> {
    for (const field of fields) {
      await UIAssert.css(
        this.validationMark(field),
        field === 'Gender' ? 'color' : 'border-color',
        INVALID_RED,
        `Field ${field}`,
      );
    }
    await UIAssert.attached(this.locators.invalidFields, 'Field yang ditolak');
    await UIAssert.hidden(this.locators.confirmation, 'Popup konfirmasi');
  }

  private validationMark(field: RequiredField): Locator {
    return field === 'Gender'
      ? this.locators.gender('Male')
      : this.locators.field(field);
  }

  private async pickSubjects(subjects: string[]): Promise<void> {
    for (const subject of subjects) {
      await UIAction.type(this.locators.subjects, subject);
      await UIAction.click(this.locators.option(subject));
    }
  }

  private async pickHobbies(hobbies: string[]): Promise<void> {
    for (const hobby of hobbies) {
      await UIAction.click(this.locators.hobby(hobby));
    }
  }

  private async pickStateAndCity(state: string, city: string): Promise<void> {
    await UIAction.click(this.locators.state);
    await UIAction.click(this.locators.option(state));
    await UIAction.click(this.locators.city);
    await UIAction.click(this.locators.option(city));
  }

  private async pickDateOfBirth({
    day,
    month,
    year,
  }: Student['dateOfBirth']): Promise<void> {
    await UIAction.click(this.locators.dateOfBirth);
    await UIAction.selectOption(this.locators.monthSelect, month);
    await UIAction.selectOption(this.locators.yearSelect, String(year));
    await UIAction.click(this.locators.day(day));
    await UIAction.waitForHidden(this.locators.datePicker);
  }
}
