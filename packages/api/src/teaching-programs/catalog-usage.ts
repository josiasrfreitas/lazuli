import type { TransactionClient } from "@lazuli/db";

export type StageUsage = { classCount: number; studentCount: number };

export async function readStageUsage(
  db: Pick<TransactionClient, "$kysely">,
  today: Date,
): Promise<Map<string, StageUsage>> {
  const placements = db.$kysely
    .selectFrom("PedagogicalProgress as progress")
    .innerJoin("Enrollment as enrollment", "enrollment.id", "progress.enrollment_id")
    .innerJoin("Student as student", "student.id", "enrollment.student_id")
    .select(["progress.stage_id", "enrollment.class_id", "enrollment.student_id"])
    .where("progress.deleted_at", "is", null)
    .where("progress.start_date", "<=", today)
    .where((eb) =>
      eb.or([eb("progress.end_date", "is", null), eb("progress.end_date", ">=", today)]),
    )
    .where("student.deleted_at", "is", null)
    .where("enrollment.deleted_at", "is", null)
    .where("enrollment.entry_date", "<=", today)
    .where((eb) =>
      eb.or([eb("enrollment.exit_date", "is", null), eb("enrollment.exit_date", ">", today)]),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("EnrollmentAction as action")
            .select("action.id")
            .whereRef("action.enrollment_id", "=", "enrollment.id")
            .where("action.deleted_at", "is", null)
            .where("action.status", "=", "SCHEDULED")
            .where("action.kind", "in", ["PAUSE", "EXIT"])
            .where("action.effective_date", "<=", today),
        ),
      ),
    )
    .as("placement");

  // A regular class can teach its shared stage even with an empty roster.
  // A PPT class teaches each stage currently represented by its students.
  const rows = await db.$kysely
    .selectFrom("Class as c")
    .innerJoin("Semester as period", "period.id", "c.semester_id")
    .leftJoin(placements, "placement.class_id", "c.id")
    .where("c.deleted_at", "is", null)
    .where("c.status", "=", "ACTIVE")
    .where((eb) => eb.or([eb("c.start_date", "is", null), eb("c.start_date", "<=", today)]))
    .where("period.deleted_at", "is", null)
    .where("period.start_date", "<=", today)
    .where("period.end_date", ">=", today)
    .where((eb) =>
      eb.or([eb("placement.stage_id", "is not", null), eb("c.shared_stage_id", "is not", null)]),
    )
    .select((eb) => [
      eb.fn.coalesce("placement.stage_id", "c.shared_stage_id").$notNull().as("stageId"),
      eb.cast<number>(eb.fn.count("c.id").distinct(), "integer").as("classCount"),
      eb.cast<number>(eb.fn.count("placement.student_id").distinct(), "integer").as("studentCount"),
    ])
    .groupBy("stageId")
    .execute();
  return new Map(
    rows.map(({ stageId, classCount, studentCount }) => [stageId, { classCount, studentCount }]),
  );
}
