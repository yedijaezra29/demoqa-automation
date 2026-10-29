const MATCHER_PHRASE: Record<string, string> = {
  toHaveText: 'Teks tidak sesuai',
  toContainText: 'Teks tidak memuat yang diharapkan',
  toHaveValue: 'Isi field tidak sesuai',
  toHaveCount: 'Jumlah elemen tidak sesuai',
  toHaveCSS: 'Nilai CSS tidak sesuai',
  toHaveClass: 'Class elemen tidak sesuai',
  toHaveAttribute: 'Atribut elemen tidak sesuai',
  toHaveURL: 'URL halaman tidak sesuai',
  toBeVisible: 'Elemen tidak terlihat di layar',
  toBeHidden: 'Elemen masih terlihat, seharusnya tidak ada',
  toBeEnabled: 'Elemen nonaktif, seharusnya bisa dipakai',
  toBeDisabled: 'Elemen masih aktif, seharusnya nonaktif',
  toBeChecked: 'Elemen belum dicentang',
  toMatchObject: 'Nilai tidak sesuai',
  toEqual: 'Nilai tidak sesuai',
  toBe: 'Nilai tidak sesuai',
  toBeGreaterThan: 'Nilai lebih kecil dari yang diharapkan',
};

const ACTION_NAME: Record<string, string> = {
  click: 'mengklik',
  dblclick: 'mengklik dua kali',
  fill: 'mengisi',
  pressSequentially: 'mengetik di',
  press: 'menekan tombol di',
  selectOption: 'memilih opsi di',
  setInputFiles: 'mengunggah file ke',
  dragTo: 'menyeret',
  hover: 'mengarahkan kursor ke',
  check: 'mencentang',
  textContent: 'membaca teks',
  boundingBox: 'mengukur',
  goto: 'membuka halaman',
};

const WAIT_STATE: Record<string, string> = {
  visible: 'Elemen tidak muncul',
  hidden: 'Elemen masih terlihat',
  attached: 'Elemen tidak ada di halaman',
  detached: 'Elemen masih ada di halaman',
};

const LOCATOR_KIND: Record<string, string> = {
  Text: 'teks',
  Label: 'label',
  Placeholder: 'placeholder',
  TestId: 'test id',
};

const UI_ASSERT_PHRASE: [RegExp, string][] = [
  [/ should display [["]/, 'Teks tidak sesuai'],
  [/ should contain text "/, 'Teks tidak memuat yang diharapkan'],
  [/ should not contain "/, 'Teks memuat yang seharusnya tidak ada'],
  [/ should have value "/, 'Isi field tidak sesuai'],
  [/ should have \d+ element\(s\)$/, 'Jumlah elemen tidak sesuai'],
  [/ should have CSS /, 'Nilai CSS tidak sesuai'],
  [/ should have class "/, 'Class elemen tidak sesuai'],
  [/ should not have class "/, 'Class elemen masih ada, seharusnya tidak'],
  [/ should have [\w-]+="/, 'Atribut elemen tidak sesuai'],
  [/ should be \d+ × \d+ px$/, 'Ukuran elemen tidak sesuai'],
  [/ should be visible$/, 'Elemen tidak terlihat di layar'],
  [/ should be hidden$/, 'Elemen masih terlihat, seharusnya tidak ada'],
  [/ should be attached to the DOM$/, 'Elemen tidak ada di halaman'],
  [/ should be detached from the DOM$/, 'Elemen masih ada di halaman'],
  [/ should be enabled$/, 'Elemen nonaktif, seharusnya bisa dipakai'],
  [/ should be disabled$/, 'Elemen masih aktif, seharusnya nonaktif'],
  [/ should be checked$/, 'Elemen belum dicentang'],
  [/ should be unchecked$/, 'Elemen masih dicentang'],
  [/^URL pathname should end with /, 'URL halaman tidak sesuai'],
];

// Format from src/core/UIAssert.ts: "<what should hold> | last attempt: <detail> | attempts: ...".
const UI_ASSERT =
  /^(.*?) \| last attempt: ([\s\S]*) \| attempts: \d+, elapsed: \d+ms, timeout: \d+ms\s*$/;

const MAX_VALUE_LENGTH = 160;

export function reasons(message: string | undefined): string[] {
  if (!message) {
    return ['Gagal tanpa pesan error'];
  }

  const body = stripAnsi(message)
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => !/^\s+at /.test(line));
  const head = (body[0] ?? '')
    .replace(/^\s*(Error|AssertionError|TimeoutError):\s*/, '')
    .trim();

  return (
    uiAssertReasons([head, ...body.slice(1)].join('\n').replace(/\n+$/, '')) ??
    expectReasons(head, body) ??
    timeoutReasons(head, body) ?? [shorten(head || 'Gagal tanpa pesan error')]
  );
}

function uiAssertReasons(message: string): string[] | undefined {
  const match = UI_ASSERT.exec(message);
  if (!match) {
    return undefined;
  }

  const [, claim, detail] = match;
  const phrase =
    UI_ASSERT_PHRASE.find(([pattern]) => pattern.test(claim))?.[1] ??
    shorten(claim);
  const element = claim.startsWith('URL ')
    ? undefined
    : claim.split(' should ')[0];
  const found: string[] = [];

  if (/Timeout \d+ms exceeded|element\(s\) not found/.test(detail)) {
    found.push(`${phrase}, elemen tidak ditemukan di halaman`);
  } else {
    found.push(phrase);
    const values =
      /^Expected (?:text to contain |pathname to end with )?([\s\S]+?), received ([\s\S]+)$/.exec(
        detail,
      );
    if (values) {
      for (const [want, got] of valuePairs(values[1], values[2])) {
        found.push(`Seharusnya: ${shorten(want)}`, `Tertulis: ${shorten(got)}`);
      }
    }
  }

  if (element) {
    found.push(`Elemen: ${element}`);
  }
  return found;
}

// For UIAssert.texts, show only the cells that differ instead of the whole row.
function valuePairs(want: string, got: string): [string, string][] {
  const expected = parseList(want);
  const received = parseList(got);
  if (!expected || !received) {
    return [[want, got]];
  }

  const pairs: [string, string][] = [];
  for (
    let index = 0;
    index < Math.max(expected.length, received.length);
    index++
  ) {
    if (expected[index] !== received[index]) {
      pairs.push([
        quote(expected[index]) ?? '(tidak ada)',
        quote(received[index]) ?? '(tidak ada)',
      ]);
    }
  }
  return pairs.length ? pairs : [[want, got]];
}

function parseList(text: string): string[] | undefined {
  if (!text.startsWith('[')) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value.map(String) : undefined;
  } catch {
    return undefined;
  }
}

function quote(value: string | undefined): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}

function expectReasons(head: string, body: string[]): string[] | undefined {
  const match = /^expect\((\w+)\)\.(\w+)\(.*?\)(?: failed)?$/.exec(head);
  if (!match) {
    return undefined;
  }

  const phrase =
    MATCHER_PHRASE[match[2]] ?? `Pemeriksaan ${match[2]} tidak terpenuhi`;
  const locator = field(body, 'Locator');
  const expected =
    field(body, 'Expected') ??
    field(body, 'Expected substring') ??
    field(body, 'Expected pattern');
  const received = field(body, 'Received') ?? field(body, 'Received string');
  const found: string[] = [];

  if (body.some((line) => line.includes('element(s) not found'))) {
    found.push(`${phrase}, elemen tidak ditemukan di halaman`);
  } else {
    found.push(phrase);
    const pairs =
      expected !== undefined && received !== undefined
        ? [[expected, received]]
        : diffPairs(body);
    for (const [want, got] of pairs) {
      found.push(`Seharusnya: ${shorten(want)}`, `Tertulis: ${shorten(got)}`);
    }
  }

  if (locator) {
    found.push(`Elemen: ${describeLocator(locator)}`);
  }
  return found;
}

function timeoutReasons(head: string, body: string[]): string[] | undefined {
  const functionTimeout =
    /function timed out.*?within (\d+) milliseconds/i.exec(head);
  if (functionTimeout) {
    return [
      `Step melewati batas waktu ${Number(functionTimeout[1]) / 1000} detik`,
    ];
  }

  const network = /^page\.goto: (net::\S+)/.exec(head);
  if (network) {
    return [`Halaman tidak bisa dibuka (${network[1]})`];
  }

  const timeout = /^(?:locator|page)\.(\w+): Timeout (\d+)ms exceeded/.exec(
    head,
  );
  if (!timeout) {
    return undefined;
  }

  const seconds = Number(timeout[2]) / 1000;
  const waiting = body
    .map((line) => /- waiting for (.+)$/.exec(line.trim())?.[1])
    .find(Boolean);
  const state = waiting && / to be (\w+)$/.exec(waiting)?.[1];
  const target = waiting?.replace(/ to be \w+$/, '');
  const found =
    timeout[1] === 'waitFor'
      ? [
          `${WAIT_STATE[state || 'visible'] ?? 'Elemen tidak siap'} setelah ${seconds} detik`,
        ]
      : [
          `Tidak bisa ${ACTION_NAME[timeout[1]] ?? timeout[1]} dalam ${seconds} detik`,
        ];

  if (body.some((line) => line.includes('intercepts pointer events'))) {
    found.push('Elemen tertutup elemen lain, misalnya iklan atau popup');
  }
  if (target) {
    found.push(`Elemen: ${describeLocator(target)}`);
  }
  return found;
}

export function describeLocator(locator: string): string {
  const readable = locator
    .replace(/\.(?=getBy|locator\(|filter\(|nth\(|first\(|last\()/g, ' › ')
    .replace(
      /getByRole\('([^']+)'(?:, \{ name: '((?:[^'\\]|\\.)*)'(?:, exact: true)? \})?\)/g,
      (_, role: string, name?: string) =>
        name === undefined ? role : `${role} "${name}"`,
    )
    .replace(
      /getBy(Text|Label|Placeholder|TestId)\('((?:[^'\\]|\\.)*)'(?:, \{ exact: true \})?\)/g,
      (_, kind: string, value: string) =>
        `${LOCATOR_KIND[kind] ?? kind} "${value}"`,
    )
    .replace(/locator\('((?:[^'\\]|\\.)*)'\)/g, '$1')
    .replace(/ › filter\(\{ has: (.+?) \}\)/g, ' yang berisi $1')
    .replace(
      / › nth\((\d+)\)/g,
      (_, index: string) => ` ke-${Number(index) + 1}`,
    )
    .replace(/ › first\(\)/g, ' pertama')
    .replace(/ › last\(\)/g, ' terakhir');

  return /getBy|filter\(|locator\(/.test(readable) ? locator : readable;
}

function field(body: string[], name: string): string | undefined {
  const prefix = `${name}:`;
  const line = body.find((candidate) => candidate.startsWith(prefix));
  return line?.slice(prefix.length).trim();
}

function diffPairs(body: string[]): [string, string][] {
  const removed: string[] = [];
  const added: string[] = [];

  for (const line of body) {
    if (/^[-+] (Expected|Received)\s+[-+] \d+$/.test(line)) {
      continue;
    }
    const minus = /^-\s{2,}(.*?),?$/.exec(line);
    const plus = /^\+\s{2,}(.*?),?$/.exec(line);
    if (minus) {
      removed.push(minus[1]);
    } else if (plus) {
      added.push(plus[1]);
    }
  }

  return Array.from(
    { length: Math.max(removed.length, added.length) },
    (_, index) => [
      removed[index] ?? '(tidak ada)',
      added[index] ?? '(tidak ada)',
    ],
  );
}

function shorten(text: string): string {
  return text.length > MAX_VALUE_LENGTH
    ? `${text.slice(0, MAX_VALUE_LENGTH - 1)}…`
    : text;
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}
