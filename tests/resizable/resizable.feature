@resizable
Feature: Resizable

  Background:
    Given user membuka halaman Resizable

  @positive
  Scenario Outline: Mengubah ukuran kotak menjadi <ukuran> piksel
    When user menarik sudut kotak sampai "<ukuran>" piksel
    Then ukuran kotak sesuai yang diharapkan

    @RESIZABLE-01
    Examples: Ukuran yang diminta
      | ukuran    |
      | 400 x 200 |

    @RESIZABLE-02
    Examples: Ukuran minimum
      | ukuran    |
      | 150 x 150 |

    @RESIZABLE-03
    Examples: Ukuran maksimum
      | ukuran    |
      | 500 x 300 |

  @negative
  Scenario Outline: Ukuran kotak tertahan di batas saat ditarik ke <ukuran> piksel
    When user menarik sudut kotak sampai "<ukuran>" piksel
    Then ukuran kotak tertahan di batas yang diizinkan

    @RESIZABLE-04
    Examples: Melewati ukuran maksimum
      | ukuran    |
      | 600 x 400 |

    @RESIZABLE-05
    Examples: Di bawah ukuran minimum
      | ukuran    |
      | 100 x 100 |
