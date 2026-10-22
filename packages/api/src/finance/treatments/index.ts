import { createHash } from "node:crypto";
import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type {
  FinancialTreatmentPreview,
  FinancialTreatmentConfirm,
  FinancialTreatmentInstallments,
} from "@lazuli/validators";
import { badRequest } from "../../trpc/errors.js";
import { loadSettlementItems, settlementLine } from "../internal/settlement-data.js";
import { lockInstallments } from "../internal/payment-store.js";
import { type FinanceDatabase, toDateOnly, toDateOnlyString } from "../internal/shared.js";

type TreatmentDatabase = Pick<
  FinanceDatabase,
  "installment" | "installmentAgreement" | "installmentAdjustment" | "$queryRaw"
>;
type Actor = { id: string; name: string };
type TreatmentContext = { database: TreatmentDatabase; actor: Actor; now: Date; today: string };
type SettlementItem = Awaited<ReturnType<typeof loadSettlementItems>>[number];
type Party = { key: string; name: string };
type ScopedInstallment = { id: string; party: Party };
type TreatmentLine = {
  installmentId: string;
  party: Party;
  sequenceNumber: number;
  origin: SettlementItem["order"]["kind"];
  previousDueDate: string;
  newDueDate: string | null;
  chargesCents: number;
  reductionCents: number;
  balanceCents: number;
  resultingBalanceCents: number;
  newInterestCents: number;
  version: string;
};
type TreatmentPreview = { date: string; lines: TreatmentLine[]; version: string };
type AvailableInstallment = {
  id: string;
  party: Party;
  sequenceNumber: number;
  origin: SettlementItem["order"]["kind"];
  dueDate: string;
  balanceCents: number;
  chargesCents: number;
  suspendedUntil: string | null;
};
const historyInclude = {
  installment: { select: { sequenceNumber: true, order: { select: { kind: true } } } },
} satisfies Prisma.InstallmentAgreementInclude;
type HistoryRow = Prisma.InstallmentAgreementGetPayload<{ include: typeof historyInclude }>;

const hash = (value: object): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

function studentScope(studentId?: string): Prisma.InstallmentWhereInput {
  return {
    deletedAt: null,
    order: {
      deletedAt: null,
      cancelledAt: null,
      ...(studentId
        ? {
            OR: [
              { contract: { studentId, deletedAt: null } },
              { beneficiaries: { some: { studentId, deletedAt: null } } },
            ],
          }
        : {}),
    },
  };
}

export function financialTreatments(
  database: TreatmentDatabase,
  options: { actor: Actor; now: Date },
): {
  preview: (values: FinancialTreatmentPreview) => Promise<TreatmentPreview>;
  available: (scope: FinancialTreatmentInstallments) => Promise<AvailableInstallment[]>;
  history: (studentId: string) => Promise<HistoryRow[]>;
  confirm: (values: FinancialTreatmentConfirm) => Promise<{ count: number }>;
} {
  const context = {
    database,
    actor: options.actor,
    now: options.now,
    today: saoPauloDateOnly(options.now),
  };
  return {
    preview: (values) => previewTreatment(context, values),
    available: (scope) => availableTreatments(context, scope),
    history: (studentId) => treatmentHistory(context, studentId),
    confirm: (values) => confirmTreatment(context, values),
  };
}

async function scopedInstallments(
  database: TreatmentDatabase,
  where: Prisma.InstallmentWhereInput,
): Promise<ScopedInstallment[]> {
  const items = await database.installment.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    select: {
      id: true,
      order: {
        select: {
          id: true,
          payer: { select: { id: true, name: true } },
          contract: { select: { student: { select: { id: true, fullName: true } } } },
          beneficiaries: {
            where: { deletedAt: null },
            orderBy: { studentId: "asc" },
            select: { student: { select: { id: true, fullName: true } } },
          },
        },
      },
    },
  });
  return items.map(({ id, order }) => {
    const students = order.contract
      ? [order.contract.student]
      : order.beneficiaries.map(({ student }) => student);
    return {
      id,
      party: {
        key:
          students.length > 0
            ? students.map((student) => student.id).join(":")
            : `payer:${order.payer?.id ?? order.id}`,
        name:
          students.length > 0
            ? students.map((student) => student.fullName).join(" / ")
            : (order.payer?.name ?? "Sem aluno vinculado"),
      },
    };
  });
}

async function previewTreatment(
  context: TreatmentContext,
  values: FinancialTreatmentPreview,
): Promise<TreatmentPreview> {
  const { database, today, now } = context;
  const ids = values.rows.map((row) => row.installmentId);
  if (new Set(ids).size !== ids.length) throw badRequest("Parcela repetida.");
  if (values.newDueDate && values.newDueDate <= today)
    throw badRequest("O novo vencimento deve ser posterior a hoje.");
  const scoped = await scopedInstallments(database, {
    ...studentScope(values.studentId),
    id: { in: ids },
  });
  if (scoped.length !== ids.length)
    throw badRequest(
      values.studentId
        ? "Selecione parcelas deste aluno."
        : "Uma parcela não está mais disponível. Revise a seleção.",
    );
  const items = await loadSettlementItems(database, ids);
  const lines = values.rows.map((choice) =>
    previewLine({
      item: items.find((row) => row.id === choice.installmentId)!,
      party: scoped.find((row) => row.id === choice.installmentId)!.party,
      choice,
      newDueDate: values.newDueDate,
      today,
      now,
    }),
  );
  if (!values.newDueDate && lines.every((line) => line.reductionCents === 0))
    throw badRequest("Informe uma redução de encargos ou uma suspensão.");
  return { date: today, lines, version: hash({ today, values, lines }) };
}

function previewLine(input: {
  item: SettlementItem;
  party: Party;
  choice: FinancialTreatmentPreview["rows"][number];
  newDueDate: string | undefined;
  today: string;
  now: Date;
}): TreatmentLine {
  const { item, party, choice, newDueDate, today, now } = input;
  const line = settlementLine({ item, date: today, now });
  // A treatment is not a payment: punctuality discounts are not booked here.
  const balance = line.quote.balanceCents + line.quote.newInterestCents;
  if (balance <= 0) throw badRequest("Parcela quitada não aceita tratativa.");
  if (newDueDate && newDueDate < toDateOnlyString(item.dueDate))
    throw badRequest("A suspensão não pode antecipar o vencimento atual.");
  const charges = line.quote.outstandingChargesCents;
  const reduction = choice.forgiveCharges ? charges : choice.reductionCents;
  if (reduction > charges)
    throw badRequest(`Parcela ${item.sequenceNumber}: redução maior que os encargos em aberto.`);
  return {
    installmentId: item.id,
    party,
    sequenceNumber: item.sequenceNumber,
    origin: item.order.kind,
    previousDueDate: toDateOnlyString(item.dueDate),
    newDueDate: newDueDate ?? null,
    chargesCents: charges,
    reductionCents: reduction,
    balanceCents: balance,
    resultingBalanceCents: balance - reduction,
    newInterestCents: line.quote.newInterestCents,
    version: line.version,
  };
}

async function availableTreatments(
  context: TreatmentContext,
  scope: FinancialTreatmentInstallments,
): Promise<AvailableInstallment[]> {
  const { database, today, now } = context;
  const items = await scopedInstallments(database, {
    ...studentScope("studentId" in scope ? scope.studentId : undefined),
    ...(scope.installmentIds ? { id: { in: scope.installmentIds } } : {}),
    waivedAt: null,
  });
  const loaded = await loadSettlementItems(
    database,
    items.map((row) => row.id),
  );
  return loaded
    .map((item) => {
      const { quote } = settlementLine({ item, date: today, now });
      return {
        id: item.id,
        party: items.find((row) => row.id === item.id)!.party,
        sequenceNumber: item.sequenceNumber,
        origin: item.order.kind,
        dueDate: toDateOnlyString(item.dueDate),
        balanceCents: quote.balanceCents + quote.newInterestCents,
        chargesCents: quote.outstandingChargesCents,
        suspendedUntil: item.suspendedUntil ? toDateOnlyString(item.suspendedUntil) : null,
      };
    })
    .filter((row) => row.balanceCents > 0)
    .toSorted((left, right) => left.dueDate.localeCompare(right.dueDate));
}

function treatmentHistory(context: TreatmentContext, studentId: string): Promise<HistoryRow[]> {
  return context.database.installmentAgreement.findMany({
    where: { installment: studentScope(studentId) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    include: historyInclude,
  });
}

async function confirmTreatment(
  context: TreatmentContext,
  values: FinancialTreatmentConfirm,
): Promise<{ count: number }> {
  const { database } = context;
  await lockInstallments(
    database,
    values.rows.map((row) => row.installmentId),
  );
  const previous = await database.installmentAgreement.findMany({
    where: { commandId: values.commandId },
  });
  const fingerprint = hash(values);
  if (previous.length > 0) {
    if (previous.some((row) => row.commandFingerprint !== fingerprint))
      throw badRequest("Esta confirmação já foi usada para outra tratativa.");
    return { count: previous.length };
  }
  const { commandId, reason, version, ...request } = values;
  const result = await previewTreatment(context, request);
  if (result.version !== version)
    throw badRequest("As parcelas mudaram. Revise uma nova prévia antes de confirmar.");
  for (const line of result.lines)
    await persistTreatmentLine(context, { line, commandId, reason, fingerprint });
  return {
    count: result.lines.filter((line) => line.reductionCents > 0 || line.newDueDate).length,
  };
}

async function persistTreatmentLine(
  context: TreatmentContext,
  input: { line: TreatmentLine; commandId: string; reason: string; fingerprint: string },
): Promise<void> {
  const { database, actor, today } = context;
  const { line, commandId, reason, fingerprint } = input;
  if (line.reductionCents === 0 && !line.newDueDate) return;
  await recordAdjustments(context, { line, reason });
  await database.installmentAgreement.create({
    data: {
      commandId,
      commandFingerprint: fingerprint,
      installmentId: line.installmentId,
      effectiveDate: toDateOnly(today),
      previousDueDate: toDateOnly(line.previousDueDate),
      newDueDate: line.newDueDate ? toDateOnly(line.newDueDate) : null,
      previousChargesCents: line.chargesCents,
      reductionCents: line.reductionCents,
      previousBalanceCents: line.balanceCents,
      reason,
      actorId: actor.id,
      actorName: actor.name,
    },
  });
  if (line.newDueDate)
    await database.installment.update({
      where: { id: line.installmentId },
      data: {
        dueDate: toDateOnly(line.newDueDate),
        suspendedUntil: toDateOnly(line.newDueDate),
        updatedById: actor.id,
        overdueD30EmailSentAt: null,
      },
    });
}

async function recordAdjustments(
  context: TreatmentContext,
  input: { line: TreatmentLine; reason: string },
): Promise<void> {
  const { database, actor, today } = context;
  const { line, reason } = input;
  for (const adjustment of [
    {
      type: "INTEREST" as const,
      amountCents: line.newInterestCents,
      chargeOnly: false,
      reason: "Juros apurados na tratativa",
    },
    { type: "CORRECTION" as const, amountCents: -line.reductionCents, chargeOnly: true, reason },
  ])
    if (adjustment.amountCents !== 0)
      await database.installmentAdjustment.create({
        data: {
          ...adjustment,
          installmentId: line.installmentId,
          effectiveDate: toDateOnly(today),
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
}

export { addInstallmentAdjustment, waiveInstallment } from "./legacy-actions.js";
export type { AddInstallmentAdjustmentResult, WaiveInstallmentResult } from "./legacy-actions.js";
