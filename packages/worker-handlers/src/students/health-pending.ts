import { readStudentHealth, type DatabaseClient } from "@lazuli/db";
import { nextHealthPendingState } from "@lazuli/domain";

const BATCH_SIZE = 50;

/** Run outside web requests. Each student's read and state transition are serialized. */
export async function refreshStudentHealthPending(database: DatabaseClient): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const students = await database.student.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const student of students) {
      await database.$transaction(
        async (tx) => {
          const key = `student-health:${student.id}`;
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS locked`;
          const now = new Date();
          const current = await tx.student.findFirst({
            where: { id: student.id, deletedAt: null },
            select: { status: true },
          });
          const health =
            current?.status === "ACTIVE"
              ? await readStudentHealth({ database: tx, id: student.id, now })
              : null;
          const score = health?.score ?? null;
          const previous = await tx.studentHealthPending.findUnique({
            where: { studentId: student.id },
          });
          const state = nextHealthPendingState(previous, score, now);
          await tx.studentHealthPending.upsert({
            where: { studentId: student.id },
            create: { studentId: student.id, score, ...state, evaluatedAt: now },
            update: { score, ...state, evaluatedAt: now, deletedAt: null },
          });
        },
        { timeout: 30_000 },
      );
    }
    if (students.length < BATCH_SIZE) return;
    cursor = students.at(-1)!.id;
  }
}
