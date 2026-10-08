import { saoPauloDateOnly } from "@lazuli/domain";
import type { enrollmentCandidateSearchInputSchema, z } from "@lazuli/validators";
import { studentSearchQuery, type StudentSearchResult } from "../students/search.js";
import { loadEnrollableClass, type EnrollmentDatabase } from "./data.js";
import { conflictingStudents } from "./eligibility.js";

export async function searchEnrollmentCandidates(input: {
  database: EnrollmentDatabase;
  values: z.infer<typeof enrollmentCandidateSearchInputSchema>;
  now: Date;
}): Promise<StudentSearchResult[]> {
  const classRow = await loadEnrollableClass({
    database: input.database,
    classId: input.values.classId,
  });
  const conflicts = conflictingStudents({
    database: input.database,
    classId: classRow.id,
    stageId:
      classRow.scheduleType === "REGULAR" ? classRow.sharedStageId : (input.values.stageId ?? null),
    entryDate: input.values.entryDate ?? new Date(saoPauloDateOnly(input.now)),
  });
  return studentSearchQuery(input.database, input.values.query)
    .where("student.status", "=", "ACTIVE")
    .where("student.id", "not in", conflicts)
    .execute();
}
