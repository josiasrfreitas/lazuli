import type { KyselyDatabase, TransactionClient } from "@lazuli/db";
import type { SelectQueryBuilder } from "kysely";
import { badRequest } from "../trpc/errors.js";
import { TRACK_ENROLLMENT_CONFLICT_MESSAGE } from "./errors.js";

type Eligibility = {
  database: Pick<TransactionClient, "$kysely">;
  classId: string;
  stageId: string | null;
  entryDate: Date;
};
type ConflictDatabase = KyselyDatabase & { enrollment: KyselyDatabase["Enrollment"] };

/** A new open-ended enrollment overlaps every existing window ending after its entry. */
export function conflictingStudents(
  input: Eligibility,
): SelectQueryBuilder<ConflictDatabase, "enrollment", { student_id: string }> {
  const query = input.database.$kysely
    .selectFrom("Enrollment as enrollment")
    .select("enrollment.student_id")
    .where("enrollment.deleted_at", "is", null)
    .where("enrollment.exit_date", "is", null);
  if (input.stageId === null) return query.where("enrollment.class_id", "=", input.classId);
  const track = input.database.$kysely
    .selectFrom("Stage")
    .select("track_id")
    .where("id", "=", input.stageId);
  return query.where((eb) =>
    eb.or([
      eb("enrollment.class_id", "=", input.classId),
      eb.and([
        eb.exists(
          eb
            .selectFrom("PedagogicalProgress as progress")
            .innerJoin("Stage as stage", "stage.id", "progress.stage_id")
            .select("progress.id")
            .whereRef("progress.enrollment_id", "=", "enrollment.id")
            .where("progress.end_date", "is", null)
            .where("progress.deleted_at", "is", null)
            .where("stage.deleted_at", "is", null)
            .where("stage.track_id", "=", track),
        ),
        eb.not(
          eb.exists(
            eb
              .selectFrom("EnrollmentAction as action")
              .select("action.id")
              .whereRef("action.enrollment_id", "=", "enrollment.id")
              .where("action.status", "=", "SCHEDULED")
              .where("action.kind", "in", ["PAUSE", "EXIT"])
              .where("action.effective_date", "<=", input.entryDate),
          ),
        ),
      ]),
    ]),
  );
}

export async function assertTrackAvailable(
  input: Eligibility & { studentId: string },
): Promise<void> {
  const conflict = await conflictingStudents(input)
    .where("enrollment.student_id", "=", input.studentId)
    .limit(1)
    .executeTakeFirst();
  if (conflict) throw badRequest(TRACK_ENROLLMENT_CONFLICT_MESSAGE);
}
