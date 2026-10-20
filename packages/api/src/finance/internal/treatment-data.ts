import type { Prisma, Order } from "@lazuli/db";
import {
  FINANCIAL_TREATMENT_PAGE_SIZE,
  type FinancialTreatmentInstallments,
} from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { sql } from "kysely";
import { badRequest } from "../../trpc/errors.js";
import { ledgerQuery } from "./installments-query.js";
import { loadSettlementItems, settlementLine } from "./settlement-data.js";
import { type FinanceDatabase, toDateOnlyString } from "./shared.js";

const MAX_SELECTION_SIZE = 100;

export type TreatmentParty = { key: string; name: string };
export type TreatmentRow = {
  id: string;
  party: TreatmentParty;
  sequenceNumber: number;
  origin: Order["kind"];
  dueDate: string;
  balanceCents: number;
  chargesCents: number;
  suspendedUntil: string | null;
};

export function treatmentScope(studentId?: string): Prisma.InstallmentWhereInput {
  return {
    deletedAt: null,
    order: {
      deletedAt: null,
      cancelledAt: null,
      OR: [
        { contractId: null, payer: { deletedAt: null } },
        { contract: { deletedAt: null, student: { deletedAt: null }, payer: { deletedAt: null } } },
      ],
      ...(studentId
        ? {
            AND: {
              OR: [
                { contract: { studentId } },
                {
                  beneficiaries: {
                    some: { studentId, deletedAt: null, student: { deletedAt: null } },
                  },
                },
              ],
            },
          }
        : {}),
    },
  };
}

export async function treatmentParties(
  database: FinanceDatabase,
  input: { ids: string[]; studentId?: string | undefined },
): Promise<Map<string, TreatmentParty>> {
  const { ids, studentId } = input;
  const rows = await database.installment.findMany({
    where: { ...treatmentScope(studentId), id: { in: ids } },
    select: {
      id: true,
      order: {
        select: {
          id: true,
          payer: { select: { id: true, name: true } },
          contract: { select: { student: { select: { id: true, fullName: true } } } },
          beneficiaries: {
            where: { deletedAt: null, student: { deletedAt: null } },
            orderBy: { studentId: "asc" },
            select: { student: { select: { id: true, fullName: true } } },
          },
        },
      },
    },
  });
  return new Map(
    rows.map(({ id, order }) => {
      const students = order.contract
        ? [order.contract.student]
        : order.beneficiaries.map(({ student }) => student);
      return [
        id,
        {
          key:
            students.length > 0
              ? students.map((student) => student.id).join(":")
              : `payer:${order.payer?.id ?? order.id}`,
          name:
            students.length > 0
              ? students.map((student) => student.fullName).join(" / ")
              : (order.payer?.name ?? "Sem aluno vinculado"),
        },
      ];
    }),
  );
}

export function treatmentParty(parties: Map<string, TreatmentParty>, id: string): TreatmentParty {
  const party = parties.get(id);
  if (!party) throw badRequest("Uma parcela não está mais disponível. Revise a seleção.");
  return party;
}

export async function treatmentInstallments(
  database: FinanceDatabase,
  input: { values: FinancialTreatmentInstallments; now: Date },
): Promise<{ rows: TreatmentRow[]; nextCursor: number | null }> {
  const { values, now } = input;
  const page = values.cursor ?? 1;
  const pageSize = values.installmentIds ? MAX_SELECTION_SIZE : FINANCIAL_TREATMENT_PAGE_SIZE;
  let query = ledgerQuery({
    kysely: database.$kysely,
    businessDate: saoPauloDateOnly(now),
    studentId: values.studentId,
    search: undefined,
  })
    .selectFrom("ledger")
    .select("installmentId")
    .where("collectibleBalanceCents", ">", 0)
    .where(
      sql<boolean>`not exists (select 1 from "Order" o join "Contract" c on c.id = o.contract_id join "Student" s on s.id = c.student_id where o.id = ledger."orderId" and (c.deleted_at is not null or s.deleted_at is not null))`,
    );
  if (values.installmentIds) query = query.where("installmentId", "in", values.installmentIds);
  const ids = await query
    .orderBy("dueDate", "asc")
    .orderBy("installmentId", "asc")
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize)
    .execute();
  const selected = ids.slice(0, pageSize).map((row) => row.installmentId);
  const parties = await treatmentParties(database, { ids: selected, studentId: values.studentId });
  const items = await loadSettlementItems(database, selected);
  const rows = items
    .filter((item) => parties.has(item.id))
    .map((item) => {
      const { quote } = settlementLine({ item, date: saoPauloDateOnly(now), now });
      return {
        id: item.id,
        party: treatmentParty(parties, item.id),
        sequenceNumber: item.sequenceNumber,
        origin: item.order.kind,
        dueDate: toDateOnlyString(item.dueDate),
        balanceCents: quote.balanceCents + quote.newInterestCents,
        chargesCents: quote.outstandingChargesCents,
        suspendedUntil: item.suspendedUntil ? toDateOnlyString(item.suspendedUntil) : null,
      };
    })
    .toSorted(
      (left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id),
    );
  return { rows, nextCursor: ids.length > pageSize ? page + 1 : null };
}
