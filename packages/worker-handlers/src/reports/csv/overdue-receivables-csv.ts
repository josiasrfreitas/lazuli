/**
 * Overdue receivables CSV (§7.2): only collectible overdue installments —
 * order not cancelled, installment not waived, not fully paid, due before
 * today in America/Sao_Paulo. Ledger math comes from `deriveInstallmentLedger`.
 */

import type { Prisma } from "@lazuli/db";
import { deriveInstallmentLedger, type InstallmentLedger } from "@lazuli/domain";

import { formatCentsDecimalPtBr, formatDateOnlyPtBr } from "../templates/format.js";
import { buildCsvDocument } from "./csv-format.js";

export type OverdueReceivableCsvRow = {
  studentNames: string;
  orderId: string;
  dueDate: Date | string;
  currentExpectedCents: number;
  paidAmountCents: number;
  collectibleRemainingCents: number;
  overdueDays: number;
};

const CSV_HEADERS = [
  "Aluno(s)",
  "Pedido",
  "Vencimento",
  "Valor esperado (R$)",
  "Pago (R$)",
  "Saldo em aberto (R$)",
  "Dias em atraso",
] as const;

export function buildOverdueReceivablesCsv(rows: readonly OverdueReceivableCsvRow[]): string {
  return buildCsvDocument([[...CSV_HEADERS], ...rows.map((row) => toCsvRow(row))]);
}

function toCsvRow(row: OverdueReceivableCsvRow): string[] {
  return [
    row.studentNames,
    row.orderId,
    formatDateOnlyPtBr(row.dueDate),
    formatCentsDecimalPtBr(row.currentExpectedCents),
    formatCentsDecimalPtBr(row.paidAmountCents),
    formatCentsDecimalPtBr(row.collectibleRemainingCents),
    String(row.overdueDays),
  ];
}

type OverdueReceivablesDatabase = Pick<Prisma.TransactionClient, "installment" | "financeSettings">;

export async function loadOverdueReceivableRows(input: {
  database: OverdueReceivablesDatabase;
  now: Date;
}): Promise<OverdueReceivableCsvRow[]> {
  const interestRatePctMonthly = await loadInterestRate(input.database);
  const installments = await loadCollectibleInstallments(input.database);

  const rows: OverdueReceivableCsvRow[] = [];
  for (const installment of installments) {
    const ledger = deriveInstallmentLedger({
      amountCents: installment.amountCents,
      dueDate: installment.dueDate,
      waivedAt: installment.waivedAt,
      orderCancelledAt: installment.order.cancelledAt,
      adjustments: installment.adjustments,
      allocations: installment.allocations,
      now: input.now,
      interestRatePctMonthly,
    });

    if (ledger.status === "OVERDUE") {
      rows.push(toOverdueRow({ installment, ledger }));
    }
  }

  return rows;
}

type CollectibleInstallment = {
  dueDate: Date;
  amountCents: number;
  waivedAt: Date | null;
  adjustments: { amountCents: number }[];
  allocations: { amountCents: number }[];
  order: {
    id: string;
    cancelledAt: Date | null;
    beneficiaries: { student: { fullName: string } }[];
  };
};

function loadCollectibleInstallments(
  database: OverdueReceivablesDatabase,
): Promise<CollectibleInstallment[]> {
  return database.installment.findMany({
    where: {
      deletedAt: null,
      waivedAt: null,
      order: { deletedAt: null, cancelledAt: null },
    },
    select: {
      dueDate: true,
      amountCents: true,
      waivedAt: true,
      adjustments: { where: { deletedAt: null }, select: { amountCents: true } },
      allocations: { where: { deletedAt: null }, select: { amountCents: true } },
      order: {
        select: {
          id: true,
          cancelledAt: true,
          beneficiaries: {
            where: { deletedAt: null },
            select: { student: { select: { fullName: true } } },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}

function toOverdueRow(input: {
  installment: CollectibleInstallment;
  ledger: InstallmentLedger;
}): OverdueReceivableCsvRow {
  return {
    studentNames: input.installment.order.beneficiaries
      .map((beneficiary) => beneficiary.student.fullName)
      .join("; "),
    orderId: input.installment.order.id,
    dueDate: input.installment.dueDate,
    currentExpectedCents: input.ledger.currentExpectedCents,
    paidAmountCents: input.ledger.paidAmountCents,
    collectibleRemainingCents: input.ledger.collectibleRemainingCents,
    overdueDays: input.ledger.overdueDays,
  };
}

async function loadInterestRate(database: OverdueReceivablesDatabase): Promise<number> {
  const settings = await database.financeSettings.findUnique({
    where: { id: "singleton" },
    select: { interestRatePctMonthly: true },
  });

  return settings === null ? 1 : Number(settings.interestRatePctMonthly);
}
