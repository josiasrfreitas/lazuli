import { saoPauloDateOnly, studentFinanceSummary } from "@lazuli/domain";
import { ledgerQuery } from "./installments-query.js";
import { toDateOnlyString, type FinanceDatabase } from "./shared.js";

export async function readStudentSummary(
  database: FinanceDatabase,
  input: { studentId: string; now: Date },
) {
  const asOf = saoPauloDateOnly(input.now);
  const installments = await ledgerQuery({
    kysely: database.$kysely,
    businessDate: asOf,
    studentId: input.studentId,
    search: undefined,
  })
    .selectFrom("ledger")
    .selectAll()
    .execute();
  const allocations = await database.paymentAllocation.findMany({
    where: {
      installmentId: {
        in: installments.filter((row) => row.status === "PAID").map((row) => row.installmentId),
      },
      deletedAt: null,
      paymentEntry: { deletedAt: null },
    },
    select: { installmentId: true, amountCents: true, paymentEntry: { select: { date: true } } },
  });
  return {
    asOf,
    contracts: await readStudentContractTerms(database, input.studentId),
    ...studentFinanceSummary(
      installments,
      allocations.map((row) => ({
        installmentId: row.installmentId,
        amountCents: row.amountCents,
        date: toDateOnlyString(row.paymentEntry.date),
      })),
    ),
  };
}

async function readStudentContractTerms(database: FinanceDatabase, studentId: string) {
  const contracts = await database.contract.findMany({
    where: {
      studentId,
      deletedAt: null,
      orders: { some: { deletedAt: null, cancelledAt: null, kind: "TUITION" } },
    },
    select: {
      id: true,
      startsOn: true,
      endsOn: true,
      durationMonths: true,
      punctualityDiscountPct: true,
      orders: {
        where: { deletedAt: null, cancelledAt: null, kind: "TUITION" },
        select: {
          id: true,
          dueDay: true,
          installments: { where: { deletedAt: null }, select: { amountCents: true } },
        },
      },
    },
    orderBy: { startsOn: "desc" },
  });
  return contracts.map((contract) => ({
    id: contract.id,
    startsOn: contract.startsOn ? toDateOnlyString(contract.startsOn) : null,
    endsOn: contract.endsOn ? toDateOnlyString(contract.endsOn) : null,
    durationMonths: contract.durationMonths,
    punctualityDiscountPct: Number(contract.punctualityDiscountPct ?? 0),
    schedules: contract.orders.map((order) => ({
      id: order.id,
      dueDay: order.dueDay,
      installmentCount: order.installments.length,
      uniformAmountCents:
        order.installments.length > 0 &&
        order.installments.every((row) => row.amountCents === order.installments[0]!.amountCents)
          ? order.installments[0]!.amountCents
          : null,
    })),
  }));
}
