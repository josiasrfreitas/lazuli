import { readMaterialNeeds } from "./material-needs.js";
import { saoPauloDateOnly, type StudentFinanceSummary } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { sql } from "kysely";
import { notFound } from "../../trpc/errors.js";
import { ledgerQuery } from "./installments-query.js";
import { STUDENT_NOT_FOUND_MESSAGE, toDateOnlyString, type FinanceDatabase } from "./shared.js";
import { readStudentPaymentHistory } from "./student-summary-history.js";

type LedgerInput = Parameters<typeof ledgerQuery>[0];

export async function readStudentSummary(
  database: FinanceDatabase,
  input: { studentId: string; now: Date },
): Promise<
  StudentFinanceSummary & {
    asOf: string;
    materialNeeds: Awaited<ReturnType<typeof readMaterialNeeds>>;
    contracts: Awaited<ReturnType<typeof readStudentContractTerms>>;
    latestTermination: Awaited<ReturnType<typeof readLatestTermination>>;
  }
> {
  const student = await database.student.findUnique({
    where: { id: input.studentId },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  const asOf = saoPauloDateOnly(input.now);
  const query = {
    kysely: database.$kysely,
    businessDate: asOf,
    studentId: input.studentId,
    search: undefined,
  };
  const totals = await readTotals(query);
  const next = await ledgerQuery(query)
    .selectFrom("ledger")
    .select("dueDate")
    .select(sql<number>`sum("collectibleBalanceCents")::double precision`.as("amountCents"))
    .where("collectibleBalanceCents", ">", 0)
    .where("status", "!=", "OVERDUE")
    .groupBy("dueDate")
    .orderBy("dueDate", "asc")
    .limit(1)
    .executeTakeFirst();
  const balances = await ledgerQuery(query).selectFrom("ledger").selectAll().execute();
  return {
    materialNeeds: await readMaterialNeeds(database, { studentId: input.studentId, asOf }),
    contracts: await readStudentContractTerms(database, { studentId: input.studentId, balances }),
    latestTermination: await readLatestTermination(database, input.studentId),
    ...totals,
    asOf,
    totalCents: totals.receivedCents + totals.outstandingCents,
    debtState: debtState(totals),
    nextDueDate: next?.dueDate ?? null,
    nextDueCents: next?.amountCents ?? 0,
    history: await readStudentPaymentHistory(query),
  };
}

async function readTotals(
  input: LedgerInput,
): Promise<
  Pick<
    StudentFinanceSummary,
    | "installmentCount"
    | "receivedCents"
    | "outstandingCents"
    | "overdueCents"
    | "overdueCount"
    | "oldestOverdueDays"
  >
> {
  return ledgerQuery(input)
    .selectFrom("ledger")
    .select([
      sql<number>`count(*)::integer`.as("installmentCount"),
      sql<number>`coalesce(sum("paidAmountCents"), 0)::double precision`.as("receivedCents"),
      sql<number>`coalesce(sum("collectibleBalanceCents"), 0)::double precision`.as(
        "outstandingCents",
      ),
      sql<number>`coalesce(sum("collectibleBalanceCents") filter (where status = 'OVERDUE'), 0)::double precision`.as(
        "overdueCents",
      ),
      sql<number>`count(*) filter (where status = 'OVERDUE' and "collectibleBalanceCents" > 0)::integer`.as(
        "overdueCount",
      ),
      sql<number>`coalesce(max("overdueDays") filter (where status = 'OVERDUE' and "collectibleBalanceCents" > 0), 0)::integer`.as(
        "oldestOverdueDays",
      ),
    ])
    .executeTakeFirstOrThrow();
}

const SEVERE_OVERDUE_DAYS = 30;
function debtState(totals: {
  oldestOverdueDays: number;
  overdueCount: number;
}): StudentFinanceSummary["debtState"] {
  if (totals.oldestOverdueDays > SEVERE_OVERDUE_DAYS) return "SEVERE_OVERDUE";
  return totals.overdueCount > 0 ? "OVERDUE" : "NO_OVERDUE";
}

async function readLatestTermination(
  database: FinanceDatabase,
  studentId: string,
): Promise<{ contractId: string; date: string } | null> {
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
const studentContractSelect = {
  id: true,
  commandId: true,
  student: { select: { fullName: true } },
  payer: { select: { name: true } },
  startsOn: true,
  endsOn: true,
  durationMonths: true,
  punctualityDiscountPct: true,
  renegotiations: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { newAmountCents: true, installmentCount: true, reductionCents: true },
  },
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
      installments: {
        where: { deletedAt: null },
        select: {
          amountCents: true,
          adjustments: {
            where: { deletedAt: null, renegotiationId: { not: null } },
            select: { amountCents: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ContractSelect;
type StudentContract = Prisma.ContractGetPayload<{ select: typeof studentContractSelect }>;
type StudentContractView = {
  id: string;
  hasDetail: boolean;
  studentName: string;
  payerName: string;
  startsOn: string | null;
  endsOn: string | null;
  durationMonths: number | null;
  punctualityDiscountPct: number;
  renegotiations?: { newAmountCents: number; installmentCount: number; reductionCents: number }[];
  schedules: {
    id: string;
    dueDay: number | null;
    firstDueDate: string | null;
    totalCents: number;
    collection: ReturnType<typeof itemCollection>;
    kind: StudentContract["orders"][number]["kind"];
    materialName: string | null;
    material:
      | (Omit<NonNullable<StudentContract["orders"][number]["material"]>, "cardFeePct"> & {
          cardFeePct: number | null;
        })
      | null;
    installmentCount: number;
    uniformAmountCents: number | null;
  }[];
};

async function readStudentContractTerms(
  database: FinanceDatabase,
  options: {
    studentId: string;
    balances: ItemBalance[];
  },
): Promise<StudentContractView[]> {
  const { studentId, balances } = options;

  const contracts = await database.contract.findMany({
    where: {
      studentId,
      terminatedAt: null,
      deletedAt: null,
      orders: { some: { deletedAt: null, cancelledAt: null, kind: "TUITION" } },
    },
    select: studentContractSelect,
    orderBy: { startsOn: "desc" },
  });
  return contracts.map((contract) => projectStudentContract(contract, balances));
}

const projectStudentContract = (
  contract: StudentContract,
  balances: ItemBalance[],
): StudentContractView => ({
  id: contract.id,
  hasDetail: Boolean(contract.commandId),
  studentName: contract.student.fullName,
  payerName: contract.payer.name,
  startsOn: contract.startsOn ? toDateOnlyString(contract.startsOn) : null,
  endsOn: contract.endsOn ? toDateOnlyString(contract.endsOn) : null,
  durationMonths: contract.durationMonths,
  punctualityDiscountPct: Number(contract.punctualityDiscountPct ?? 0),
  renegotiations: contract.renegotiations,
  schedules: contract.orders.map((order) => ({
    id: order.id,
    dueDay: order.dueDay,
    firstDueDate: order.firstDueDate ? toDateOnlyString(order.firstDueDate) : null,
    totalCents:
      order.principalAmountCents +
      order.installments.reduce((sum, row) => sum + renegotiatedAdjustment(row), 0),
    collection: itemCollection(balances.filter((row) => row.orderId === order.id)),
    kind: order.kind,
    materialName: order.material?.name ?? null,
    material: order.material
      ? {
          ...order.material,
          cardFeePct: order.material.cardFeePct === null ? null : Number(order.material.cardFeePct),
        }
      : null,
    installmentCount: order.installments.length,
    uniformAmountCents:
      order.installments.length > 0 &&
      order.installments.every(
        (row) =>
          row.amountCents + renegotiatedAdjustment(row) ===
          order.installments[0]!.amountCents + renegotiatedAdjustment(order.installments[0]!),
      )
        ? order.installments[0]!.amountCents + renegotiatedAdjustment(order.installments[0]!)
        : null,
  })),
});

function renegotiatedAdjustment(row: { adjustments: { amountCents: number }[] }): number {
  return row.adjustments.reduce((sum, adjustment) => sum + adjustment.amountCents, 0);
}

function itemCollection(rows: ItemBalance[]): {
  receivedCents: number;
  balanceCents: number;
  paidCount: number;
  waivedCount: number;
  overdueCount: number;
  count: number;
} {
  return {
    receivedCents: rows.reduce((sum, row) => sum + row.paidAmountCents, 0),
    balanceCents: rows.reduce((sum, row) => sum + row.collectibleBalanceCents, 0),
    paidCount: rows.filter((row) => row.status === "PAID").length,
    waivedCount: rows.filter((row) => row.status === "WAIVED").length,
    overdueCount: rows.filter((row) => row.status === "OVERDUE").length,
    count: rows.length,
  };
}
