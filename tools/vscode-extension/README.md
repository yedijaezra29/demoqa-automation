# Demoqa Tests (VS Code extension)

Shows this repo's Cucumber scenarios in the VS Code **Testing** panel (the flask icon in the Activity Bar).

The extension's menus and messages are in Indonesian, like the rest of the project. Labels below are written exactly as they appear, with the English meaning in parentheses.

- A tree of Feature → Scenario (TC tag and title) → Step. Click a scenario or step to open its line in the `.feature` file.
- Each test case shows ✔ passed, ✘ failed, or ○ not run, updated while the run is in progress. The counter at the top of the panel also counts test cases, for example 0/28 at the start and 28/28 at the end. The data comes from `reports/messages.ndjson`, so runs started from a normal terminal (`npm test`, `npm run test:raw`) show up too.
- A failed test case shows the reason in plain words, the same as the terminal output, for example `Teks tidak sesuai: seharusnya "Female", tertulis "Male"` (text does not match: expected "Female", actual "Male"). The message points at the failed step's line in the `.feature` file.
- Click a red item to see the **Call Stack** in the peek panel (for example `WebTablesPage.addUser  web-tables.page.ts:46`). Click a frame to open the file at that line. The same frames are written to the **Test Results** tab.
- The Run button on a scenario runs `npm run test:raw -- --tags '@FORM-01'` in a terminal named `Demoqa Test`. Running a feature uses the feature's tag (for example `@webtables`).
- Every time you press Run (including Run All and ▶ on a Test Suite), the previous results are cleared, so there is no need to click Clear All Results first.
- The Run All button at the top of the panel asks first: **Berdasarkan tag…** (by tag, for example `@WEBTABLES-01 or @FORM-01`), one feature, or **Semua skenario** (all scenarios).
- If a run is still going, the Run button shows a warning, because two runs at once write to the same results file.

## Test Suites

The **Test Suites** section in the Testing panel keeps groups of scenarios you often run together. The repo ships with four suites: **Regresi** (regression, every scenario), **Smoke** (one main scenario per page), **Positif** (positive), and **Negatif** (negative).

- **Create**: the `+` button in the Test Suites header. Enter a name, then pick scenarios (type a tag or title, check several, press Enter).
- **Add**: the `+` button on a suite row, or right-click a feature or scenario in the Test Explorer → **Tambah ke Test Suite…** (add to Test Suite).
- **Check**: only checked scenarios run.
- **Run**: the ▶ button on a suite row. Scenarios run in the order listed in the suite.
- **Order**: drag a scenario onto another scenario, or onto the suite name to move it to the bottom. Right-click a suite → **Urutkan Sesuai File .feature** (sort by .feature file) or **Urutkan Sesuai Nomor TC** (sort by TC number) to restore an order.
- **Remove / rename / delete**: the `×` button on a scenario row removes it; right-click a suite for **Ganti Nama** (rename) and **Hapus Test Suite** (delete Test Suite). The `.feature` files are never deleted.

Suites are saved in `test-suites.json` in the project root, and they also run from the terminal with `npm run suite -- <suite name>`. To share suites, copy that file. If a scenario's title changes, its suite row is marked ⚠ and skipped during runs.

## Install

The ready-to-use file is in this folder: `demoqa-tests.vsix`.

```bash
code --install-extension tools/vscode-extension/demoqa-tests.vsix
```

If the terminal says `command not found: code`, open the Extensions panel, the `…` menu → **Install from VSIX…**, and pick the file above. After installing, run **Developer: Reload Window**. Open the repo folder as the workspace root; the extension activates when `cucumber.mjs` is in the root.

## Rebuild

```bash
cd tools/vscode-extension
npm ci
npm run package
code --install-extension demoqa-tests.vsix --force
```

## Settings

`demoqaTests.runCommand` (default `npm run test:raw`): the command the Run button runs. Set it to `npm test` if every run from VS Code should also build the HTML report. This setting can only be changed in User Settings.

## Security

- The extension only activates in trusted folders (Workspace Trust), because the Run button runs npm commands.
- Tags, scenario titles, and paths are wrapped in single quotes, and the tag input rejects shell characters such as `$`, `;`, and backticks.
- The extension does not use the network. It only reads `features/**/*.feature` and `reports/messages.ndjson`.

## Limitations

- Not yet tried on Windows.
- The spinner stops by itself only when VS Code terminal shell integration is on (the default for zsh and bash). If it is off, click Stop after the run finishes.
