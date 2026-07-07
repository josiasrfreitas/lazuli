import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveFirstDueDate,
  generateInstallments,
  InstallmentGenerationError,
} from "../src/installment-generation.js";

void describe("generateInstallments amounts", () => {
  void it("splits principal equally with remainder on the last installment", () => {
    const installments = generateInstallments({
      principalAmountCents: 100_000,
      installmentCount: 3,
      startDate: "2026-01-03",
      dueDay: 5,
    });

    assert.deepEqual(
      installments.map((row) => row.amountCents),
      [33_333, 33_333, 33_334],
    );
  });

  void it("assigns the full principal to a single installment", () => {
    const installments = generateInstallments({
      principalAmountCents: 50_000,
      installmentCount: 1,
      startDate: "2026-01-03",
      dueDay: 10,
    });

    assert.equal(installments.length, 1);
    assert.equal(installments[0]?.amountCents, 50_000);
  });

  void it("always sums generated amounts to the principal", () => {
    for (const principalAmountCents of [1, 7, 99, 12_345, 999_999]) {
      for (const installmentCount of [1, 2, 3, 7, 12]) {
        const installments = generateInstallments({
          principalAmountCents,
          installmentCount,
          startDate: "2026-01-01",
          dueDay: 15,
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
      deriveFirstDueDate({ startDate: "2026-01-03", dueDay: 5 }),
      "2026-01-05",
    );
  });

  void it("uses the next month when start is on or after the due day", () => {
    assert.equal(
      deriveFirstDueDate({ startDate: "2026-01-05", dueDay: 5 }),
      "2026-02-05",
    );
    assert.equal(
      deriveFirstDueDate({ startDate: "2026-01-20", dueDay: 15 }),
      "2026-02-15",
    );
  });
});

void describe("generateInstallments schedule", () => {
  void it("generates monthly due dates on the chosen due day", () => {
    const installments = generateInstallments({
      principalAmountCents: 30_000,
      installmentCount: 3,
      startDate: "2026-01-03",
      dueDay: 5,
    });

    assert.deepEqual(
      installments.map((row) => row.dueDate),
      ["2026-01-05", "2026-02-05", "2026-03-05"],
    );
  });

  void it("clamps due day when the target month is shorter", () => {
    const installments = generateInstallments({
      principalAmountCents: 20_000,
      installmentCount: 2,
      startDate: "2026-01-10",
      dueDay: 25,
    });

    assert.deepEqual(
      installments.map((row) => row.dueDate),
      ["2026-01-25", "2026-02-25"],
    );
  });
});

void describe("generateInstallments validation", () => {
  void it("rejects non-positive principal amounts", () => {
    assert.throws(
      () =>
        generateInstallments({
          principalAmountCents: 0,
          installmentCount: 1,
          startDate: "2026-01-01",
          dueDay: 5,
        }),
      InstallmentGenerationError,
    );
  });

  void it("rejects invalid due days", () => {
    assert.throws(
      () =>
        generateInstallments({
          principalAmountCents: 100,
          installmentCount: 1,
          startDate: "2026-01-01",
          dueDay: 7,
        }),
      InstallmentGenerationError,
    );
  });
});
