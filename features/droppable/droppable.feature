@droppable
Feature: Droppable

  @DROPPABLE-01 @positive
  Scenario: Menyeret kotak Drag Me ke area target
    Given user membuka tab "Simple" di halaman Droppable
    When user menyeret kotak "Drag Me" ke area target
    Then area target menerima kotak tersebut

  @DROPPABLE-02 @positive
  Scenario: Area target di tab Accept menerima kotak Acceptable
    Given user membuka tab "Accept" di halaman Droppable
    When user menyeret kotak "Acceptable" ke area target
    Then area target menerima kotak tersebut

  @DROPPABLE-03 @negative
  Scenario: Melepas kotak di luar area target
    Given user membuka tab "Simple" di halaman Droppable
    When user menyeret kotak "Drag Me" lalu melepasnya di luar area target
    Then area target tetap kosong

  @DROPPABLE-04 @negative
  Scenario: Area target di tab Accept menolak kotak Not Acceptable
    Given user membuka tab "Accept" di halaman Droppable
    When user menyeret kotak "Not Acceptable" ke area target
    Then area target tetap kosong
