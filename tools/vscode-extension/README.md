# Demoqa Tests (extension VS Code)

Menampilkan skenario Cucumber repo ini di panel **Testing** VS Code (ikon labu di Activity Bar).

- Pohon Feature → Skenario (tag TC dan judul) → Step. Klik skenario atau step untuk membuka barisnya di file `.feature`.
- Status ✔ lolos, ✘ gagal, ○ tidak dijalankan per test case, diperbarui selama run berjalan. Penghitung di atas panel juga per test case, misalnya 0/28 saat mulai lalu 28/28 saat selesai. Sumbernya `reports/messages.ndjson`, jadi run dari terminal biasa (`npm test`, `npm run test:raw`) juga ikut tampil.
- Test case yang gagal menampilkan alasan gagal dalam kalimat biasa, sama dengan output terminal, misalnya `Teks tidak sesuai: seharusnya "Female", tertulis "Male"`. Pesan itu menunjuk baris step yang gagal di file `.feature`.
- Klik item merah untuk melihat **Call Stack** di panel peek (mis. `WebTablesPage.addUser  web-tables.page.ts:35`). Klik frame untuk membuka file di baris itu. Frame yang sama ditulis di tab **Test Results**.
- Tombol Run di skenario menjalankan `npm run test:raw -- --tags '@FORM-01'` di terminal `Demoqa Test`. Run di feature memakai tag feature (mis. `@webtables`).
- Setiap kali Run ditekan (termasuk Run All dan ▶ di Test Suite), hasil run sebelumnya otomatis dihapus, jadi tidak perlu klik Clear All Results dulu.
- Tombol Run All di atas panel menampilkan pilihan dulu: **Berdasarkan tag…** (mis. `@WEBTABLES-01 or @FORM-01`), satu feature, atau **Semua skenario**.
- Kalau masih ada run yang berjalan, tombol Run menampilkan peringatan, karena dua run bersamaan menulis ke file hasil yang sama.

## Test Suite

Bagian **Test Suites** di panel Testing menyimpan kumpulan skenario yang sering dijalankan bersama. Repo ini sudah membawa empat suite: **Regresi** (semua skenario), **Smoke** (satu skenario utama per halaman), **Positif**, dan **Negatif**.

- **Buat**: tombol `+` di judul bagian Test Suites. Isi nama, lalu pilih skenario (ketik tag atau judul, centang beberapa, Enter).
- **Tambah**: tombol `+` di baris suite, atau klik kanan feature/skenario di Test Explorer → **Tambah ke Test Suite…**.
- **Centang**: hanya skenario yang dicentang yang dijalankan.
- **Jalankan**: tombol ▶ di baris suite. Skenario dijalankan sesuai urutan di suite.
- **Urutan**: seret skenario ke atas skenario lain, atau ke nama suite untuk menaruhnya paling bawah. Klik kanan suite → **Urutkan Sesuai File .feature** atau **Urutkan Sesuai Nomor TC** untuk mengembalikan urutan.
- **Keluarkan / ganti nama / hapus**: tombol `×` di baris skenario; klik kanan suite untuk Ganti Nama dan Hapus Test Suite. File `.feature` tidak ikut terhapus.

Suite disimpan di `test-suites.json` di folder utama project, dan bisa juga dijalankan dari terminal dengan `npm run suite -- <nama suite>`. Untuk berbagi suite, salin file itu. Kalau judul skenario diganti, baris suite ditandai ⚠ dan dilewati saat run.

## Pasang

File siap pakai ada di folder ini: `demoqa-tests.vsix`.

```bash
code --install-extension tools/vscode-extension/demoqa-tests.vsix
```

Kalau terminal menjawab `command not found: code`, buka panel Extensions, menu `…` → **Install from VSIX…**, lalu pilih file di atas. Setelah dipasang, jalankan **Developer: Reload Window**. Buka folder repo sebagai root workspace; extension aktif kalau ada `cucumber.mjs` di root.

## Build ulang

```bash
cd tools/vscode-extension
npm ci
npm run package
code --install-extension demoqa-tests.vsix --force
```

## Pengaturan

`demoqaTests.runCommand` (default `npm run test:raw`): command yang dijalankan tombol Run. Isi `npm test` kalau setiap run dari VS Code juga harus membuat report HTML. Pengaturan ini hanya bisa diubah di User Settings.

## Keamanan

- Extension hanya aktif di folder yang sudah dipercaya (Workspace Trust), karena tombol Run menjalankan command npm.
- Tag, judul skenario, dan path dikutip dengan tanda kutip tunggal, dan input tag menolak karakter shell seperti `$`, `;`, dan backtick.
- Extension tidak memakai jaringan. Yang dibaca hanya `features/**/*.feature` dan `reports/messages.ndjson`.

## Batasan

- Belum dicoba di Windows.
- Spinner berhenti otomatis hanya kalau shell integration terminal VS Code aktif (default untuk zsh dan bash). Kalau tidak aktif, klik Stop setelah run selesai.
