import { createHash } from "node:crypto";
import { saoPauloDateOnly, terminationFeeCents } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { DEFAULT_TERMINATION_FEE_PCT, type ContractTerminationConfirm } from "@lazuli/validators";
import { closeEnrollment } from "../../enrollment/close.js";
import { lockStudentEnrollment } from "../../enrollment/data.js";
import { badRequest, notFound } from "../../trpc/errors.js";
import { loadSettlementItems, settlementLine } from "./settlement-data.js";
import { lockInstallments } from "./payment-store.js";
import { toDateOnly, toDateOnlyString, type FinanceDatabase } from "./shared.js";

const MAX_DATABASE_INTEGER_CENTS = 2_147_483_647;
const ISO_DAY_SUFFIX_START = -2;

const hash = (value: object): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const enrollmentSelect = {
  id: true,
  entryDate: true,
  exitDate: true,
  class: { select: { portalClassName: true } },
  actions: {
    where: { status: "SCHEDULED" },
    select: {
      id: true,
      kind: true,
      effectiveDate: true,
      semesterExits: { where: { publishedAt: { not: null } }, select: { id: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.EnrollmentSelect;
type Enrollment = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentSelect }>;
type TerminationLine = {
  id: string;
  sequence: number;
  dueDate: string;
  principalCents: number;
  chargesCents: number;
  version: string;
  paidCents: number;
};
type TerminationPreview = {
  contractId: string;
  studentId: string;
  studentName: string;
  today: string;
  openPrincipalCents: number;
  overduePrincipalCents: number;
  waivedFuturePrincipalCents: number;
  chargesCents: number;
  defaultFeePct: number;
  defaultFeeCents: number;
  lines: TerminationLine[];
  enrollments: {
    id: string;
    className: string;
    scheduledChanges: boolean;
    scheduledExitDate: string | null;
    semesterPublished: boolean;
  }[];
  version: string;
};

export async function previewContractTermination(
  database: FinanceDatabase,
  options: {
    contractId: string;
    now: Date;
  },
): Promise<TerminationPreview> {
  const { contractId, now } = options;

  const today = saoPauloDateOnly(now);
  const contract = await database.contract.findUnique({
    where: { id: contractId },
    include: { student: { select: { id: true, fullName: true } } },
  });
  if (!contract || contract.deletedAt) throw notFound("Contrato não encontrado.");
  if (contract.terminatedAt) throw badRequest("Este contrato já foi rescindido.");
  const [installmentIds, enrollments] = await Promise.all([
    terminationInstallmentIds(database, contractId),
    activeEnrollments(database, { studentId: contract.studentId, today }),
  ]);
  const settlementItems = await loadSettlementItems(database, installmentIds);
  const items = settlementItems.toSorted((left, right) => left.id.localeCompare(right.id));
  const lines = terminationLines(items, { today, now });
  const { openPrincipalCents, overduePrincipalCents, chargesCents } = terminationTotals(
    lines,
    today,
  );
  const defaultFeePct = Number(contract.cancellationFeePct ?? DEFAULT_TERMINATION_FEE_PCT);
  return {
    contractId,
    studentId: contract.studentId,
    studentName: contract.student.fullName,
    today,
    openPrincipalCents,
    overduePrincipalCents,
    waivedFuturePrincipalCents: openPrincipalCents - overduePrincipalCents,
    chargesCents,
    defaultFeePct,
    defaultFeeCents: terminationFeeCents(openPrincipalCents, defaultFeePct),
    lines,
    enrollments: enrollments.map((row) => projectEnrollment(row)),
    version: hash({ contract, today, lines, enrollments, items }),
  };
}

async function terminationInstallmentIds(
  database: FinanceDatabase,
  contractId: string,
): Promise<string[]> {
  const rows = await database.installment.findMany({
    where: {
      deletedAt: null,
      order: { contractId, kind: "TUITION", deletedAt: null, cancelledAt: null },
    },
    select: { id: true },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => row.id);
}

function terminationTotals(
  lines: TerminationLine[],
  today: string,
): Pick<TerminationPreview, "openPrincipalCents" | "overduePrincipalCents" | "chargesCents"> {
  return {
    openPrincipalCents: lines.reduce((sum, line) => sum + line.principalCents, 0),
    overduePrincipalCents: lines
      .filter((line) => line.dueDate <= today)
      .reduce((sum, line) => sum + line.principalCents, 0),
    chargesCents: lines.reduce((sum, line) => sum + line.chargesCents, 0),
  };
}

async function activeEnrollments(
  database: FinanceDatabase,
  options: { studentId: string; today: string },
): Promise<Enrollment[]> {
  const { studentId, today } = options;
  return database.enrollment.findMany({
    where: {
      studentId,
      deletedAt: null,
      entryDate: { lte: toDateOnly(today) },
      OR: [{ exitDate: null }, { exitDate: { gt: toDateOnly(today) } }],
    },
    select: enrollmentSelect,
    orderBy: { id: "asc" },
  });
}

function terminationLines(
  items: Awaited<ReturnType<typeof loadSettlementItems>>,
  options: { today: string; now: Date },
): TerminationLine[] {
  const { today, now } = options;
  return items
    .filter((item) => !item.waivedAt)
    .map((item) => {
      const { quote, version } = settlementLine({ item, date: today, now });
      const chargesCents = quote.outstandingChargesCents;
      const principalCents = Math.max(
        0,
        quote.balanceCents + quote.newInterestCents - chargesCents,
      );
      return {
        id: item.id,
        sequence: item.sequenceNumber,
        dueDate: toDateOnlyString(item.dueDate),
        principalCents,
        chargesCents,
        version,
        paidCents: item.allocations.reduce(
          (sum, allocation) =>
            sum +
            allocation.amountCents -
            allocation.reversals.reduce((total, reversal) => total + reversal.amountCents, 0),
          0,
        ),
      };
    })
    .filter((line) => line.principalCents > 0 || line.chargesCents > 0);
}

function projectEnrollment(row: Enrollment): TerminationPreview["enrollments"][number] {
  const exit = row.actions.find((action) => action.kind === "EXIT" || action.kind === "PAUSE");
  let scheduledExitDate: string | null = null;
  if (exit?.effectiveDate) scheduledExitDate = toDateOnlyString(exit.effectiveDate);
  else if (row.exitDate) scheduledExitDate = toDateOnlyString(row.exitDate);
  return {
    id: row.id,
    className: row.class.portalClassName,
    scheduledChanges: row.actions.length > 0 || row.exitDate !== null,
    scheduledExitDate,
    semesterPublished: row.actions.some((action) => action.semesterExits.length > 0),
  };
}

export async function confirmContractTermination(input: {
  database: FinanceDatabase;
  values: ContractTerminationConfirm;
  staffUserId: string;
  now: Date;
}): Promise<{ contractId: string; studentId: string }> {
  const { database, values, staffUserId, now } = input;
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${values.commandId}, 0))`;
  await database.$queryRaw`SELECT id FROM "Contract" WHERE id = ${values.contractId}::uuid FOR UPDATE`;
  const contract = await database.contract.findUnique({ where: { id: values.contractId } });
  if (!contract || contract.deletedAt) throw notFound("Contrato não encontrado.");
  const fingerprint = hash(values);
  if (contract.terminatedAt) {
    if (
      contract.terminationCommandId === values.commandId &&
      contract.terminationFingerprint === fingerprint
    )
      return { contractId: contract.id, studentId: contract.studentId };
    throw badRequest("Este contrato já foi rescindido.");
  }
  await lockTerminationBalances(database, contract);
  const preview = await previewContractTermination(database, {
    contractId: values.contractId,
    now,
  });
  const { feeCents, totalCents } = validateTermination(values, preview);
  const settlementOrderId = await createSettlementOrder({
    database,
    contract,
    values,
    preview,
    totalCents,
    staffUserId,
  });
  await persistTermination({
    database,
    contract,
    values,
    preview,
    feeCents,
    totalCents,
    settlementOrderId,
    staffUserId,
    now,
    fingerprint,
  });
  return { contractId: contract.id, studentId: contract.studentId };
}

async function lockTerminationBalances(
  database: FinanceDatabase,
  contract: Prisma.ContractGetPayload<Record<string, never>>,
): Promise<void> {
  await lockStudentEnrollment(database, contract.studentId);
  const ids = await database.installment.findMany({
    where: { order: { contractId: contract.id, kind: "TUITION" }, deletedAt: null },
    select: { id: true },
  });
  await lockInstallments(database, ids.map((row) => row.id).toSorted());
}

function validateTermination(
  values: ContractTerminationConfirm,
  preview: TerminationPreview,
): { feeCents: number; totalCents: number } {
  if (preview.version !== values.version)
    throw badRequest(
      "O contrato, as parcelas ou a matrícula mudaram. Atualize a prévia antes de confirmar.",
    );
  if (values.dueDate < preview.today)
    throw badRequest("O vencimento do acerto deve ser hoje ou uma data futura.");
  if (values.retainedChargesCents > preview.chargesCents)
    throw badRequest("Os encargos negociados não podem ultrapassar os encargos apurados.");
  assertEnrollmentSelection(values, preview);
  const feeCents = terminationFeeCents(preview.openPrincipalCents, values.feePct);
  const totalCents = preview.overduePrincipalCents + values.retainedChargesCents + feeCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > MAX_DATABASE_INTEGER_CENTS)
    throw badRequest("O valor do acerto ultrapassa o limite permitido.");
  return { feeCents, totalCents };
}

function assertEnrollmentSelection(
  values: ContractTerminationConfirm,
  preview: TerminationPreview,
): void {
  if (
    new Set(values.enrollmentIds).size !== values.enrollmentIds.length ||
    values.enrollmentIds.some((id) => !preview.enrollments.some((row) => row.id === id))
  )
    throw badRequest("Selecione apenas matrículas ativas deste aluno.");
  if (preview.enrollments.length > 0 && values.enrollmentIds.length === 0)
    throw badRequest("Selecione a matrícula que será encerrada com o contrato.");
  if (
    preview.enrollments.some((row) => values.enrollmentIds.includes(row.id) && row.scheduledChanges)
  )
    throw badRequest(
      "A matrícula tem alterações programadas. Resolva essas programações antes da rescisão.",
    );
}

async function createSettlementOrder(input: {
  database: FinanceDatabase;
  contract: Prisma.ContractGetPayload<Record<string, never>>;
  values: ContractTerminationConfirm;
  preview: TerminationPreview;
  totalCents: number;
  staffUserId: string;
}): Promise<string | null> {
  const { database, contract, values, preview, totalCents, staffUserId } = input;
  if (totalCents === 0) return null;
  const order = await database.order.create({
    data: {
      payerId: contract.payerId,
      kind: "OTHER",
      principalAmountCents: totalCents,
      startDate: toDateOnly(preview.today),
      dueDay: Number(values.dueDate.slice(ISO_DAY_SUFFIX_START)),
      firstDueDate: toDateOnly(values.dueDate),
      installmentCount: 1,
      createdById: staffUserId,
      updatedById: staffUserId,
      beneficiaries: {
        create: {
          studentId: contract.studentId,
          createdById: staffUserId,
          updatedById: staffUserId,
        },
      },
      installments: {
        create: {
          sequenceNumber: 1,
          amountCents: totalCents,
          dueDate: toDateOnly(values.dueDate),
          createdById: staffUserId,
          updatedById: staffUserId,
        },
      },
    },
  });
  return order.id;
}

async function persistTermination(input: {
  database: FinanceDatabase;
  contract: Prisma.ContractGetPayload<Record<string, never>>;
  values: ContractTerminationConfirm;
  preview: TerminationPreview;
  feeCents: number;
  totalCents: number;
  settlementOrderId: string | null;
  staffUserId: string;
  now: Date;
  fingerprint: string;
}): Promise<void> {
  const {
    database,
    contract,
    values,
    preview,
    feeCents,
    totalCents,
    settlementOrderId,
    staffUserId,
    now,
    fingerprint,
  } = input;
  await waiveOpenInstallments({ database, preview, values, now, staffUserId });
  for (const enrollmentId of values.enrollmentIds)
    await closeEnrollment({ database, enrollmentId, reason: "DROPPED", staffUserId, now });
  await database.contract.update({
    where: { id: contract.id },
    data: {
      terminatedAt: now,
      terminationCommandId: values.commandId,
      terminationFingerprint: fingerprint,
      terminationSnapshot: {
        ...preview,
        ...values,
        feeCents,
        totalCents,
        settlementOrderId,
        actorId: staffUserId,
      },
    },
  });
}

async function waiveOpenInstallments(input: {
  database: FinanceDatabase;
  preview: TerminationPreview;
  values: ContractTerminationConfirm;
  now: Date;
  staffUserId: string;
}): Promise<void> {
  const { database, preview, values, now, staffUserId } = input;
  // Preserve prior receipts and original amounts. Open balances are replaced by the reviewed settlement.
  await database.installment.updateMany({
    where: { id: { in: preview.lines.map((line) => line.id) } },
    data: {
      waivedAt: now,
      waivedReason: `Rescisão contratual: ${values.reason}`,
      updatedById: staffUserId,
    },
  });
}
