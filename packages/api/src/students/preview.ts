import type { StudentListRow } from "@lazuli/validators";

import { notFound, STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
import { findStudentRow, type StudentListDatabase } from "./list-query.js";
import { buildRows, resolveCurrentSemester } from "./list.js";

type PreviewStudentInput = {
  database: StudentListDatabase;
  values: { id: string; now: Date; staffUserId: string };
};

/**
 * One student in the exact row shape of `students.list`. The preview panel is
 * opened by `?aluno=<id>` and must render the same derived facts even when the
 * row is not on the currently loaded page (direct link, changed filters).
 */
export async function previewStudent(input: PreviewStudentInput): Promise<StudentListRow> {
  const student = await findStudentRow({ database: input.database, id: input.values.id });

  if (student === null) {
    throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  }

  const semester = await resolveCurrentSemester(input.database, input.values.now);
  const [row] = await buildRows({
    database: input.database,
    values: input.values,
    students: [student],
    semester,
  });

  if (row === undefined) {
    throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  }

  return row;
}
