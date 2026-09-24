import { createHash } from "node:crypto";

import { previewMonthlyContract } from "@lazuli/domain";
import type { FinanceSettings } from "@lazuli/db";
import type { CreateMonthlyContractInput } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";

import { contractSelect, toRow, type ContractListRow } from "./contracts-select.js";
import { toDateOnly, type FinanceDatabase } from "./shared.js";

const DUE_DAY_START = 8;
const DUE_DAY_END = 10;

export function contractFingerprint(values: CreateMonthlyContractInput): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

export async function findCommandResult(
  database: FinanceDatabase,
  values: CreateMonthlyContractInput,
): Promise<ContractListRow | null> {
  const existing = await database.contract.findUnique({
    where: { commandId: values.commandId },
    select: contractSelect,
  });
  if (!existing) return null;
  if (existing.commandFingerprint !== contractFingerprint(values)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Identidade de criação usada com dados diferentes.",
    });
  }
  return toRow(existing);
}

type ReadyTerms = {
  settings: FinanceSettings;
  preview: ReturnType<typeof previewMonthlyContract>;
};

async function readyTerms(input: {
  database: FinanceDatabase;
  values: CreateMonthlyContractInput;
}): Promise<ReadyTerms> {
  const { database, values } = input;
  const [settings, payer, student] = await Promise.all([
    database.financeSettings.findUnique({ where: { id: "singleton" } }),
    database.payer.findFirst({
      where: { id: values.payerId, deletedAt: null },
      select: { id: true },
    }),
    database.student.findFirst({
      where: { id: values.studentId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!payer || !student)
    throw new TRPCError({ code: "NOT_FOUND", message: "Aluno ou pagador não encontrado." });
  if (
    !settings ||
    settings.tuitionCeilingCents === null ||
    settings.maximumDiscountPct === null ||
    settings.interestRatePctDaily === null ||
    settings.interestRatePctMonthly === null ||
    settings.cancellationFeePct === null
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Configure os ajustes financeiros antes de criar um contrato.",
    });
  }
  let preview: ReturnType<typeof previewMonthlyContract>;
  try {
    preview = previewMonthlyContract({
      startsOn: values.startsOn,
      durationMonths: values.durationMonths,
      firstDueDate: values.firstDueDate,
      monthlyAmountCents: values.monthlyAmountCents,
      punctualityDiscountPct: values.punctualityDiscountPct,
      tuitionCeilingCents: settings.tuitionCeilingCents,
      maximumDiscountPct: Number(settings.maximumDiscountPct),
    });
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Mensalidade e pontualidade fora da faixa autorizada.",
    });
  }
  return { settings, preview };
}

type PersistContractInput = {
  database: FinanceDatabase;
  values: CreateMonthlyContractInput;
  staffUserId: string;
  terms: ReadyTerms;
};

async function persistContract(input: PersistContractInput): Promise<ContractListRow> {
  const { database, values, staffUserId, terms } = input;
  const { settings, preview } = terms;
  const contract = await database.contract.create({
    data: {
      commandId: values.commandId,
      commandFingerprint: contractFingerprint(values),
      payerId: values.payerId,
      studentId: values.studentId,
      agreedOn: toDateOnly(values.agreedOn),
      startsOn: toDateOnly(values.startsOn),
      durationMonths: values.durationMonths,
      endsOn: toDateOnly(preview.endsOn),
      monthlyAmountCents: values.monthlyAmountCents,
      tuitionCeilingCents: settings.tuitionCeilingCents,
      maximumDiscountPct: settings.maximumDiscountPct,
      punctualityDiscountPct: values.punctualityDiscountPct,
      interestRatePctDaily: settings.interestRatePctDaily,
      interestRatePctMonthly: settings.interestRatePctMonthly,
      cancellationFeePct: settings.cancellationFeePct,
      orders: {
        create: {
          kind: "CONTRACT",
          principalAmountCents: preview.principalAmountCents,
          startDate: toDateOnly(values.startsOn),
          dueDay: Number(values.firstDueDate.slice(DUE_DAY_START, DUE_DAY_END)),
          firstDueDate: toDateOnly(values.firstDueDate),
          installmentCount: values.durationMonths,
          createdById: staffUserId,
          updatedById: staffUserId,
          installments: {
            create: preview.installments.map((row) => ({
              sequenceNumber: row.sequenceNumber,
              amountCents: row.amountCents,
              dueDate: toDateOnly(row.dueDate),
              createdById: staffUserId,
              updatedById: staffUserId,
            })),
          },
        },
      },
    },
    select: contractSelect,
  });
  return toRow(contract);
}

export async function createMonthlyContract(input: {
  database: FinanceDatabase;
  values: CreateMonthlyContractInput;
  staffUserId: string;
}): Promise<ContractListRow> {
  const prior = await findCommandResult(input.database, input.values);
  if (prior) return prior;
  const terms = await readyTerms(input);
  return persistContract({ ...input, terms });
}

export async function listContracts(
  database: FinanceDatabase,
  options: { page: number; query?: string; now?: Date },
): Promise<{
  rows: ContractListRow[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const { page, query = "", now = new Date() } = options;
  const pageSize = 20;
  const where = {
    commandId: { not: null },
    deletedAt: null,
    ...(query.trim() === ""
      ? {}
      : {
          OR: [
            { student: { fullName: { contains: query.trim(), mode: "insensitive" as const } } },
            { payer: { name: { contains: query.trim(), mode: "insensitive" as const } } },
          ],
        }),
  };
  const [total, rows] = await Promise.all([
    database.contract.count({ where }),
    database.contract.findMany({
      where,
      select: contractSelect,
      orderBy: [{ agreedOn: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { rows: rows.map((row) => toRow(row, now)), page, pageSize, total };
}

export async function searchContractParties(
  database: FinanceDatabase,
  query: string,
): Promise<{
  students: Array<{ id: string; name: string }>;
  payers: Array<{ id: string; name: string }>;
}> {
  const [students, payers] = await Promise.all([
    database.student.findMany({
      where: { deletedAt: null, fullName: { contains: query, mode: "insensitive" } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 20,
    }),
    database.payer.findMany({
      where: { deletedAt: null, name: { contains: query, mode: "insensitive" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    }),
  ]);
  return { students: students.map((row) => ({ id: row.id, name: row.fullName })), payers };
}

export async function readContractOffer(database: FinanceDatabase): Promise<{
  tuitionCeilingCents: number;
  maximumDiscountPct: number;
  interestRatePctDaily: number;
  interestRatePctMonthly: number;
  cancellationFeePct: number;
} | null> {
  const row = await database.financeSettings.findUnique({ where: { id: "singleton" } });
  if (
    !row ||
    row.tuitionCeilingCents === null ||
    row.maximumDiscountPct === null ||
    row.interestRatePctDaily === null ||
    row.interestRatePctMonthly === null ||
    row.cancellationFeePct === null
  )
    return null;
  return {
    tuitionCeilingCents: row.tuitionCeilingCents,
    maximumDiscountPct: Number(row.maximumDiscountPct),
    interestRatePctDaily: Number(row.interestRatePctDaily),
    interestRatePctMonthly: Number(row.interestRatePctMonthly),
    cancellationFeePct: Number(row.cancellationFeePct),
  };
}
