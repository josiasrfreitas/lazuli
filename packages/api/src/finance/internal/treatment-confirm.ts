import type { InstallmentAgreement, Order } from "@lazuli/db";
import type { FinancialTreatmentConfirm } from "@lazuli/validators";
import { badRequest } from "../../trpc/errors.js";
import { lockInstallments } from "./payment-store.js";
import { previewTreatment, treatmentHash, type TreatmentLine } from "./treatment-preview.js";
import { treatmentScope } from "./treatment-data.js";
import { type FinanceDatabase, toDateOnly } from "./shared.js";

type ConfirmInput = {
  database: FinanceDatabase;
  values: FinancialTreatmentConfirm;
  actor: { id: string; name: string };
  now: Date;
};

export async function confirmTreatment(input: ConfirmInput): Promise<{ count: number }> {
  const { database, values, now } = input;
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${values.commandId}, 0))`;
  await lockInstallments(
    database,
    values.rows.map((row) => row.installmentId),
  );
  const previous = await database.installmentAgreement.findMany({
    where: { commandId: values.commandId },
  });
  const fingerprint = treatmentHash(values);
  if (previous.length > 0) {
    if (previous.some((row) => row.commandFingerprint !== fingerprint))
      throw badRequest("Esta confirmação já foi usada para outra tratativa.");
    return { count: previous.length };
  }
  const { commandId: _commandId, reason: _reason, version, ...request } = values;
  const result = await previewTreatment(database, { values: request, now });
  if (result.version !== version)
    throw badRequest("As parcelas mudaram. Revise uma nova prévia antes de confirmar.");
  const changed = result.lines.filter(
    (line) => line.reductionCents > 0 || line.newDueDate !== null,
  );
  for (const line of changed)
    await persistTreatmentLine(input, { line, today: result.date, fingerprint });
  return { count: changed.length };
}

async function persistTreatmentLine(
  input: ConfirmInput,
  context: { line: TreatmentLine; today: string; fingerprint: string },
): Promise<void> {
  const { database, values, actor } = input;
  const { line, today, fingerprint } = context;
  await treatmentAdjustments(input, { line, today });
  await database.installmentAgreement.create({
    data: {
      commandId: values.commandId,
      commandFingerprint: fingerprint,
      installmentId: line.installmentId,
      effectiveDate: toDateOnly(today),
      previousDueDate: toDateOnly(line.previousDueDate),
      newDueDate: line.newDueDate ? toDateOnly(line.newDueDate) : null,
      previousChargesCents: line.chargesCents,
      reductionCents: line.reductionCents,
      previousBalanceCents: line.balanceCents,
      reason: values.reason,
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

async function treatmentAdjustments(
  input: ConfirmInput,
  context: { line: TreatmentLine; today: string },
): Promise<void> {
  const { database, values, actor } = input;
  const { line, today } = context;
  for (const adjustment of [
    {
      type: "INTEREST" as const,
      amountCents: line.newInterestCents,
      chargeOnly: false,
      reason: "Juros apurados na tratativa",
    },
    {
      type: "CORRECTION" as const,
      amountCents: -line.reductionCents,
      chargeOnly: true,
      reason: values.reason,
    },
  ]) {
    if (adjustment.amountCents === 0) continue;
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
}

type TreatmentHistoryRow = InstallmentAgreement & {
  installment: { sequenceNumber: number; order: { kind: Order["kind"] } };
};

export async function treatmentHistory(
  database: FinanceDatabase,
  studentId: string,
): Promise<TreatmentHistoryRow[]> {
  return database.installmentAgreement.findMany({
    where: { installment: treatmentScope(studentId) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    include: {
      installment: { select: { sequenceNumber: true, order: { select: { kind: true } } } },
    },
  });
}
