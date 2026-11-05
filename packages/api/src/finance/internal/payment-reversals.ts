import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { financeReversePaymentInputSchema, z } from "@lazuli/validators";

import { badRequest, notFound } from "../../trpc/errors.js";
import { toDateOnlyString, type FinanceDatabase } from "./shared.js";

export type ReversePaymentInput = z.infer<typeof financeReversePaymentInputSchema>;

function fingerprint(input: ReversePaymentInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        paymentEntryId: input.paymentEntryId,
        kind: input.kind,
        occurredOn: input.occurredOn?.toISOString().slice(0, 10) ?? null,
        reason: input.reason?.trim() || null,
        refundMethod: input.refundMethod ?? null,
        refundReference: input.refundReference?.trim() || null,
        allocations: input.allocations.toSorted((a, b) =>
          a.paymentAllocationId.localeCompare(b.paymentAllocationId),
        ),
      }),
    )
    .digest("hex");
}

async function loadPayment(database: FinanceDatabase, paymentEntryId: string) {
  return database.paymentEntry.findFirst({
    where: { id: paymentEntryId, deletedAt: null },
    select: {
      id: true,
      date: true,
      payerId: true,
      amountCents: true,
      paymentMethod: { select: { name: true } },
      payer: { select: { name: true } },
      allocations: {
        where: { deletedAt: null },
        orderBy: { id: "asc" },
        select: {
          id: true,
          amountCents: true,
          installment: {
            select: {
              id: true,
              sequenceNumber: true,
              dueDate: true,
              order: { select: { kind: true } },
            },
          },
          reversals: {
            where: { deletedAt: null, reversal: { deletedAt: null } },
            select: { amountCents: true },
          },
        },
      },
      reversals: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          commandId: true,
          kind: true,
          occurredOn: true,
          createdAt: true,
          amountCents: true,
          reason: true,
          refundReference: true,
          method: { select: { name: true } },
          createdBy: { select: { name: true } },
          proofs: {
            where: { deletedAt: null },
            select: { id: true, fileName: true },
          },
        },
      },
    },
  });
}

export async function paymentReversalOptions(database: FinanceDatabase, paymentEntryId: string) {
  const payment = await loadPayment(database, paymentEntryId);
  if (!payment) throw notFound("Recebimento não encontrado.");
  const allocations = payment.allocations.map((allocation) => ({
    id: allocation.id,
    installmentId: allocation.installment.id,
    sequenceNumber: allocation.installment.sequenceNumber,
    dueDate: toDateOnlyString(allocation.installment.dueDate),
    kind: allocation.installment.order.kind,
    originalAmountCents: allocation.amountCents,
    availableAmountCents:
      allocation.amountCents -
      allocation.reversals.reduce((total, reversal) => total + reversal.amountCents, 0),
  }));
  const reversedCents = payment.reversals.reduce(
    (total, reversal) => total + reversal.amountCents,
    0,
  );
  const availableAmountCents = payment.amountCents - reversedCents;
  const unallocatedAmountCents =
    availableAmountCents -
    allocations.reduce((total, allocation) => total + allocation.availableAmountCents, 0);
  return {
    paymentEntryId: payment.id,
    date: toDateOnlyString(payment.date),
    payerId: payment.payerId,
    payerName: payment.payer.name,
    paymentMethodName: payment.paymentMethod.name,
    originalAmountCents: payment.amountCents,
    availableAmountCents,
    unallocatedAmountCents,
    allocations,
    reversals: payment.reversals.map(({ method, createdBy, ...reversal }) => ({
      ...reversal,
      occurredOn: toDateOnlyString(reversal.occurredOn),
      createdAt: reversal.createdAt.toISOString(),
      refundMethodName: method?.name ?? null,
      createdByName: createdBy.name,
    })),
  };
}

export async function reversePayment(input: {
  database: FinanceDatabase;
  values: ReversePaymentInput;
  staffUserId: string;
  now: Date;
}): Promise<{
  id: string;
  paymentEntryId: string;
  kind: ReversePaymentInput["kind"];
  amountCents: number;
}> {
  const { database, values } = input;
  const existing = await database.paymentReversal.findUnique({
    where: { commandId: values.commandId },
  });
  if (existing) return existingResult(existing, values);
  await database.$queryRaw`
    SELECT id FROM "PaymentEntry" WHERE id = ${values.paymentEntryId}::uuid FOR UPDATE
  `;
  const payment = await paymentReversalOptions(database, values.paymentEntryId);
  const amountCents = values.allocations.reduce((total, row) => total + row.amountCents, 0);
  if (amountCents > payment.availableAmountCents)
    throw badRequest("O valor supera o saldo disponível deste recebimento.");
  const allocationById = new Map(payment.allocations.map((row) => [row.id, row]));
  for (const row of values.allocations) {
    const allocation = allocationById.get(row.paymentAllocationId);
    if (!allocation || row.amountCents > allocation.availableAmountCents)
      throw badRequest("Uma das parcelas não possui esse valor disponível para reversão.");
  }
  if (values.kind === "REFUND") {
    if (!values.refundMethod) throw badRequest("Informe a forma usada na devolução.");
    const method = await database.paymentMethod.findFirst({
      where: { code: values.refundMethod, active: true, deletedAt: null },
      select: { code: true },
    });
    if (!method) throw badRequest("Selecione uma forma de devolução disponível.");
  }
  const today = saoPauloDateOnly(input.now);
  const occurredOn =
    values.kind === "CANCELLATION" ? new Date(`${today}T00:00:00.000Z`) : values.occurredOn;
  if (!occurredOn) throw badRequest("Informe a data da devolução.");
  if (toDateOnlyString(occurredOn) > today)
    throw badRequest("A data da devolução não pode estar no futuro.");
  if (values.kind === "REFUND" && toDateOnlyString(occurredOn) < payment.date)
    throw badRequest("A devolução não pode anteceder o recebimento.");
  const result = await database.paymentReversal.create({
    data: {
      commandId: values.commandId,
      commandFingerprint: fingerprint(values),
      paymentEntryId: values.paymentEntryId,
      kind: values.kind,
      occurredOn,
      amountCents,
      reason: values.reason?.trim() || null,
      refundMethod: values.kind === "REFUND" ? (values.refundMethod ?? null) : null,
      refundReference: values.kind === "REFUND" ? values.refundReference?.trim() || null : null,
      createdById: input.staffUserId,
      allocations: {
        create: values.allocations.map((row) => ({
          paymentAllocationId: row.paymentAllocationId,
          amountCents: row.amountCents,
        })),
      },
    },
    select: { id: true, paymentEntryId: true, kind: true, amountCents: true },
  });
  return result;
}

function existingResult(
  existing: {
    id: string;
    paymentEntryId: string;
    kind: ReversePaymentInput["kind"];
    amountCents: number;
    commandFingerprint: string;
  },
  values: ReversePaymentInput,
) {
  if (existing.commandFingerprint !== fingerprint(values))
    throw new TRPCError({
      code: "CONFLICT",
      message: "Esta operação já foi usada com outros dados.",
    });
  return {
    id: existing.id,
    paymentEntryId: existing.paymentEntryId,
    kind: existing.kind,
    amountCents: existing.amountCents,
  };
}
