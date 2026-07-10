/**
 * Monthly accountant CSV (§7.2): payment entries with allocations in the
 * month plus waivers in the month; expenses excluded. The month defaults to
 * the current America/Sao_Paulo month (selection follow-up — see
 * `report-parameters.ts`).
 */

import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";

import { formatCentsDecimalPtBr, formatDateOnlyPtBr } from "../templates/format.js";
import { paymentMethodLabel } from "../templates/labels.js";
import { buildCsvDocument } from "./csv-format.js";

export type AccountantPaymentCsvRow = {
  date: Date | string;
  payerName: string;
  method: string;
  amountCents: number;
  allocatedCents: number;
  externalReference: string | null;
  note: string | null;
};

export type AccountantWaiverCsvRow = {
  waivedDate: string;
  payerName: string;
  orderId: string;
  installmentDueDate: Date | string;
  waivedRemainingCents: number;
  reason: string | null;
};

export type MonthlyAccountantCsvData = {
  payments: readonly AccountantPaymentCsvRow[];
  waivers: readonly AccountantWaiverCsvRow[];
};

const CSV_HEADERS = [
  "Tipo",
  "Data",
  "Pagador",
  "Método",
  "Valor (R$)",
  "Valor alocado (R$)",
  "Referência",
  "Observação",
] as const;

export function buildMonthlyAccountantCsv(data: MonthlyAccountantCsvData): string {
  return buildCsvDocument([
    [...CSV_HEADERS],
    ...data.payments.map((row) => paymentCsvRow(row)),
    ...data.waivers.map((row) => waiverCsvRow(row)),
  ]);
}

function paymentCsvRow(row: AccountantPaymentCsvRow): string[] {
  return [
    "Pagamento",
    formatDateOnlyPtBr(row.date),
    row.payerName,
    paymentMethodLabel(row.method),
    formatCentsDecimalPtBr(row.amountCents),
    formatCentsDecimalPtBr(row.allocatedCents),
    row.externalReference ?? "",
    row.note ?? "",
  ];
}

function waiverCsvRow(row: AccountantWaiverCsvRow): string[] {
  return [
    "Isenção",
    formatDateOnlyPtBr(row.waivedDate),
    row.payerName,
    "",
    formatCentsDecimalPtBr(row.waivedRemainingCents),
    "",
    `Parcela venc. ${formatDateOnlyPtBr(row.installmentDueDate)} — Pedido ${row.orderId}`,
    row.reason ?? "",
  ];
}

type MonthlyAccountantDatabase = Pick<Prisma.TransactionClient, "paymentEntry" | "installment">;

export async function loadMonthlyAccountantData(input: {
  database: MonthlyAccountantDatabase;
  year: number;
  month: number;
}): Promise<MonthlyAccountantCsvData> {
  const [payments, waivers] = await Promise.all([loadPaymentRows(input), loadWaiverRows(input)]);

  return { payments, waivers };
}

async function loadPaymentRows(input: {
  database: MonthlyAccountantDatabase;
  year: number;
  month: number;
}): Promise<AccountantPaymentCsvRow[]> {
  const window = monthWindowUtc({ year: input.year, month: input.month });
  const entries = await input.database.paymentEntry.findMany({
    where: { deletedAt: null, date: { gte: window.start, lt: window.end } },
    select: {
      date: true,
      amountCents: true,
      method: true,
      note: true,
      externalReference: true,
      payer: { select: { name: true } },
      allocations: { where: { deletedAt: null }, select: { amountCents: true } },
    },
    orderBy: { date: "asc" },
  });

  return entries.map((entry) => ({
    date: entry.date,
    payerName: entry.payer.name,
    method: entry.method,
    amountCents: entry.amountCents,
    allocatedCents: entry.allocations.reduce((total, row) => total + row.amountCents, 0),
    externalReference: entry.externalReference,
    note: entry.note,
  }));
}

async function loadWaiverRows(input: {
  database: MonthlyAccountantDatabase;
  year: number;
  month: number;
}): Promise<AccountantWaiverCsvRow[]> {
  const monthPrefix = yearMonthPrefix({ year: input.year, month: input.month });
  const waived = await input.database.installment.findMany({
    where: { deletedAt: null, waivedAt: { not: null } },
    select: {
      waivedAt: true,
      waivedReason: true,
      dueDate: true,
      amountCents: true,
      adjustments: { where: { deletedAt: null }, select: { amountCents: true } },
      allocations: { where: { deletedAt: null }, select: { amountCents: true } },
      order: { select: { id: true, payer: { select: { name: true } } } },
    },
    orderBy: { waivedAt: "asc" },
  });

  return waived
    .filter(
      (row): row is typeof row & { waivedAt: Date } =>
        row.waivedAt !== null && saoPauloDateOnly(row.waivedAt).startsWith(monthPrefix),
    )
    .map((row) => toWaiverRow(row));
}

function toWaiverRow(row: {
  waivedAt: Date;
  waivedReason: string | null;
  dueDate: Date;
  amountCents: number;
  adjustments: { amountCents: number }[];
  allocations: { amountCents: number }[];
  order: { id: string; payer: { name: string } };
}): AccountantWaiverCsvRow {
  const expected =
    row.amountCents + row.adjustments.reduce((total, item) => total + item.amountCents, 0);
  const paid = row.allocations.reduce((total, item) => total + item.amountCents, 0);

  return {
    waivedDate: saoPauloDateOnly(row.waivedAt),
    payerName: row.order.payer.name,
    orderId: row.order.id,
    installmentDueDate: row.dueDate,
    waivedRemainingCents: Math.max(expected - paid, 0),
    reason: row.waivedReason,
  };
}

function monthWindowUtc(input: { year: number; month: number }): { start: Date; end: Date } {
  const monthIndex = input.month - 1;

  return {
    start: new Date(Date.UTC(input.year, monthIndex, 1)),
    end: new Date(Date.UTC(input.year, monthIndex + 1, 1)),
  };
}

function yearMonthPrefix(input: { year: number; month: number }): string {
  return `${String(input.year)}-${String(input.month).padStart(2, "0")}`;
}
