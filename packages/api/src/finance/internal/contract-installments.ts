import { saoPauloDateOnly } from "@lazuli/domain";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { notFound } from "../../trpc/errors.js";
import { ledgerQuery } from "./installments-query.js";
import type { FinanceDatabase } from "./shared.js";

type Proof = { id: string; fileName: string; byteLength: number };
type ContractInstallment = Pick<
  FinanceInstallmentRow,
  | "installmentId"
  | "sequenceNumber"
  | "dueDate"
  | "status"
  | "expectedAmountCents"
  | "paidAmountCents"
  | "collectibleBalanceCents"
  | "overdueDays"
  | "suspendedUntil"
> & { hasPayments: boolean; proofs: Proof[] };

/** Uses the receivables ledger so the invoice shares its balances and status rules. */
export async function readContractInstallments(
  database: FinanceDatabase,
  { orderId, now }: { orderId: string; now: Date },
): Promise<{ asOf: string; rows: ContractInstallment[] }> {
  const order = await database.order.findFirst({
    where: {
      id: orderId,
      kind: "TUITION",
      deletedAt: null,
      cancelledAt: null,
      contract: { deletedAt: null },
    },
    select: { contract: { select: { studentId: true } } },
  });
  if (!order?.contract) throw notFound("Mensalidades não encontradas.");
  const asOf = saoPauloDateOnly(now);
  const rows = await ledgerQuery({
    kysely: database.$kysely,
    businessDate: asOf,
    studentId: order.contract.studentId,
    search: undefined,
  })
    .selectFrom("ledger")
    .where("orderId", "=", orderId)
    .select([
      "installmentId",
      "sequenceNumber",
      "dueDate",
      "status",
      "expectedAmountCents",
      "paidAmountCents",
      "collectibleBalanceCents",
      "overdueDays",
      "suspendedUntil",
    ])
    .orderBy("sequenceNumber", "asc")
    .orderBy("installmentId", "asc")
    .execute();
  const payments = await readProofsByInstallment(database, orderId);
  return {
    asOf,
    rows: rows.map((row) => ({
      ...row,
      hasPayments: payments.has(row.installmentId),
      proofs: [...(payments.get(row.installmentId)?.values() ?? [])],
    })),
  };
}

async function readProofsByInstallment(
  database: FinanceDatabase,
  orderId: string,
): Promise<Map<string, Map<string, Proof>>> {
  const allocations = await database.paymentAllocation.findMany({
    where: {
      deletedAt: null,
      installment: { orderId, deletedAt: null },
      paymentEntry: { deletedAt: null },
    },
    select: {
      installmentId: true,
      amountCents: true,
      reversals: {
        where: { deletedAt: null, reversal: { deletedAt: null } },
        select: { amountCents: true },
      },
      paymentEntry: {
        select: {
          proofs: {
            where: { deletedAt: null },
            select: { id: true, fileName: true, byteLength: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  const byInstallment = new Map<string, Map<string, Proof>>();
  for (const allocation of allocations) {
    const reversed = allocation.reversals.reduce((sum, reversal) => sum + reversal.amountCents, 0);
    if (allocation.amountCents <= reversed) continue;
    const proofs = byInstallment.get(allocation.installmentId) ?? new Map<string, Proof>();
    for (const proof of allocation.paymentEntry.proofs) proofs.set(proof.id, proof);
    byInstallment.set(allocation.installmentId, proofs);
  }
  return byInstallment;
}
