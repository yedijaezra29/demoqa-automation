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
    expectReasons(head, body) ??
    timeoutReasons(head, body) ?? [shorten(head || 'Gagal tanpa pesan error')]
  );
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
