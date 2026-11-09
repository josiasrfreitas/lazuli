import { normalizeSearch } from "@lazuli/domain";
import { searchMatchSql } from "../../search.js";
import { Prisma } from "@lazuli/db/prisma";
import { saoPauloDateOnly, type ContractFinancialStatus } from "@lazuli/domain";

import type { FinanceDatabase } from "./shared.js";

const PAGE_SIZE = 25;

/** The same registered balances and paid-installment rule used by the domain summary. */
const STATUS_FACTS = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT bool_and(o.cancelled_at IS NOT NULL) AS cancelled, COALESCE(SUM(o.installment_count), 0) AS installment_count
    FROM "Order" o
    WHERE o.contract_id = filtered.id AND o.kind = 'TUITION' AND o.deleted_at IS NULL
  ) contract_order ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(CASE
        WHEN i.due_date < params.today AND i.waived_at IS NULL AND o.cancelled_at IS NULL
        THEN GREATEST(i.amount_cents + adjustment.amount - allocation.amount, 0)
        ELSE 0 END), 0) AS overdue_cents,
      COALESCE(SUM(CASE
        WHEN i.due_date >= params.today AND i.waived_at IS NULL AND o.cancelled_at IS NULL
        THEN GREATEST(i.amount_cents + adjustment.amount - allocation.amount, 0)
        ELSE 0 END), 0) AS current_future_cents,
      COALESCE(SUM(CASE
        WHEN i.waived_at IS NULL AND allocation.amount > 0
          AND allocation.amount >= i.amount_cents + adjustment.amount
        THEN 1 ELSE 0 END), 0) AS paid_count
    FROM "Installment" i
    JOIN "Order" o ON o.id = i.order_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a.amount_cents), 0) AS amount
      FROM "InstallmentAdjustment" a
      WHERE a.installment_id = i.id AND a.deleted_at IS NULL
    ) adjustment ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a.amount_cents - COALESCE((
        SELECT SUM(ra.amount_cents)
        FROM payment_reversal_allocations ra
        JOIN payment_reversals reversal ON reversal.id = ra.payment_reversal_id
        WHERE ra.payment_allocation_id = a.id
          AND ra.deleted_at IS NULL AND reversal.deleted_at IS NULL
      ), 0)), 0) AS amount
      FROM "PaymentAllocation" a
      JOIN "PaymentEntry" p ON p.id = a.payment_entry_id AND p.deleted_at IS NULL
      WHERE a.installment_id = i.id AND a.deleted_at IS NULL
    ) allocation ON true
    WHERE o.contract_id = filtered.id AND o.kind = 'TUITION' AND o.deleted_at IS NULL AND i.deleted_at IS NULL
  ) facts ON true
`;

const FINANCIAL_STATUS = Prisma.sql`
  CASE
    WHEN filtered.terminated_at IS NOT NULL OR contract_order.cancelled THEN 'CANCELADO'
    WHEN facts.overdue_cents > 0 THEN 'INADIMPLENTE'
    WHEN contract_order.installment_count > 0
      AND facts.paid_count = contract_order.installment_count THEN 'QUITADO'
    WHEN facts.current_future_cents = 0 THEN 'SEM_SALDO'
    ELSE 'EM_DIA'
  END
`;

export type ContractStatusPageOptions = {
  page: number;
  query?: string | undefined;
  payerId?: string | undefined;
  studentId?: string | undefined;
  startsFrom?: string | undefined;
  endsTo?: string | undefined;
  status: ContractFinancialStatus;
  now: Date;
};

function candidateConditions(options: ContractStatusPageOptions): Prisma.Sql {
  const conditions = [Prisma.sql`c.command_id IS NOT NULL`, Prisma.sql`c.deleted_at IS NULL`];
  if (options.payerId) conditions.push(Prisma.sql`c.payer_id = ${options.payerId}::uuid`);
  if (options.studentId) conditions.push(Prisma.sql`c.student_id = ${options.studentId}::uuid`);
  if (options.startsFrom) conditions.push(Prisma.sql`c.ends_on >= ${options.startsFrom}::date`);
  if (options.endsTo) conditions.push(Prisma.sql`c.starts_on <= ${options.endsTo}::date`);
  const query = normalizeSearch(options.query ?? "");
  if (query) {
    conditions.push(Prisma.sql`(
      ${searchMatchSql(Prisma.sql`s.full_name`, query)} OR
      ${searchMatchSql(Prisma.sql`p.name`, query)}
    )`);
  }
  return Prisma.join(conditions, " AND ");
}

/** Return only page IDs and an exact total; hydrate the selected page separately. */
export async function contractStatusPage(
  database: FinanceDatabase,
  options: ContractStatusPageOptions,
): Promise<{ ids: string[]; total: number }> {
  const today = saoPauloDateOnly(options.now);
  const rows = await database.$queryRaw<Array<{ id: string | null; total: bigint }>>(Prisma.sql`
    WITH params AS (SELECT ${today}::date AS today),
    filtered AS MATERIALIZED (
      SELECT c.id, c.agreed_on, c.terminated_at
      FROM "Contract" c
      JOIN "Student" s ON s.id = c.student_id
      JOIN "Payer" p ON p.id = c.payer_id
      WHERE ${candidateConditions(options)}
    ),
    scored AS MATERIALIZED (
      SELECT filtered.id, filtered.agreed_on, ${FINANCIAL_STATUS} AS status
      FROM filtered CROSS JOIN params
      ${STATUS_FACTS}
    ),
    matching AS MATERIALIZED (
      SELECT id, agreed_on FROM scored WHERE status = ${options.status}
    )
    SELECT totals.total, page.id
    FROM (SELECT COUNT(*) AS total FROM matching) totals
    LEFT JOIN LATERAL (
      SELECT id FROM matching
      ORDER BY agreed_on DESC, id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${(options.page - 1) * PAGE_SIZE}
    ) page ON true
  `);
  return {
    ids: rows.flatMap((row) => (row.id ? [row.id] : [])),
    total: Number(rows[0]?.total ?? 0),
  };
}
