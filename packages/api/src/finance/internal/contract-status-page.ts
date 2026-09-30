import { Prisma } from "@lazuli/db/prisma";
import { saoPauloDateOnly, type ContractFinancialStatus } from "@lazuli/domain";

import type { FinanceDatabase } from "./shared.js";

const PAGE_SIZE = 20;

/** The same registered balances and paid-installment rule used by the domain summary. */
const STATUS_FACTS = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT o.id, o.cancelled_at, o.installment_count
    FROM "Order" o
    WHERE o.contract_id = filtered.id AND o.kind = 'TUITION'
    LIMIT 1
  ) contract_order ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(CASE
        WHEN i.due_date < params.today AND i.waived_at IS NULL
        THEN GREATEST(i.amount_cents + adjustment.amount - allocation.amount, 0)
        ELSE 0 END), 0) AS overdue_cents,
      COALESCE(SUM(CASE
        WHEN i.due_date >= params.today AND i.waived_at IS NULL
        THEN GREATEST(i.amount_cents + adjustment.amount - allocation.amount, 0)
        ELSE 0 END), 0) AS current_future_cents,
      COALESCE(SUM(CASE
        WHEN i.waived_at IS NULL AND allocation.amount > 0
          AND allocation.amount >= i.amount_cents + adjustment.amount
        THEN 1 ELSE 0 END), 0) AS paid_count
    FROM "Installment" i
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a.amount_cents), 0) AS amount
      FROM "InstallmentAdjustment" a
      WHERE a.installment_id = i.id AND a.deleted_at IS NULL
    ) adjustment ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a.amount_cents), 0) AS amount
      FROM "PaymentAllocation" a
      WHERE a.installment_id = i.id AND a.deleted_at IS NULL
    ) allocation ON true
    WHERE i.order_id = contract_order.id AND i.deleted_at IS NULL
  ) facts ON true
`;

const FINANCIAL_STATUS = Prisma.sql`
  CASE
    WHEN contract_order.cancelled_at IS NOT NULL THEN 'CANCELADO'
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
  const query = options.query?.trim();
  if (query) {
    conditions.push(Prisma.sql`(
      strpos(lower(s.full_name), lower(${query})) > 0 OR
      strpos(lower(p.name), lower(${query})) > 0
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
      SELECT c.id, c.agreed_on
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
