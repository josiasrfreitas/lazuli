import { upcomingMaterial } from "./upcoming-material.js";
import { Prisma } from "@lazuli/db/prisma";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  candidateConditions,
  FINANCIAL_STATUS,
  STATUS_FACTS,
  type ContractStatusPageOptions,
} from "./contract-status-page.js";
import type { FinanceDatabase } from "./shared.js";

const STUDENTS_PER_PAGE = 25;

/** Page students before hydrating their contracts so each disclosure owns the complete group. */
export async function groupedContractPage(
  database: FinanceDatabase,
  options: ContractStatusPageOptions & { followUp?: boolean | undefined },
): Promise<{
  total: number;
  ids: string[];
  renewals: Set<string | null>;
  materials: Map<string, string | null>;
}> {
  const today = saoPauloDateOnly(options.now);
  const rows = await database.$queryRaw<
    Array<{
      id: string | null;
      student_id: string;
      renewal: boolean;
      material: string | null;
      total: bigint;
    }>
  >(Prisma.sql`
    WITH params AS (SELECT ${today}::date AS today),
    filtered AS (
      SELECT c.id, c.student_id, c.ends_on, c.terminated_at,
        (c.terminated_at IS NULL AND s.status = 'ACTIVE' AND c.ends_on BETWEEN params.today AND params.today + 60
         AND NOT EXISTS (SELECT 1 FROM "Contract" r WHERE r.renewed_from_id = c.id AND r.deleted_at IS NULL AND r.terminated_at IS NULL)) AS renewal
      FROM "Contract" c JOIN "Student" s ON s.id=c.student_id JOIN "Payer" p ON p.id=c.payer_id CROSS JOIN params
      WHERE ${candidateConditions(options)} AND s.deleted_at IS NULL
    ), matches AS (
      SELECT filtered.* FROM filtered CROSS JOIN params
      ${options.status ? Prisma.sql`${STATUS_FACTS} WHERE ${FINANCIAL_STATUS} = ${options.status}` : Prisma.empty}
    ), candidates AS (
      SELECT student_id, bool_or(renewal) AS renewal, min(ends_on) FILTER (WHERE ends_on >= params.today) AS next_end FROM matches CROSS JOIN params GROUP BY student_id
    ), students AS (
      SELECT candidates.*, need.name AS material FROM candidates CROSS JOIN params
      LEFT JOIN LATERAL (
        ${upcomingMaterial(Prisma.sql`candidates.student_id`)}
      ) need ON true
    ), eligible AS (SELECT * FROM students ${options.followUp ? Prisma.sql`WHERE renewal OR material IS NOT NULL` : Prisma.empty}),
    page AS (SELECT * FROM eligible ORDER BY next_end NULLS LAST,student_id LIMIT ${STUDENTS_PER_PAGE} OFFSET ${(options.page - 1) * STUDENTS_PER_PAGE})
    SELECT totals.total, m.id, m.student_id, m.renewal, page.material FROM (SELECT count(*) AS total FROM eligible) totals
    LEFT JOIN page ON true LEFT JOIN matches m ON m.student_id=page.student_id ORDER BY page.next_end NULLS LAST,page.student_id,m.ends_on DESC,m.id
  `);
  return {
    total: Number(rows[0]?.total ?? 0),
    ids: rows.flatMap((row) => (row.id ? [row.id] : [])),
    renewals: new Set(rows.filter((row) => row.renewal).map((row) => row.id)),
    materials: new Map(rows.map((row) => [row.student_id, row.material])),
  };
}
