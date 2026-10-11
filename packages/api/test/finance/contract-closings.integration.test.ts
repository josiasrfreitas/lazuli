import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import { readContractClosings } from "../../src/finance/internal/contract-closings.js";

void it("groups nominal commitments by agreement month independently of start, installments and cash", async () => {
  const student = await db.student.create({ data: { fullName: "Closings 178 Student" } });
  const payer = await db.payer.create({ data: { name: "Closings 178 Payer" } });
  const base = { studentId: student.id, payerId: payer.id };
  try {
    await db.contract.createMany({
      data: [
        {
          ...base,
          agreedOn: new Date("2093-03-15"),
          startsOn: new Date("2093-04-01"),
          monthlyAmountCents: 30_000,
          durationMonths: 12,
        },
        {
          ...base,
          agreedOn: new Date("2093-03-31"),
          startsOn: new Date("2093-08-01"),
          monthlyAmountCents: 20_000,
          durationMonths: 6,
        },
        {
          ...base,
          agreedOn: new Date("2093-04-01"),
          monthlyAmountCents: 90_000,
          durationMonths: 12,
        },
        {
          ...base,
          agreedOn: new Date("2093-03-02"),
          monthlyAmountCents: 10_000,
          durationMonths: null,
        },
        {
          ...base,
          agreedOn: new Date("2093-03-10"),
          monthlyAmountCents: 50_000,
          durationMonths: 12,
          deletedAt: new Date(),
        },
        { ...base, agreedOn: null, monthlyAmountCents: 10_000, durationMonths: 12 },
      ],
    });
    const result = await readContractClosings(db, { year: 2093, asOf: "2093-03-31" });
    assert.equal(result.months.length, 12);
    assert.deepEqual(result.months[2], {
      month: "2093-03",
      count: 3,
      projectedCents: 480_000,
      monthlyEquivalentCents: 50_000,
    });
    assert.deepEqual(result.months[3], {
      month: "2093-04",
      count: 0,
      projectedCents: 0,
      monthlyEquivalentCents: 0,
    });
    assert.equal(result.incompleteCount, 1);
    const nextDay = await readContractClosings(db, { year: 2093, asOf: "2093-04-01" });
    assert.deepEqual(nextDay.months[3], {
      month: "2093-04",
      count: 1,
      projectedCents: 1_080_000,
      monthlyEquivalentCents: 90_000,
    });
  } finally {
    await db.contract.deleteMany({ where: { studentId: student.id } });
    await db.student.delete({ where: { id: student.id } });
    await db.payer.delete({ where: { id: payer.id } });
    await db.$disconnect();
  }
});
