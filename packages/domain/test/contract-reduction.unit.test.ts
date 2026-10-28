import assert from "node:assert/strict";
import { test } from "node:test";
import { contractReduction } from "../src/contract-reduction.js";

test("an exceptional reduction preserves paid principal and outstanding charges", () => {
  const result = contractReduction(
    [
      {
        id: "partial",
        sequence: 1,
        principalCents: 30_000,
        openPrincipalCents: 25_000,
        balanceCents: 26_200,
      },
      {
        id: "future",
        sequence: 2,
        principalCents: 30_000,
        openPrincipalCents: 30_000,
        balanceCents: 30_000,
      },
    ],
    10_000,
  );
  assert.equal(result.reductionCents, 40_000);
  assert.deepEqual(
    result.lines.map((line) => line.resultingBalanceCents),
    [6_200, 10_000],
  );
});

test("unpaid principal may be reduced to zero without forgiving accrued charges", () => {
  const result = contractReduction(
    [
      {
        id: "overdue",
        sequence: 1,
        principalCents: 25_000,
        openPrincipalCents: 25_000,
        balanceCents: 26_000,
      },
    ],
    0,
  );
  assert.equal(result.lines[0]!.resultingBalanceCents, 1_000);
  assert.equal(result.reductionCents, 25_000);
});

test("a new value below already paid principal is rejected", () => {
  assert.throws(
    () =>
      contractReduction(
        [
          {
            id: "partial",
            sequence: 1,
            principalCents: 30_000,
            openPrincipalCents: 20_000,
            balanceCents: 20_000,
          },
        ],
        9_999,
      ),
    /principal já pago/,
  );
});

test("renegotiation requires an actual reduction on every selected installment", () => {
  const line = {
    id: "future",
    sequence: 2,
    principalCents: 10_000,
    openPrincipalCents: 10_000,
    balanceCents: 10_000,
  };
  assert.throws(() => contractReduction([line], 10_000), /menor que o atual/);
  assert.throws(() => contractReduction([line], 12_000), /menor que o atual/);
  assert.throws(() => contractReduction([], 100), /selecione/);
});
