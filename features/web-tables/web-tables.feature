@webtables
Feature: Web Tables

  Background:
    Given user membuka halaman Web Tables

  @WEBTABLES-01 @positive
  Scenario: Menambahkan banyak user sekaligus
    When user menambahkan semua user dari data test
    Then semua user tersebut tampil di tabel

  @WEBTABLES-02 @positive
  Scenario: Mencari user yang sudah ditambahkan
    Given user menambahkan semua user dari data test
    When user mencari salah satu user lewat kotak search
    Then tabel hanya menampilkan user yang dicari

  @WEBTABLES-03 @positive
  Scenario: Menghapus user dari tabel
    When user menghapus salah satu user
    Then user tersebut hilang dari tabel

  @WEBTABLES-04 @negative
  Scenario: Mencari user yang tidak ada di tabel
    When user mencari nama yang tidak ada di tabel
    Then tabel tidak menampilkan user apa pun

  @negative
  Scenario Outline: Form Add menolak <kasus>
    When user mengisi form Add dengan "<kasus>"
    And user menekan Submit di form Add
    Then form Add menolak isian tersebut

    @WEBTABLES-05
    Examples:
      | kasus         |
      | email tanpa @ |

    @WEBTABLES-06
    Examples:
      | kasus             |
      | First Name kosong |

    @WEBTABLES-07
    Examples:
      | kasus            |
      | Age berisi huruf |

    @WEBTABLES-08
    Examples:
      | kasus               |
      | Salary berisi huruf |

  @WEBTABLES-09 @negative
  Scenario: Form Add menolak isian kosong
    When user menekan Submit di form Add tanpa mengisi apa pun
    Then form Add menolak semua field yang kosong
