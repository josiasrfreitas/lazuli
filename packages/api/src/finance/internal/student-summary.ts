import { saoPauloDateOnly, studentFinanceSummary } from "@lazuli/domain";
import { readMaterialNeeds } from "./material-needs.js";
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
    materialNeeds: await readMaterialNeeds(database, input.studentId, asOf),
    contracts: await readStudentContractTerms(database, input.studentId, installments),
    latestTermination: await readLatestTermination(database, input.studentId),
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

async function readLatestTermination(database: FinanceDatabase, studentId: string) {
  const contract = await database.contract.findFirst({
    where: { studentId, deletedAt: null, terminatedAt: { not: null } },
    select: { id: true, terminatedAt: true },
    orderBy: [{ terminatedAt: "desc" }, { id: "desc" }],
  });
  return contract?.terminatedAt
    ? { contractId: contract.id, date: saoPauloDateOnly(contract.terminatedAt) }
    : null;
}

type ItemBalance = {
  orderId: string;
  paidAmountCents: number;
  collectibleBalanceCents: number;
  status: string;
};
async function readStudentContractTerms(
  database: FinanceDatabase,
  studentId: string,
  balances: ItemBalance[],
) {
  const contracts = await database.contract.findMany({
    where: {
      studentId,
      terminatedAt: null,
      deletedAt: null,
      orders: { some: { deletedAt: null, cancelledAt: null, kind: "TUITION" } },
    },
    select: {
      id: true,
      commandId: true,
      student: { select: { fullName: true } },
      payer: { select: { name: true } },
      startsOn: true,
      endsOn: true,
      durationMonths: true,
      punctualityDiscountPct: true,
      orders: {
        where: { deletedAt: null, cancelledAt: null },
        select: {
          id: true,
          dueDay: true,
          firstDueDate: true,
          principalAmountCents: true,
          kind: true,
          material: {
            select: {
              name: true,
              items: {
                orderBy: { position: "asc" },
                select: { stageId: true, name: true, stageCode: true },
              },
              payment: true,
              quotedInstallments: true,
              quotedInstallmentCents: true,
              chargedAmountCents: true,
              cardFeePct: true,
              cardFeeCents: true,
            },
          },
          installments: { where: { deletedAt: null }, select: { amountCents: true } },
        },
      },
    },
    orderBy: { startsOn: "desc" },
  });
  return contracts.map((contract) => ({
    id: contract.id,
    hasDetail: Boolean(contract.commandId),
    studentName: contract.student.fullName,
    payerName: contract.payer.name,
    startsOn: contract.startsOn ? toDateOnlyString(contract.startsOn) : null,
    endsOn: contract.endsOn ? toDateOnlyString(contract.endsOn) : null,
    durationMonths: contract.durationMonths,
    punctualityDiscountPct: Number(contract.punctualityDiscountPct ?? 0),
    schedules: contract.orders.map((order) => ({
      id: order.id,
      dueDay: order.dueDay,
      firstDueDate: order.firstDueDate ? toDateOnlyString(order.firstDueDate) : null,
      totalCents: order.principalAmountCents,
      collection: itemCollection(balances.filter((row) => row.orderId === order.id)),
      kind: order.kind,
      materialName: order.material?.name ?? null,
      material: order.material
        ? {
            ...order.material,
            cardFeePct:
              order.material.cardFeePct === null ? null : Number(order.material.cardFeePct),
          }
        : null,
      installmentCount: order.installments.length,
      uniformAmountCents:
        order.installments.length > 0 &&
        order.installments.every((row) => row.amountCents === order.installments[0]!.amountCents)
          ? order.installments[0]!.amountCents
          : null,
    })),
  }));
}

function itemCollection(rows: ItemBalance[]) {
  return {
    receivedCents: rows.reduce((sum, row) => sum + row.paidAmountCents, 0),
    balanceCents: rows.reduce((sum, row) => sum + row.collectibleBalanceCents, 0),
    paidCount: rows.filter((row) => row.status === "PAID").length,
    waivedCount: rows.filter((row) => row.status === "WAIVED").length,
    overdueCount: rows.filter((row) => row.status === "OVERDUE").length,
    count: rows.length,
  };
}
