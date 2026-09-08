import type { studentSetStatusInputSchema, z } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";

import { notFound, STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
import type { StudentDatabase } from "./related-records.js";

type StudentSetStatusInput = z.infer<typeof studentSetStatusInputSchema>;
type LifecycleClosingStatus = Extract<StudentSetStatusInput["status"], "DROPPED" | "SUSPENDED">;

export async function setStudentStatus(input: {
  database: StudentDatabase;
  values: StudentSetStatusInput;
}): Promise<{ id: string }> {
  await assertStudentExists(input.database, input.values.id);

  await input.database.student.update({
    where: { id: input.values.id },
    data: { status: input.values.status },
    select: { id: true },
  });
  if (isLifecycleClosingStatus(input.values.status)) {
    await closeActiveAcademicLifecycleRows({
      database: input.database,
      effectiveDate: saoPauloDateOnly(new Date()),
      reason: input.values.status,
      studentId: input.values.id,
    });
  }

  return { id: input.values.id };
}

async function closeActiveAcademicLifecycleRows(input: {
  database: StudentDatabase;
  effectiveDate: string;
  reason: LifecycleClosingStatus;
  studentId: string;
}): Promise<void> {
  if (!(await tableExists(input.database, "Enrollment"))) {
    return;
  }

  const closedEnrollments = await input.database.$queryRaw<Array<{ id: string }>>`
    UPDATE "Enrollment"
    SET "exit_date" = ${input.effectiveDate}::date,
        "exit_reason" = ${input.reason}
    WHERE "student_id" = ${input.studentId}::uuid
      AND "exit_date" IS NULL
    RETURNING "id"::text AS "id"
  `;

  if (
    closedEnrollments.length === 0 ||
    !(await tableExists(input.database, "PedagogicalProgress"))
  ) {
    return;
  }

  const enrollmentIds = closedEnrollments.map((enrollment) => enrollment.id);
  await input.database.$executeRaw`
    UPDATE "PedagogicalProgress"
    SET "end_date" = ${input.effectiveDate}::date,
        "end_reason" = ${input.reason}
    WHERE "enrollment_id"::text = ANY(${enrollmentIds}::text[])
      AND "end_date" IS NULL
  `;
}

async function tableExists(database: StudentDatabase, tableName: string): Promise<boolean> {
  const rows = await database.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass(${`"${tableName}"`}) IS NOT NULL AS "exists"
  `;

  return rows[0]?.exists ?? false;
}

function isLifecycleClosingStatus(
  status: StudentSetStatusInput["status"],
): status is LifecycleClosingStatus {
  return status === "DROPPED" || status === "SUSPENDED";
}

async function assertStudentExists(database: StudentDatabase, id: string): Promise<void> {
  const student = await database.student.findUnique({ where: { id }, select: { id: true } });

  if (student === null) {
    throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  }
}
