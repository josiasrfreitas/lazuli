import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveFirstDueDate,
  FINANCE_DUE_DAY_FIFTEENTH,
  FINANCE_DUE_DAY_FIFTH,
  FINANCE_DUE_DAY_TENTH,
  FINANCE_DUE_DAY_TWENTY_FIFTH,
  generateInstallments,
  InstallmentGenerationError,
} from "../src/installment-generation.js";

const START_DATE_BEFORE_DUE_DAY = "2026-01-03";
const START_DATE_ON_DUE_DAY = "2026-01-05";
const START_DATE_AFTER_DUE_DAY = "2026-01-20";
const START_DATE_JANUARY_FIRST = "2026-01-01";
const START_DATE_JANUARY_TENTH = "2026-01-10";
const START_DATE_JUNE_FIRST = "2026-06-01";
const FIRST_JANUARY_DUE = "2026-01-05";
const FIRST_FEBRUARY_DUE = "2026-02-05";
const FIRST_FEBRUARY_FIFTEENTH = "2026-02-15";
const FIRST_JANUARY_TWENTY_FIFTH = "2026-01-25";
const FIRST_FEBRUARY_TWENTY_FIFTH = "2026-02-25";
const THIRD_MARCH_DUE = "2026-03-05";
const FIRST_JUNE_DUE = "2026-06-05";
const FIRST_JULY_DUE = "2026-07-05";

const THREE_INSTALLMENTS = 3;
const TWO_INSTALLMENTS = 2;
const ZERO_INSTALLMENTS = 0;
const SINGLE_INSTALLMENT = 1;

const PRINCIPAL_ONE_HUNDRED_THOUSAND = 100_000;
const PRINCIPAL_FIFTY_THOUSAND = 50_000;
const PRINCIPAL_THIRTY_THOUSAND = 30_000;
const PRINCIPAL_TWENTY_THOUSAND = 20_000;
const PRINCIPAL_TEN_THOUSAND = 10_000;
const HALF_OF_TEN_THOUSAND = 5000;
const BASE_INSTALLMENT_AMOUNT = 33_333;
const LAST_INSTALLMENT_AMOUNT = 33_334;
const INVALID_DUE_DAY = 7;
const SMALL_PRINCIPAL = 100;

const PRINCIPAL_ONE = 1;
const PRINCIPAL_SEVEN = 7;
const PRINCIPAL_NINETY_NINE = 99;
const PRINCIPAL_TWELVE_THOUSAND = 12_345;
const PRINCIPAL_NEAR_MILLION = 999_999;
const TWO_INSTALLMENT_COUNT = 2;
const THREE_INSTALLMENT_COUNT = 3;
const SEVEN_INSTALLMENT_COUNT = 7;
const TWELVE_INSTALLMENT_COUNT = 12;

const PRINCIPAL_SAMPLES = [
  PRINCIPAL_ONE,
  PRINCIPAL_SEVEN,
  PRINCIPAL_NINETY_NINE,
  PRINCIPAL_TWELVE_THOUSAND,
  PRINCIPAL_NEAR_MILLION,
] as const;
const INSTALLMENT_COUNT_SAMPLES = [
  SINGLE_INSTALLMENT,
  TWO_INSTALLMENT_COUNT,
  THREE_INSTALLMENT_COUNT,
  SEVEN_INSTALLMENT_COUNT,
  TWELVE_INSTALLMENT_COUNT,
] as const;

void describe("generateInstallments amounts", () => {
  void it("splits principal equally with remainder on the last installment", () => {
    const installments = generateInstallments({
      principalAmountCents: PRINCIPAL_ONE_HUNDRED_THOUSAND,
      installmentCount: THREE_INSTALLMENTS,
      startDate: START_DATE_BEFORE_DUE_DAY,
      dueDay: FINANCE_DUE_DAY_FIFTH,
    });

    assert.deepEqual(
      installments.map((row) => row.amountCents),
      [BASE_INSTALLMENT_AMOUNT, BASE_INSTALLMENT_AMOUNT, LAST_INSTALLMENT_AMOUNT],
    );
  });

  void it("assigns the full principal to a single installment", () => {
    const installments = generateInstallments({
      principalAmountCents: PRINCIPAL_FIFTY_THOUSAND,
      installmentCount: SINGLE_INSTALLMENT,
      startDate: START_DATE_BEFORE_DUE_DAY,
      dueDay: FINANCE_DUE_DAY_TENTH,
    });

    assert.equal(installments.length, SINGLE_INSTALLMENT);
    assert.equal(installments[0]?.amountCents, PRINCIPAL_FIFTY_THOUSAND);
  });

  void it("always sums generated amounts to the principal", () => {
    for (const principalAmountCents of PRINCIPAL_SAMPLES) {
      for (const installmentCount of INSTALLMENT_COUNT_SAMPLES) {
        const installments = generateInstallments({
          principalAmountCents,
          installmentCount,
          startDate: START_DATE_JANUARY_FIRST,
          dueDay: FINANCE_DUE_DAY_FIFTEENTH,
        });
        const sum = installments.reduce((total, row) => total + row.amountCents, 0);

        assert.equal(sum, principalAmountCents);
        assert.equal(installments.length, installmentCount);
      }
    }
  });
});

void describe("deriveFirstDueDate", () => {
  void it("uses the next due day in the same month when start is before due day", () => {
    assert.equal(
      deriveFirstDueDate({ startDate: START_DATE_BEFORE_DUE_DAY, dueDay: FINANCE_DUE_DAY_FIFTH }),
      FIRST_JANUARY_DUE,
    );
  });

  void it("uses the next month when start is on or after the due day", () => {
    assert.equal(
      deriveFirstDueDate({ startDate: START_DATE_ON_DUE_DAY, dueDay: FINANCE_DUE_DAY_FIFTH }),
      FIRST_FEBRUARY_DUE,
    );
    assert.equal(
      deriveFirstDueDate({
        startDate: START_DATE_AFTER_DUE_DAY,
        dueDay: FINANCE_DUE_DAY_FIFTEENTH,
      }),
      FIRST_FEBRUARY_FIFTEENTH,
    );
  });

  void it("rejects invalid due days on direct calls", () => {
    assert.throws(
      () => deriveFirstDueDate({ startDate: START_DATE_JUNE_FIRST, dueDay: INVALID_DUE_DAY }),
      { name: "InstallmentGenerationError", code: "INVALID_DUE_DAY" },
    );
  });
});

void describe("generateInstallments schedule", () => {
  void it("generates monthly due dates on the chosen due day", () => {
    const installments = generateInstallments({
      principalAmountCents: PRINCIPAL_THIRTY_THOUSAND,
      installmentCount: THREE_INSTALLMENTS,
      startDate: START_DATE_BEFORE_DUE_DAY,
      dueDay: FINANCE_DUE_DAY_FIFTH,
    });

    assert.deepEqual(
      installments.map((row) => row.dueDate),
      [FIRST_JANUARY_DUE, FIRST_FEBRUARY_DUE, THIRD_MARCH_DUE],
    );
  });

  void it("clamps due day when the target month is shorter", () => {
    const installments = generateInstallments({
      principalAmountCents: PRINCIPAL_TWENTY_THOUSAND,
      installmentCount: TWO_INSTALLMENTS,
      startDate: START_DATE_JANUARY_TENTH,
      dueDay: FINANCE_DUE_DAY_TWENTY_FIFTH,
    });

    assert.deepEqual(
      installments.map((row) => row.dueDate),
      [FIRST_JANUARY_TWENTY_FIFTH, FIRST_FEBRUARY_TWENTY_FIFTH],
    );
  });

  void it("keeps non-January schedules in the requested calendar year", () => {
    const installments = generateInstallments({
      principalAmountCents: PRINCIPAL_TEN_THOUSAND,
      installmentCount: TWO_INSTALLMENTS,
      startDate: START_DATE_JUNE_FIRST,
      dueDay: FINANCE_DUE_DAY_FIFTH,
    });

    assert.deepEqual(installments, [
      { amountCents: HALF_OF_TEN_THOUSAND, dueDate: FIRST_JUNE_DUE },
      { amountCents: HALF_OF_TEN_THOUSAND, dueDate: FIRST_JULY_DUE },
    ]);
  });
});

void describe("generateInstallments validation", () => {
  void it("rejects non-positive principal amounts", () => {
    assert.throws(
      () =>
        generateInstallments({
          principalAmountCents: 0,
          installmentCount: SINGLE_INSTALLMENT,
          startDate: START_DATE_JANUARY_FIRST,
          dueDay: FINANCE_DUE_DAY_FIFTH,
        }),
      InstallmentGenerationError,
    );
  });

  void it("rejects zero installments instead of returning an empty schedule", () => {
    assert.throws(
      () =>
        generateInstallments({
          principalAmountCents: PRINCIPAL_TEN_THOUSAND,
          installmentCount: ZERO_INSTALLMENTS,
          startDate: START_DATE_JUNE_FIRST,
          dueDay: FINANCE_DUE_DAY_FIFTH,
        }),
      { name: "InstallmentGenerationError", code: "INVALID_INSTALLMENT_COUNT" },
    );
  });

  void it("rejects invalid due days", () => {
    assert.throws(
      () =>
        generateInstallments({
          principalAmountCents: SMALL_PRINCIPAL,
          installmentCount: SINGLE_INSTALLMENT,
          startDate: START_DATE_JANUARY_FIRST,
          dueDay: INVALID_DUE_DAY,
        }),
      InstallmentGenerationError,
    );
  });
});
