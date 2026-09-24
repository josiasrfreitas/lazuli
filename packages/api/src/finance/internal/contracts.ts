import { createHash } from "node:crypto";

import { deriveInstallmentLedger, previewMonthlyContract } from "@lazuli/domain";
import type { CreateMonthlyContractInput } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";

import { toDateOnly, toDateOnlyString, type FinanceDatabase } from "./shared.js";

export type ContractListRow = {
  id: string;
  payer: { id: string; name: string };
  student: {
    id: string;
    fullName: string;
    placements: Array<{ stage: string; classCode: string; modality: "PPT" | "Regular" }>;
  };
  agreedOn: string;
  startsOn: string;
  endsOn: string;
  monthlyAmountCents: number;
  principalAmountCents: number;
  installmentCount: number;
  firstDueDate: string;
  status: "INADIMPLENTE" | "EM_DIA" | "QUITADO" | "CANCELADO";
};

const contractSelect = {
  id: true,
  commandFingerprint: true,
  agreedOn: true,
  startsOn: true,
  endsOn: true,
  monthlyAmountCents: true,
  payer: { select: { id: true, name: true } },
  student: {
    select: {
      id: true,
      fullName: true,
      enrollments: {
        where: { deletedAt: null, exitDate: null },
        select: {
          class: { select: { scheduleType: true, internalCode: true } },
          progressRecords: {
            where: { deletedAt: null, endDate: null },
            select: { stage: { select: { name: true } } },
          },
        },
      },
    },
  },
  orders: {
    where: { kind: "CONTRACT" as const },
    select: {
      principalAmountCents: true,
      installmentCount: true,
      firstDueDate: true,
      cancelledAt: true,
      installments: {
        where: { deletedAt: null },
        select: {
          amountCents: true,
          dueDate: true,
          waivedAt: true,
          adjustments: { where: { deletedAt: null }, select: { amountCents: true } },
          allocations: { where: { deletedAt: null }, select: { amountCents: true } },
        },
      },
    },
    take: 1,
  },
} as const;

function toRow(
  row: {
    id: string;
    payer: { id: string; name: string };
    student: {
      id: string;
      fullName: string;
      enrollments: Array<{
        class: { scheduleType: "REGULAR" | "PERSONALIZED"; internalCode: string };
        progressRecords: Array<{ stage: { name: string } }>;
      }>;
    };
    agreedOn: Date | null;
    startsOn: Date | null;
    endsOn: Date | null;
    monthlyAmountCents: number | null;
    orders: Array<{
      principalAmountCents: number;
      installmentCount: number | null;
      firstDueDate: Date | null;
      cancelledAt: Date | null;
      installments: Array<{
        amountCents: number;
        dueDate: Date;
        waivedAt: Date | null;
        adjustments: Array<{ amountCents: number }>;
        allocations: Array<{ amountCents: number }>;
      }>;
    }>;
  },
  now = new Date(),
): ContractListRow {
  const order = row.orders[0];
  if (
    !order ||
    !row.agreedOn ||
    !row.startsOn ||
    !row.endsOn ||
    row.monthlyAmountCents === null ||
    !order.firstDueDate ||
    order.installmentCount === null
  ) {
    throw new Error("Contrato mensal incompleto.");
  }
  const ledgers = order.installments.map((installment) =>
    deriveInstallmentLedger({
      ...installment,
      orderCancelledAt: order.cancelledAt,
      now,
      interestRatePctMonthly: 0,
    }),
  );
  const status = order.cancelledAt
    ? "CANCELADO"
    : ledgers.some((ledger) => ledger.status === "OVERDUE" && ledger.collectibleRemainingCents > 0)
      ? "INADIMPLENTE"
      : ledgers.every((ledger) => ledger.collectibleRemainingCents === 0)
        ? "QUITADO"
        : "EM_DIA";
  return {
    id: row.id,
    payer: row.payer,
    student: {
      id: row.student.id,
      fullName: row.student.fullName,
      placements: row.student.enrollments.flatMap((enrollment) =>
        enrollment.progressRecords.map((progress) => ({
          stage: progress.stage.name,
          classCode: enrollment.class.internalCode,
          modality:
            enrollment.class.scheduleType === "PERSONALIZED"
              ? ("PPT" as const)
              : ("Regular" as const),
        })),
      ),
    },
    agreedOn: toDateOnlyString(row.agreedOn),
    startsOn: toDateOnlyString(row.startsOn),
    endsOn: toDateOnlyString(row.endsOn),
    monthlyAmountCents: row.monthlyAmountCents,
    principalAmountCents: order.principalAmountCents,
    installmentCount: order.installmentCount,
    firstDueDate: toDateOnlyString(order.firstDueDate),
    status,
  };
}

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

export async function createMonthlyContract(input: {
  database: FinanceDatabase;
  values: CreateMonthlyContractInput;
  staffUserId: string;
}): Promise<ContractListRow> {
  const { database, values, staffUserId } = input;
  const prior = await findCommandResult(database, values);
  if (prior) return prior;
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
          dueDay: Number(values.firstDueDate.slice(8, 10)),
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

export async function listContracts(
  database: FinanceDatabase,
  page: number,
  now = new Date(),
): Promise<{
  rows: ContractListRow[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const pageSize = 20;
  const where = { commandId: { not: null }, deletedAt: null };
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
