import { readFileSync } from 'node:fs';

import type { DroppableTab } from '../tests/droppable/droppable.locators.ts';
import type { FormField } from '../tests/practice-form/practice-form.locators.ts';
import type { UserField } from '../tests/web-tables/web-tables.locators.ts';

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  age: string;
  salary: string;
  department: string;
}

interface WebTablesData {
  users: User[];
  newUser: User;
  search: { keyword: string; expectedEmail: string };
  searchWithoutResult: string;
  userToDelete: string;
  invalidInputs: Record<string, { field: UserField; value: string }>;
}

export interface DroppableData {
  acceptedText: string;
  emptyText: Record<DroppableTab, string>;
}

export interface Size {
  width: number;
  height: number;
}

interface ResizableData {
  sizes: Record<string, { drag: Size; expected: Size }>;
}

export interface Student {
  firstName: string;
  lastName: string;
  email: string;
  gender: string;
  mobile: string;
  dateOfBirth: { day: number; month: string; year: number };
  subjects: string[];
  hobbies: string[];
  picture: string;
  address: string;
  state: string;
  city: string;
}

export type RequiredField = FormField | 'Gender';

export interface InvalidInput {
  field: RequiredField;
  value?: string;
}

interface PracticeFormData {
  student: Student;
  confirmation: Record<string, string>;
  requiredOnlyConfirmation: Record<string, string>;
  longMobile: { typed: string; saved: string };
  requiredFields: RequiredField[];
  invalidInputs: Record<string, InvalidInput>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export const testData = {
  webTables: (): WebTablesData => readJson('test-data/web-tables.json'),
  droppable: (): DroppableData => readJson('test-data/droppable.json'),
  resizable: (): ResizableData => readJson('test-data/resizable.json'),
  practiceForm: (): PracticeFormData =>
    readJson('test-data/practice-form.json'),
};

export function pick<T>(cases: Record<string, T>, name: string): T {
  const found = cases[name];

  if (!found) {
    throw new Error(
      `Kasus "${name}" tidak ada di data test. Pilihan: ${Object.keys(cases).join(', ')}`,
    );
  }
  return found;
}
