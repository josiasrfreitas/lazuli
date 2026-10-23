import type { TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { sql } from "kysely";
import { dateOnly, linkItem, type HomeItem } from "./home-model.js";

/** Match publication's effective entry date, sorting before taking a preview or page. */
export async function readSemesterPending(
  database: TransactionClient,
  { now, skip, take }: { now: Date; skip: number; take: number },
): Promise<{ total: number; items: HomeItem[] }> {
  const entryDate = sql<Date>`coalesce(placement.effective_date, semester.start_date)`;
  const base = database.$kysely
    .selectFrom("SemesterPlacement as placement")
    .innerJoin("Student as student", "student.id", "placement.student_id")
    .innerJoin("Semester as semester", "semester.id", "placement.semester_id")
    .where("placement.deleted_at", "is", null)
    .where("placement.declined_at", "is", null)
    .where("placement.published_at", "is", null)
    .where("student.deleted_at", "is", null)
    .where("student.status", "=", "ACTIVE")
    .where("semester.deleted_at", "is", null)
    .where("semester.end_date", ">=", new Date(saoPauloDateOnly(now)));
  const [count, rows] = await Promise.all([
    base.select(sql<number>`count(*)::int`.as("total")).executeTakeFirstOrThrow(),
    base.select([
      "placement.id", "placement.semester_id as semesterId", "placement.plan_id as planId",
      "student.full_name as studentName", "semester.name as semesterName", entryDate.as("entryDate"),
    ]).orderBy(entryDate).orderBy("placement.created_at").orderBy("placement.id")
      .offset(skip).limit(take).execute(),
  ]);
  return {
    total: count.total,
    items: rows.map(row => linkItem({
      id: row.id,
      title: row.studentName,
      detail: `Revisar proposta · ${row.semesterName}`,
      href: `/organizacao?semestre=${row.semesterId}${row.planId ? `&turma=${row.planId}` : "&visao=alunos"}`,
      date: dateOnly(row.entryDate),
      timing: { kind: "entry", date: dateOnly(row.entryDate) },
    })),
  };
}
