# Demoqa Automation Test

Automation test untuk empat halaman di [demoqa.com](https://demoqa.com), ditulis dengan Playwright, TypeScript, dan Cucumber, memakai pola Page Object Model.

## Daftar isi

- [Yang dites](#yang-dites)
- [Cara menjalankan](#cara-menjalankan)
- [Daftar command](#daftar-command)
  - [Menjalankan test](#menjalankan-test)
  - [Menjalankan Test Suite](#menjalankan-test-suite)
  - [Mengatur report](#mengatur-report)
  - [Mengecek kode](#mengecek-kode)
  - [Mengganti pengaturan untuk satu kali jalan](#mengganti-pengaturan-untuk-satu-kali-jalan)
- [Output di terminal](#output-di-terminal)
  - [Contoh: mencari di mana test gagal](#contoh-mencari-di-mana-test-gagal)
- [Report HTML](#report-html)
- [Kenapa terminal dan report dibuat custom](#kenapa-terminal-dan-report-dibuat-custom)
  - [Terminal: bawaan dan custom](#terminal-bawaan-dan-custom)
  - [Report HTML: bawaan dan custom](#report-html-bawaan-dan-custom)
- [Mencari penyebab test yang gagal](#mencari-penyebab-test-yang-gagal)
- [Struktur folder](#struktur-folder)
- [Pengaturan](#pengaturan)
- [Extension VS Code (opsional)](#extension-vs-code-opsional)

## Yang dites

Ada 28 skenario: 11 positif (fitur bekerja seperti seharusnya) dan 17 negatif (aplikasi menolak isian atau aksi yang salah).

| Halaman                   | Positif                                                                                       | Negatif                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Web Tables                | Menambahkan 5 user sekaligus lalu mengecek semuanya di tabel, mencari user, menghapus user    | Search tanpa hasil, form Add menolak email tanpa @, First Name kosong, Age atau Salary berisi huruf, form kosong                  |
| Droppable                 | Kotak Drag Me diterima di tab Simple, kotak Acceptable diterima di tab Accept                 | Kotak dilepas di luar area target, kotak Not Acceptable ditolak di tab Accept                                                     |
| Resizable                 | Ukuran 400 × 200, ukuran minimum 150 × 150, dan maksimum 500 × 300                            | Ditarik melewati batas maksimum atau di bawah batas minimum, ukurannya tertahan di batas                                          |
| Student Registration Form | Semua field diisi, hanya field wajib diisi, Mobile lebih dari 10 digit dipotong jadi 10 digit | First Name atau Last Name kosong, Mobile kurang dari 10 digit atau berisi huruf, email tanpa @, Gender tidak dipilih, form kosong |

## Cara menjalankan

Komputer perlu Node.js versi 20.12 atau lebih baru. Semua command di bawah sama untuk macOS, Linux, dan Windows (Command Prompt atau PowerShell), dan cukup dijalankan dari terminal. Extension VS Code tidak wajib.

Install dependency sekali saja:

```bash
npm install
npx playwright install chromium
```

Jalankan semua test:

```bash
npm test
```

Setelah test selesai, report HTML terbuka sendiri di browser. Filenya ada di `reports/test-report.html`.

Untuk menjalankan satu test saja:

```bash
npm run test:webtables
npm run test:droppable
npm run test:resizable
npm run test:practice-form
```

Kalau ingin melihat browsernya bergerak, ubah `HEADLESS=true` jadi `HEADLESS=false` di file `.env`.

## Daftar command

Semua command dijalankan dari folder utama project.

### Menjalankan test

| Command                       | Fungsi                                                 |
| ----------------------------- | ------------------------------------------------------ |
| `npm test`                    | Jalankan semua test, lalu buat dan buka report HTML    |
| `npm run test:webtables`      | Jalankan test Web Tables saja                          |
| `npm run test:droppable`      | Jalankan test Droppable saja                           |
| `npm run test:resizable`      | Jalankan test Resizable saja                           |
| `npm run test:practice-form`  | Jalankan test Student Registration Form saja           |
| `npm test -- --tags @FORM-01` | Jalankan test berdasarkan tag                          |
| `npm run test:raw`            | Jalankan semua test tanpa membuat report (lebih cepat) |

Setiap skenario punya nomor TC (`@WEBTABLES-01` sampai `@WEBTABLES-09`, `@DROPPABLE-01` sampai `04`, `@RESIZABLE-01` sampai `05`, `@FORM-01` sampai `10`) dan tag `@positive` atau `@negative`. Beberapa contoh:

```bash
npm test -- --tags @positive
npm test -- --tags @negative
npm test -- --tags "@webtables and @negative"
npm test -- --tags "@WEBTABLES-01 or @FORM-01"
```

### Menjalankan Test Suite

| Command                              | Fungsi                                    |
| ------------------------------------ | ----------------------------------------- |
| `npm run suite`                      | Tampilkan daftar Test Suite               |
| `npm run suite -- Regresi`           | Jalankan suite Regresi, lalu buat report  |
| `npm run suite -- Smoke --no-report` | Jalankan suite Smoke tanpa membuat report |

Suite yang tersedia: Regresi (semua skenario), Smoke (satu skenario utama per halaman), Positif, dan Negatif. Skenario dijalankan sesuai urutan di suite.

Daftar suite ada di `test-suites.json`. Untuk membuat suite baru tanpa VS Code, salin salah satu suite di file itu, ganti `name`-nya, lalu atur daftar `entries`. Skenario yang `checked`-nya `false` dilewati.

### Mengatur report

| Command                | Fungsi                                       |
| ---------------------- | -------------------------------------------- |
| `npm run report`       | Buat ulang report dari hasil test terakhir   |
| `npm run report:open`  | Buka report terakhir di browser              |
| `npm run report:clean` | Hapus folder `reports/` beserta semua isinya |

### Mengecek kode

| Command                | Fungsi                                           |
| ---------------------- | ------------------------------------------------ |
| `npm run check`        | Cek tipe TypeScript, format kode, dan unit test  |
| `npm run typecheck`    | Cek tipe TypeScript saja                         |
| `npm run format`       | Rapikan format semua file                        |
| `npm run format:check` | Cek format tanpa mengubah file                   |
| `npm run test:unit`    | Jalankan unit test untuk pesan error di terminal |

### Mengganti pengaturan untuk satu kali jalan

Pengaturan di `.env` juga bisa diganti untuk satu kali jalan saja. Di macOS dan Linux, tulis di depan command:

```bash
HEADLESS=false npm run test:droppable
BROWSER=firefox npm test
PROGRESS=detail npm test
```

Di Windows PowerShell:

```powershell
$env:HEADLESS="false"; npm run test:droppable
```

Di Windows Command Prompt:

```bat
set HEADLESS=false&& npm run test:droppable
```

Di PowerShell dan Command Prompt, nilai itu berlaku sampai jendela terminal ditutup. Kalau ragu, cara yang sama untuk semua sistem adalah mengubah file `.env`.

`PROGRESS=detail` menampilkan step setiap test case di terminal, termasuk yang lolos.

## Output di terminal

Tampilan terminal di project ini dibuat sendiri oleh yedijaezra (custom) dan sudah dipakai di beberapa project selama bekerja, bukan output bawaan Cucumber. Setiap test case tampil satu baris: selama berjalan `▶ [2/28] FORM-02 ...`, lalu diganti hasilnya, misalnya `✔ [2/28] FORM-02  Mengisi field wajib saja sudah cukup untuk submit  3,1 dtk`.

Untuk test case yang gagal, terminal menampilkan semua step-nya (✔ lolos, ✘ gagal, ○ tidak dijalankan), alasan gagal dalam kalimat biasa, nilai yang diharapkan dan yang tertulis di halaman, lalu tiga lokasi yang bisa langsung dibuka (cmd+klik atau ctrl+klik di terminal VS Code):

- **Skenario**: baris di file `.feature`
- **Kode**: baris kode yang gagal, biasanya di file page
- **Step**: step definition yang menjalankannya

### Contoh: mencari di mana test gagal

Supaya terlihat cara kerjanya, buat satu test gagal dengan sengaja:

1. Buka `test-data/practice-form.json`. Di bagian `confirmation`, ganti `"Gender": "Male"` jadi `"Gender": "Female"`.
2. Jalankan:

   ```bash
   npm run test:raw -- --tags @FORM-01
   ```

3. Terminal menampilkan:

   ```
   ✘ [1/1] FORM-01  Mengisi semua field lalu submit  12,8 dtk
     ✔ Given user membuka halaman Student Registration Form  6,0 dtk
     ✔ When user mengisi semua field dengan data student  1,0 dtk
     ✔ And user menekan tombol Submit  0,0 dtk
     ✘ Then popup konfirmasi menampilkan semua data student  5,2 dtk
         Teks tidak sesuai
         Seharusnya: "Female"
         Tertulis:   "Male"
         Elemen:     dialog "Thanks for submitting the form" › row yang berisi cell "Gender" › cell ke-2
         Skenario:   tests/practice-form/practice-form.feature:11
         Kode:       tests/practice-form/practice-form.page.ts:82
         Step:       tests/practice-form/practice-form.steps.ts:72

   ────────────────────────────────────────────────────────────
   Selesai: 1 skenario dalam 0 mnt 13 dtk. 1 GAGAL

   Yang perlu dicek:
     ✘ FORM-01  Mengisi semua field lalu submit
         tests/practice-form/practice-form.feature:8
   ```

4. Cara membacanya:
   - Tiga step pertama lolos. Step `✘ Then popup konfirmasi menampilkan semua data student` adalah yang gagal.
   - Di bawahnya ada alasannya: test mengharapkan Gender "Female", tapi popup menulis "Male". `Elemen` menunjukkan bagian halaman yang dicek, yaitu sel kedua di baris Gender pada popup.
   - Tahan cmd (macOS) atau ctrl (Windows dan Linux), lalu klik salah satu lokasi untuk membuka file tepat di baris itu:
     - `Skenario` membuka step yang gagal di file `.feature`.
     - `Kode` membuka baris pengecekan yang gagal di file page.
     - `Step` membuka step definition yang memanggil pengecekan itu.
   - Di contoh ini aplikasinya benar dan yang salah adalah data expected-nya, jadi perbaikannya di `test-data/practice-form.json`.

5. Kembalikan `"Gender": "Female"` jadi `"Gender": "Male"`.

Klik lokasi ini berjalan di terminal bawaan VS Code. Di terminal lain kemampuannya berbeda-beda, jadi kalau tidak bisa diklik, buka file dan nomor barisnya secara manual.

Di akhir run selalu ada ringkasan dan daftar test case yang perlu dicek. Untuk melihat setiap step selama test berjalan, jalankan dengan `PROGRESS=detail`.

## Report HTML

Report HTML di project ini juga dibuat sendiri oleh yedijaezra (custom) dan sudah dipakai di beberapa project selama bekerja, bukan report bawaan Cucumber. `npm test` membuat `reports/test-report.html` dan membukanya di browser. Report ini satu file saja, jadi bisa dibuka dengan double-click atau dikirim ke orang lain tanpa server. Isinya:

- **Overview**: persentase lolos, hasil per halaman, test case yang gagal, dan durasi setiap test case.
- **Scenarios & Steps**: setiap test case dan step-nya, lengkap dengan status, durasi, log, pesan error, dan screenshot. Bisa dicari dan difilter per status.
- **Screenshots**: semua screenshot dalam satu galeri. Defaultnya diambil di setiap pengecekan hasil (step Then/And) dan saat test case gagal.
- **Errors & Warnings**: semua kegagalan dalam satu daftar, dengan stack trace yang memakai path relatif terhadap folder project.
- **Environment**: URL yang dites, browser, viewport, timeout, tag yang dipakai, dan versi Node.js, Cucumber, dan Playwright.

Tombol **Export PDF** di report menyimpan report sebagai PDF. Report dari run terakhir bisa dibuat ulang tanpa menjalankan test lagi dengan `npm run report`.

## Kenapa terminal dan report dibuat custom

Saya (yedijaezra) membuat tampilan terminal dan report sendiri karena bawaan Cucumber kurang jelas dibaca, terutama saat ada test yang gagal. Semua gambar di bawah diambil dari run yang sama: lima test case Student Registration Form, dengan FORM-01 sengaja dibuat gagal (Gender di data expected diganti jadi "Female").

### Terminal: bawaan dan custom

<table>
  <tr>
    <th width="50%">Bawaan Cucumber</th>
    <th width="50%">Custom</th>
  </tr>
  <tr>
    <td><img src="docs/images/terminal-bawaan.png" alt="Output terminal bawaan Cucumber saat FORM-01 gagal" width="100%"></td>
    <td><img src="docs/images/terminal-custom.png" alt="Output terminal custom saat FORM-01 gagal" width="100%"></td>
  </tr>
  <tr>
    <td valign="top">
      <ul>
        <li>Selama test berjalan hanya ada titik-titik, tanpa nama test case.</li>
        <li>Alasan gagal berupa pesan teknis Playwright yang panjang, lalu call log dan stack trace dari <code>node_modules</code>.</li>
      </ul>
    </td>
    <td valign="top">
      <ul>
        <li>Satu baris per test case, lengkap dengan nomor TC dan durasinya.</li>
        <li>Step test case yang gagal ditampilkan semua, dengan alasan gagal singkat dan nilai seharusnya dan tertulis.</li>
        <li>Tiga lokasi yang bisa diklik, lalu ringkasan dan daftar test yang perlu dicek.</li>
      </ul>
    </td>
  </tr>
</table>

### Report HTML: bawaan dan custom

<table>
  <tr>
    <th width="50%">Bawaan Cucumber</th>
    <th width="50%">Custom</th>
  </tr>
  <tr>
    <td><img src="docs/images/report-bawaan.png" alt="Report HTML bawaan Cucumber" width="100%"></td>
    <td><img src="docs/images/report-custom-overview.png" alt="Report HTML custom, halaman Overview" width="100%"></td>
  </tr>
  <tr>
    <td valign="top">
      <ul>
        <li>Daftar skenario dan step dengan statusnya, plus filter lolos atau gagal.</li>
        <li>Pesan error teknis ditampilkan apa adanya di bawah step yang gagal.</li>
        <li>Bagian atas menampilkan sistem operasi laptop.</li>
      </ul>
    </td>
    <td valign="top">
      <ul>
        <li>Halaman pertama langsung menunjukkan persentase lolos, jumlah per status, dan test yang perlu dicek.</li>
        <li>Ada daftar semua error di satu tempat dan tombol Export PDF.</li>
        <li>Bisa dibaca PM atau client tanpa membuka kode.</li>
      </ul>
    </td>
  </tr>
</table>

Report custom juga punya galeri yang mengumpulkan screenshot dari setiap pengecekan, termasuk saat test gagal. Report bawaan tidak punya galeri seperti ini.

<img src="docs/images/report-custom-screenshots.png" alt="Report HTML custom, galeri screenshot" width="100%">

## Mencari penyebab test yang gagal

Pesan gagal sengaja dibuat supaya siapa pun yang memakai atau merawat automation ini, bukan hanya pembuatnya, langsung tahu harus membuka file mana. Setiap kegagalan menunjuk tiga lokasi, dan masing-masing mewakili satu lapisan kode:

| Lokasi     | File                             | Isinya                                |
| ---------- | -------------------------------- | ------------------------------------- |
| `Skenario` | `tests/<fitur>/<fitur>.feature`  | Langkah test dalam bahasa sehari-hari |
| `Step`     | `tests/<fitur>/<fitur>.steps.ts` | Penghubung antara langkah dan page    |
| `Kode`     | `tests/<fitur>/<fitur>.page.ts`  | Aksi dan pengecekan di halaman        |

Alasan gagal di baris pertama biasanya sudah menunjukkan bagian mana yang perlu dicek:

| Alasan gagal                                                        | Yang biasanya perlu dicek                                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Teks tidak sesuai`                                                 | Nilai expected di `test-data/<fitur>.json`. Kalau datanya sudah benar, kemungkinan ada perubahan atau bug di aplikasi. |
| `Jumlah elemen tidak sesuai`                                        | Data test atau perilaku aplikasi, misalnya jumlah baris di tabel.                                                      |
| `Elemen tidak terlihat di layar, elemen tidak ditemukan di halaman` | Selector di `tests/<fitur>/<fitur>.locators.ts`. Biasanya tampilan halaman berubah.                                    |
| `Elemen tidak muncul setelah ... detik`                             | Selector, atau halaman yang sedang lambat.                                                                             |
| `Tidak bisa mengklik dalam ... detik`                               | Selector, atau elemen yang tertutup elemen lain seperti popup.                                                         |
| `Step ini belum punya step definition`                              | Langkah baru di file `.feature` yang belum ada pasangannya di file steps.                                              |
| `Halaman tidak bisa dibuka (...)`                                   | Koneksi internet atau situs demoqa yang sedang bermasalah.                                                             |

Stack trace lengkapnya tetap ada di report HTML (tab Errors & Warnings) dengan path relatif terhadap folder project, jadi bisa dicocokkan langsung dengan file di repo.

## Struktur folder

```
tests/
  web-tables/
    web-tables.feature      skenario dalam bahasa sehari-hari
    web-tables.steps.ts     step definition, menghubungkan skenario ke page
    web-tables.page.ts      aksi di halaman dan pengecekan hasil (verify)
    web-tables.locators.ts  selector elemen di halaman
  droppable/                susunan file yang sama
  resizable/                susunan file yang sama
  practice-form/            susunan file yang sama
  support/                  browser per skenario, world, dan pengaturan .env
test-data/                  data test per halaman dalam JSON, plus foto untuk upload
tools/                      report HTML, command suite, dan extension VS Code
docs/images/                gambar untuk README
test-suites.json            daftar Test Suite
```

Semua file untuk satu halaman ada di satu folder. Data test-nya ada di `test-data/` dengan nama yang sama, misalnya `test-data/web-tables.json`.

File `.feature` hanya berisi langkah dalam bahasa sehari-hari. Nilai yang diisi dan hasil yang diharapkan ada di file JSON, dan pengecekannya ada di method `verify...` di file page. Untuk menambah atau mengganti data, cukup ubah file JSON-nya.

## Pengaturan

Semua pengaturan ada di file `.env`:

| Pengaturan        | Isi awal             | Keterangan                                                                                      |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `BASE_URL`        | `https://demoqa.com` | Alamat situs yang dites                                                                         |
| `BROWSER`         | `chromium`           | Bisa juga `firefox` atau `webkit` (install dulu dengan `npx playwright install firefox webkit`) |
| `HEADLESS`        | `true`               | `false` untuk menampilkan browser                                                               |
| `DEFAULT_TIMEOUT` | `15000`              | Batas waktu menunggu elemen, dalam milidetik                                                    |
| `STEP_SCREENSHOT` | `expected`           | `expected`: screenshot di setiap pengecekan, `true`: semua step, `false`: hanya saat gagal      |
| `REPORT_OPEN`     | `true`               | `false` supaya report tidak dibuka otomatis                                                     |

## Extension VS Code (opsional)

Semua hal di atas bisa dijalankan dari terminal. Extension ini hanya pilihan tambahan untuk yang lebih suka klik: menjalankan test dari panel Testing di VS Code, melihat status setiap test case, dan mengatur Test Suite (membuat, mencentang, menyeret urutan). Suite yang dibuat di extension tersimpan di `test-suites.json` yang sama, jadi bisa dijalankan dari terminal juga. Cara pasang:

```bash
code --install-extension tools/vscode-extension/demoqa-tests.vsix
```

Panduan lengkapnya ada di [tools/vscode-extension/README.md](tools/vscode-extension/README.md).
