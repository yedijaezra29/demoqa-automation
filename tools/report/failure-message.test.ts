import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeLocator, reasons } from './failure-message.ts';

const STACK =
  '    at TestWorld.<anonymous> (/repo/tests/steps/example.steps.ts:11:63)';

test('toHaveText with one value', () => {
  assert.deepEqual(
    reasons(
      [
        'Error: expect(locator).toHaveText(expected) failed',
        '',
        "Locator: locator('#droppable')",
        'Expected: "Dropped!!"',
        'Received: "Dropped!"',
        'Timeout: 15000ms',
        STACK,
      ].join('\n'),
    ),
    [
      'Teks tidak sesuai',
      'Seharusnya: "Dropped!!"',
      'Tertulis: "Dropped!"',
      'Elemen: #droppable',
    ],
  );
});

test('toHaveText with an array diff', () => {
  assert.deepEqual(
    reasons(
      [
        'Error: expect(locator).toHaveText(expected) failed',
        '',
        "Locator: getByRole('row').getByRole('cell')",
        'Timeout: 15000ms',
        '- Expected  - 1',
        '+ Received  + 1',
        '',
        '  Array [',
        '    "Cierra",',
        '-   "Vegaa",',
        '+   "Vega",',
        '  ]',
        STACK,
      ].join('\n'),
    ),
    [
      'Teks tidak sesuai',
      'Seharusnya: "Vegaa"',
      'Tertulis: "Vega"',
      'Elemen: row › cell',
    ],
  );
});

test('toHaveCount keeps the locator', () => {
  assert.deepEqual(
    reasons(
      [
        'Error: expect(locator).toHaveCount(expected) failed',
        '',
        "Locator:  getByRole('row')",
        'Expected: 9',
        'Received: 8',
        STACK,
      ].join('\n'),
    ),
    [
      'Jumlah elemen tidak sesuai',
      'Seharusnya: 9',
      'Tertulis: 8',
      'Elemen: row',
    ],
  );
});

test('toBeVisible on a missing element', () => {
  assert.deepEqual(
    reasons(
      [
        'Error: expect(locator).toBeVisible() failed',
        '',
        "Locator: getByRole('button', { name: 'Simpan' })",
        'Expected: visible',
        'Timeout: 15000ms',
        'Error: element(s) not found',
        STACK,
      ].join('\n'),
    ),
    [
      'Elemen tidak terlihat di layar, elemen tidak ditemukan di halaman',
      'Elemen: button "Simpan"',
    ],
  );
});

test('toMatchObject on a plain value', () => {
  assert.deepEqual(
    reasons(
      [
        'Error: expect(received).toMatchObject(expected)',
        '',
        '- Expected  - 1',
        '+ Received  + 1',
        '',
        '  Object {',
        '-   "height": 200,',
        '+   "height": 150,',
        '    "width": 400,',
        '  }',
        STACK,
      ].join('\n'),
    ),
    [
      'Nilai tidak sesuai',
      'Seharusnya: "height": 200',
      'Tertulis: "height": 150',
    ],
  );
});

test('click timeout names the action and the element', () => {
  assert.deepEqual(
    reasons(
      [
        'locator.click: Timeout 15000ms exceeded.',
        'Call log:',
        "  - waiting for getByRole('button', { name: 'Submit' })",
        STACK,
      ].join('\n'),
    ),
    ['Tidak bisa mengklik dalam 15 detik', 'Elemen: button "Submit"'],
  );
});

test('waitFor hidden timeout', () => {
  assert.deepEqual(
    reasons(
      [
        'locator.waitFor: Timeout 15000ms exceeded.',
        'Call log:',
        "  - waiting for getByRole('dialog') to be hidden",
        '    14 × locator resolved to visible <div role="dialog">…</div>',
      ].join('\n'),
    ),
    ['Elemen masih terlihat setelah 15 detik', 'Elemen: dialog'],
  );
});

test('long locators read as a path', () => {
  assert.equal(
    describeLocator(
      "getByRole('dialog', { name: 'Thanks' }).getByRole('row').filter({ has: getByRole('cell', { name: 'Gender', exact: true }) }).getByRole('cell').nth(1)",
    ),
    'dialog "Thanks" › row yang berisi cell "Gender" › cell ke-2',
  );
});

test('plain errors stay as they are', () => {
  assert.deepEqual(reasons('Error: Resizable box is not visible\n' + STACK), [
    'Resizable box is not visible',
  ]);
  assert.deepEqual(reasons(undefined), ['Gagal tanpa pesan error']);
});
