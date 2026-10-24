import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import * as vscode from 'vscode';

export interface SuiteEntry {
  feature: string;
  name: string;
  tag?: string;
  checked: boolean;
}

export interface Suite {
  name: string;
  entries: SuiteEntry[];
}

export interface ScenarioRef {
  item: vscode.TestItem;
  feature: string;
  featureName: string;
  name: string;
  tag?: string;
}

interface SuiteHost {
  scenarios(): ScenarioRef[];
  run(items: vscode.TestItem[]): Promise<void>;
}

type Node = { suite: Suite } | { suite: Suite; entry: SuiteEntry };

type EntryNode = { suite: Suite; entry: SuiteEntry };

const MIME = 'application/vnd.code.tree.demoqatestsuites';

const TC_NUMBER = /-(\d+)(?:_(\d+))?$/;

export const SUITES_FILE = 'test-suites.json';

class SuiteStore {
  readonly file: string;
  suites: Suite[] = [];

  constructor(root: string) {
    this.file = join(root, SUITES_FILE);
    this.load();
  }

  load(): void {
    if (!existsSync(this.file)) {
      this.suites = [];
      return;
    }
    try {
      const data = JSON.parse(readFileSync(this.file, 'utf8')) as {
        suites?: Suite[];
      };
      this.suites = (data.suites ?? []).filter(
        (suite) =>
          typeof suite.name === 'string' && Array.isArray(suite.entries),
      );
    } catch {
      this.suites = [];
    }
  }

  save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(
      this.file,
      `${JSON.stringify({ suites: this.suites }, null, 2)}\n`,
    );
  }

  find(name: string): Suite | undefined {
    return this.suites.find((suite) => suite.name === name);
  }
}

class SuiteTree implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(
    private readonly store: SuiteStore,
    private readonly host: SuiteHost,
  ) {}

  refresh(): void {
    this.changed.fire(undefined);
  }

  getChildren(node?: Node): Node[] {
    if (!node) {
      return this.store.suites.map((suite) => ({ suite }));
    }
    return 'entry' in node
      ? []
      : node.suite.entries.map((entry) => ({ suite: node.suite, entry }));
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (!('entry' in node)) {
      const checked = node.suite.entries.filter((entry) => entry.checked);
      const item = new vscode.TreeItem(
        node.suite.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.description = `${checked.length}/${node.suite.entries.length} dicentang`;
      item.contextValue = 'suite';
      item.iconPath = new vscode.ThemeIcon('checklist');
      item.checkboxState =
        node.suite.entries.length > 0 &&
        checked.length === node.suite.entries.length
          ? vscode.TreeItemCheckboxState.Checked
          : vscode.TreeItemCheckboxState.Unchecked;
      return item;
    }

    const { entry } = node;
    const ref = resolve(this.host.scenarios(), entry);
    const item = new vscode.TreeItem(
      entry.tag ? `${entry.tag.slice(1)}  ${entry.name}` : entry.name,
    );
    item.contextValue = 'entry';
    item.checkboxState = entry.checked
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
    if (ref) {
      item.description = ref.featureName;
      item.tooltip = `${entry.feature}:${(ref.item.range?.start.line ?? 0) + 1}`;
      if (ref.item.uri && ref.item.range) {
        item.command = {
          command: 'vscode.open',
          title: 'Buka skenario',
          arguments: [ref.item.uri, { selection: ref.item.range }],
        };
      }
    } else {
      item.description = 'tidak ditemukan di file .feature';
      item.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('problemsWarningIcon.foreground'),
      );
      item.tooltip = `${entry.feature}: skenario "${entry.name}" sudah dihapus atau diganti judulnya. Hapus dari suite atau tambahkan lagi.`;
    }
    return item;
  }
}

export function registerSuites(
  context: vscode.ExtensionContext,
  root: string,
  host: SuiteHost,
): SuiteTree {
  const store = new SuiteStore(root);
  const tree = new SuiteTree(store, host);
  const view = vscode.window.createTreeView<Node>('demoqaTestSuites', {
    treeDataProvider: tree,
    showCollapseAll: true,
    manageCheckboxStateManually: true,
    canSelectMany: true,
    dragAndDropController: {
      dragMimeTypes: [MIME],
      dropMimeTypes: [MIME],
      handleDrag: (source, data) => {
        dragged = source.filter((node): node is EntryNode => 'entry' in node);
        data.set(MIME, new vscode.DataTransferItem(dragged.length));
      },
      handleDrop: (target, data) => {
        if (target && data.get(MIME) && dragged.length > 0) {
          change(() => moveEntries(store, dragged, target));
        }
        dragged = [];
      },
    },
  });
  let dragged: EntryNode[] = [];

  const change = (update: () => void): void => {
    update();
    store.save();
    tree.refresh();
  };

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(root, SUITES_FILE),
  );
  const reload = (): void => {
    store.load();
    tree.refresh();
  };
  watcher.onDidChange(reload);
  watcher.onDidCreate(reload);
  watcher.onDidDelete(reload);

  view.onDidChangeCheckboxState((event) =>
    change(() => {
      for (const [node, state] of event.items) {
        const checked = state === vscode.TreeItemCheckboxState.Checked;
        if ('entry' in node) {
          node.entry.checked = checked;
        } else {
          node.suite.entries.forEach((entry) => (entry.checked = checked));
        }
      }
    }),
  );

  const askName = (title: string, value = ''): Thenable<string | undefined> =>
    vscode.window
      .showInputBox({
        title,
        value,
        prompt: 'Nama test suite',
        placeHolder: 'Regresi, Smoke, ...',
        validateInput: (name) =>
          !name.trim()
            ? 'Nama tidak boleh kosong'
            : name.trim() !== value && store.find(name.trim())
              ? 'Nama ini sudah dipakai suite lain'
              : undefined,
      })
      .then((name) => name?.trim());

  const createSuite = async (): Promise<Suite | undefined> => {
    const name = await askName('Test suite baru');
    if (!name) {
      return undefined;
    }
    const suite: Suite = { name, entries: [] };
    change(() => store.suites.push(suite));
    return suite;
  };

  const addRefs = (suite: Suite, refs: ScenarioRef[]): void =>
    change(() => {
      for (const ref of refs) {
        if (!suite.entries.some((entry) => same(entry, ref))) {
          suite.entries.push({
            feature: ref.feature,
            name: ref.name,
            ...(ref.tag ? { tag: ref.tag } : {}),
            checked: true,
          });
        }
      }
    });

  const pickScenarios = async (suite: Suite): Promise<void> => {
    const refs = host
      .scenarios()
      .filter((ref) => !suite.entries.some((entry) => same(entry, ref)));
    if (refs.length === 0) {
      void vscode.window.showInformationMessage(
        `Semua skenario sudah ada di "${suite.name}"`,
      );
      return;
    }
    type Pick = vscode.QuickPickItem & { ref?: ScenarioRef };
    const items: Pick[] = [];
    let feature = '';
    for (const ref of refs) {
      if (ref.feature !== feature) {
        feature = ref.feature;
        items.push({
          label: ref.featureName,
          kind: vscode.QuickPickItemKind.Separator,
        });
      }
      items.push({
        label: ref.tag ? ref.tag.slice(1) : ref.name,
        description: ref.tag ? ref.name : undefined,
        ref,
      });
    }
    const picked = await vscode.window.showQuickPick(items, {
      title: `Tambah skenario ke "${suite.name}"`,
      placeHolder: 'Ketik tag atau judul, centang lalu Enter',
      canPickMany: true,
      matchOnDescription: true,
    });
    if (picked?.length) {
      addRefs(
        suite,
        picked.flatMap((pick) => (pick.ref ? [pick.ref] : [])),
      );
    }
  };

  const runSuite = async (node?: Node): Promise<void> => {
    const suite = node?.suite;
    if (!suite) {
      return;
    }
    const refs = host.scenarios();
    const checked = suite.entries.filter((entry) => entry.checked);
    const items = checked.flatMap((entry) => {
      const ref = resolve(refs, entry);
      return ref ? [ref.item] : [];
    });
    if (items.length === 0) {
      void vscode.window.showWarningMessage(
        `Tidak ada skenario yang dicentang di "${suite.name}"`,
      );
      return;
    }
    const missing = checked.length - items.length;
    if (missing > 0) {
      const answer = await vscode.window.showWarningMessage(
        `${missing} skenario di "${suite.name}" tidak ditemukan`,
        {
          modal: true,
          detail:
            'Skenario itu sudah dihapus atau judulnya diganti di file .feature. Lanjutkan tanpa skenario itu?',
        },
        'Lanjutkan',
      );
      if (answer !== 'Lanjutkan') {
        return;
      }
    }
    await host.run(items);
  };

  context.subscriptions.push(
    view,
    watcher,
    vscode.commands.registerCommand('demoqaTests.suite.create', async () => {
      const suite = await createSuite();
      if (suite) {
        await pickScenarios(suite);
      }
    }),
    vscode.commands.registerCommand('demoqaTests.suite.run', runSuite),
    vscode.commands.registerCommand('demoqaTests.suite.add', (node?: Node) =>
      node ? pickScenarios(node.suite) : undefined,
    ),
    vscode.commands.registerCommand(
      'demoqaTests.suite.rename',
      async (node?: Node) => {
        if (!node) {
          return;
        }
        const name = await askName('Ganti nama test suite', node.suite.name);
        if (name && name !== node.suite.name) {
          change(() => (node.suite.name = name));
        }
      },
    ),
    vscode.commands.registerCommand(
      'demoqaTests.suite.delete',
      async (node?: Node) => {
        if (!node) {
          return;
        }
        const answer = await vscode.window.showWarningMessage(
          `Hapus test suite "${node.suite.name}"?`,
          {
            modal: true,
            detail: 'Skenario dan file .feature tidak ikut terhapus.',
          },
          'Hapus',
        );
        if (answer === 'Hapus') {
          change(() => {
            store.suites = store.suites.filter((suite) => suite !== node.suite);
          });
        }
      },
    ),
    vscode.commands.registerCommand(
      'demoqaTests.suite.sortByFile',
      (node?: Node) => {
        if (node) {
          const refs = host.scenarios();
          const position = (entry: SuiteEntry): number => {
            const ref = resolve(refs, entry);
            return ref ? refs.indexOf(ref) : refs.length;
          };
          change(() => {
            node.suite.entries = [...node.suite.entries].sort(
              (a, b) => position(a) - position(b),
            );
          });
        }
      },
    ),
    vscode.commands.registerCommand(
      'demoqaTests.suite.sortByTc',
      (node?: Node) => {
        if (node) {
          change(() => {
            node.suite.entries = [...node.suite.entries].sort(
              (a, b) =>
                (a.tag ?? '')
                  .replace(TC_NUMBER, '')
                  .localeCompare((b.tag ?? '').replace(TC_NUMBER, '')) ||
                tcNumber(a) - tcNumber(b),
            );
          });
        }
      },
    ),
    vscode.commands.registerCommand(
      'demoqaTests.suite.remove',
      (node?: Node) => {
        if (node && 'entry' in node) {
          change(() => {
            node.suite.entries = node.suite.entries.filter(
              (entry) => entry !== node.entry,
            );
          });
        }
      },
    ),
    vscode.commands.registerCommand(
      'demoqaTests.suite.addFromExplorer',
      async (...items: vscode.TestItem[]) => {
        const ids = items.filter(Boolean).map((item) => item.id);
        const selected = host
          .scenarios()
          .filter((ref) =>
            ids.some(
              (id) =>
                id === ref.feature ||
                id === ref.item.id ||
                id.startsWith(`${ref.item.id}:`),
            ),
          );
        if (selected.length === 0) {
          return;
        }
        type Pick = vscode.QuickPickItem & { suite?: Suite };
        const picked = await vscode.window.showQuickPick<Pick>(
          [
            ...store.suites.map((suite) => ({
              label: suite.name,
              description: `${suite.entries.length} skenario`,
              suite,
            })),
            { label: '$(add) Test suite baru…' },
          ],
          {
            title: `Tambah ${selected.length} skenario ke test suite`,
            placeHolder: 'Pilih test suite',
          },
        );
        if (!picked) {
          return;
        }
        const suite = picked.suite ?? (await createSuite());
        if (suite) {
          addRefs(suite, selected);
        }
      },
    ),
  );
  return tree;
}

function same(entry: SuiteEntry, ref: ScenarioRef): boolean {
  return (
    entry.feature === ref.feature &&
    entry.name === ref.name &&
    entry.tag === ref.tag
  );
}

function resolve(
  refs: ScenarioRef[],
  entry: SuiteEntry,
): ScenarioRef | undefined {
  return (
    refs.find((ref) => same(entry, ref)) ??
    refs.find(
      (ref) =>
        entry.tag !== undefined &&
        ref.tag === entry.tag &&
        ref.name === entry.name,
    )
  );
}

function tcNumber(entry: SuiteEntry): number {
  const match = TC_NUMBER.exec(entry.tag ?? '');
  return match ? Number(match[1]) + Number(match[2] ?? 0) / 1000 : Infinity;
}

function moveEntries(
  store: SuiteStore,
  nodes: EntryNode[],
  target: Node,
): void {
  const suite = store.find(target.suite.name);
  if (!suite) {
    return;
  }
  const key = (entry: SuiteEntry): string =>
    `${entry.feature}\n${entry.name}\n${entry.tag ?? ''}`;
  const place = (node: EntryNode): number =>
    store.suites.indexOf(store.find(node.suite.name) ?? node.suite) * 100000 +
    node.suite.entries.indexOf(node.entry);
  const moving = [...nodes]
    .sort((a, b) => place(a) - place(b))
    .map((node) => node.entry);
  const movingKeys = new Set(moving.map(key));
  const targetKey = 'entry' in target ? key(target.entry) : undefined;
  if (targetKey && movingKeys.has(targetKey)) {
    return;
  }
  for (const node of nodes) {
    const from = store.find(node.suite.name);
    if (from) {
      from.entries = from.entries.filter(
        (entry) => key(entry) !== key(node.entry),
      );
    }
  }
  suite.entries = suite.entries.filter((entry) => !movingKeys.has(key(entry)));
  const index = targetKey
    ? suite.entries.findIndex((entry) => key(entry) === targetKey)
    : -1;
  suite.entries.splice(
    index === -1 ? suite.entries.length : index,
    0,
    ...moving.map((entry) => ({ ...entry })),
  );
}
