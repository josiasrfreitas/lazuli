import type { TransactionClient } from "@lazuli/db";
import { Prisma } from "@lazuli/db/prisma";
import { linkItem, type HomeItem } from "./home-model.js";

type PlanningClass = {
  id: string;
  name: string;
  periodName: string;
  itemCount: number;
};

/** One pending item per class, across all configured academic periods. */
export async function readPlanningPending(
  database: TransactionClient,
  page: { skip: number; take: number },
): Promise<{ total: number; items: HomeItem[] }> {
  const affectedClasses = Prisma.sql`
    SELECT c.id, c.portal_class_name AS name, semester.name AS "periodName",
           COUNT(*)::int AS "itemCount"
    FROM "StagePlanItem" item
    JOIN "StagePlan" plan ON plan.id = item.plan_id
    JOIN "Class" c ON c.id = plan.class_id
    JOIN "Semester" semester ON semester.id = c.semester_id
    WHERE item.deleted_at IS NULL AND plan.deleted_at IS NULL
      AND c.deleted_at IS NULL AND semester.deleted_at IS NULL
      AND (item.planned_on < semester.start_date OR item.planned_on > semester.end_date)
      AND NOT EXISTS (
        SELECT 1 FROM "ClassSession" extra
        WHERE extra.class_id = c.id AND extra.date = item.planned_on
          AND extra.appointment_series_id IS NOT NULL AND extra.deleted_at IS NULL
          AND extra.status = 'SCHEDULED'
      )
    GROUP BY c.id, c.portal_class_name, semester.name
  `;
  const [counts, classes] = await Promise.all([
    database.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total FROM (${affectedClasses}) affected
    `),
    database.$queryRaw<PlanningClass[]>(Prisma.sql`
      SELECT * FROM (${affectedClasses}) affected
      ORDER BY "periodName", name, id
      LIMIT ${page.take} OFFSET ${page.skip}
    `),
  ]);
  return {
    total: counts[0]?.total ?? 0,
    items: classes.map((row) =>
      linkItem({
        id: row.id,
        title: row.name,
        detail: `${row.periodName} · ${row.itemCount} ${row.itemCount === 1 ? "item fora" : "itens fora"} do período letivo`,
        href: `/turmas/${row.id}?secao=planejamento&voltar=%2F`,
      }),
    ),
  };
}
