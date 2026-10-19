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

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const studentScope = (studentId?: string) => ({
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
});

export function financialTreatments(
  database: Pick<
    FinanceDatabase,
    "installment" | "installmentAgreement" | "installmentAdjustment" | "$queryRaw"
  >,
  actor: { id: string; name: string },
  now: Date,
) {
  const today = saoPauloDateOnly(now);
  async function scopedInstallments(where: Prisma.InstallmentWhereInput) {
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
          key: students.length
            ? students.map((student) => student.id).join(":")
            : `payer:${order.payer?.id ?? order.id}`,
          name: students.length
            ? students.map((student) => student.fullName).join(" / ")
            : (order.payer?.name ?? "Sem aluno vinculado"),
        },
      };
    });
  }
  async function preview(values: FinancialTreatmentPreview) {
    const ids = values.rows.map((row) => row.installmentId);
    if (new Set(ids).size !== ids.length) throw badRequest("Parcela repetida.");
    if (values.newDueDate && values.newDueDate <= today)
      throw badRequest("O novo vencimento deve ser posterior a hoje.");
    const scoped = await scopedInstallments({ ...studentScope(values.studentId), id: { in: ids } });
    if (scoped.length !== ids.length)
      throw badRequest(
        values.studentId
          ? "Selecione parcelas deste aluno."
          : "Uma parcela não está mais disponível. Revise a seleção.",
      );
    const items = await loadSettlementItems(database, ids);
    const lines = values.rows.map((choice) => {
      const item = items.find((row) => row.id === choice.installmentId)!;
      const line = settlementLine({ item, date: today, now });
      // A treatment is not a payment: punctuality discounts are not booked here.
      const balance = line.quote.balanceCents + line.quote.newInterestCents;
      if (balance <= 0) throw badRequest("Parcela quitada não aceita tratativa.");
      if (values.newDueDate && values.newDueDate < toDateOnlyString(item.dueDate))
        throw badRequest("A suspensão não pode antecipar o vencimento atual.");
      const charges = line.quote.outstandingChargesCents;
      const reduction = choice.forgiveCharges ? charges : choice.reductionCents;
      if (reduction > charges)
        throw badRequest(
          `Parcela ${item.sequenceNumber}: redução maior que os encargos em aberto.`,
        );
      return {
        installmentId: item.id,
        party: scoped.find((row) => row.id === item.id)!.party,
        sequenceNumber: item.sequenceNumber,
        origin: item.order.kind,
        previousDueDate: toDateOnlyString(item.dueDate),
        newDueDate: values.newDueDate ?? null,
        chargesCents: charges,
        reductionCents: reduction,
        balanceCents: balance,
        resultingBalanceCents: balance - reduction,
        newInterestCents: line.quote.newInterestCents,
        version: line.version,
      };
    });
    if (!values.newDueDate && lines.every((line) => line.reductionCents === 0))
      throw badRequest("Informe uma redução de encargos ou uma suspensão.");
    return { date: today, lines, version: hash({ today, values, lines }) };
  }
  return {
    preview,
    async available(scope: FinancialTreatmentInstallments) {
      const items = await scopedInstallments({
        ...studentScope("studentId" in scope ? scope.studentId : undefined),
        ...("installmentIds" in scope ? { id: { in: scope.installmentIds } } : {}),
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
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    },
    history(studentId: string) {
      return database.installmentAgreement.findMany({
        where: { installment: studentScope(studentId) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        include: {
          installment: { select: { sequenceNumber: true, order: { select: { kind: true } } } },
        },
      });
    },
    async confirm(values: FinancialTreatmentConfirm) {
      await lockInstallments(
        database,
        values.rows.map((row) => row.installmentId),
      );
      const previous = await database.installmentAgreement.findMany({
        where: { commandId: values.commandId },
      });
      const fingerprint = hash(values);
      if (previous.length) {
        if (previous.some((row) => row.commandFingerprint !== fingerprint))
          throw badRequest("Esta confirmação já foi usada para outra tratativa.");
        return { count: previous.length };
      }
      const { commandId, reason, version, ...request } = values;
      const result = await preview(request);
      if (result.version !== version)
        throw badRequest("As parcelas mudaram. Revise uma nova prévia antes de confirmar.");
      for (const line of result.lines) {
        if (line.reductionCents === 0 && !line.newDueDate) continue;
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
            reason,
          },
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
      return {
        count: result.lines.filter((line) => line.reductionCents > 0 || line.newDueDate).length,
      };
    },
  };
}

export { addInstallmentAdjustment, waiveInstallment } from "./legacy-actions.js";
export type { AddInstallmentAdjustmentResult, WaiveInstallmentResult } from "./legacy-actions.js";
