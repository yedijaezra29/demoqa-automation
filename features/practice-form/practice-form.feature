@practice-form
Feature: Student Registration Form

  Background:
    Given user membuka halaman Student Registration Form

  @FORM-01 @positive
  Scenario: Mengisi semua field lalu submit
    When user mengisi semua field dengan data student
    And user menekan tombol Submit
    Then popup konfirmasi menampilkan semua data student

  @FORM-02 @positive
  Scenario: Mengisi field wajib saja sudah cukup untuk submit
    When user hanya mengisi field wajib
    And user menekan tombol Submit
    Then popup konfirmasi hanya menampilkan data field wajib

  @FORM-03 @positive
  Scenario: Mobile lebih dari 10 digit hanya menyimpan 10 digit pertama
    When user mengisi Mobile dengan lebih dari 10 digit
    Then field Mobile hanya menyimpan 10 digit pertama
    When user menekan tombol Submit
    Then popup konfirmasi menampilkan Mobile 10 digit tersebut

  @negative
  Scenario Outline: Form menolak <kasus>
    When user mengisi field wajib dengan "<kasus>"
    And user menekan tombol Submit
    Then form menolak isian tersebut

    @FORM-04
    Examples:
      | kasus             |
      | First Name kosong |

    @FORM-05
    Examples:
      | kasus            |
      | Last Name kosong |

    @FORM-06
    Examples:
      | kasus                       |
      | Mobile kurang dari 10 digit |

    @FORM-07
    Examples:
      | kasus               |
      | Mobile berisi huruf |

    @FORM-08
    Examples:
      | kasus         |
      | email tanpa @ |

    @FORM-09
    Examples:
      | kasus                |
      | Gender tidak dipilih |

  @FORM-10 @negative
  Scenario: Form menolak jika dikirim kosong
    When user menekan tombol Submit
    Then form menolak semua field wajib yang kosong
