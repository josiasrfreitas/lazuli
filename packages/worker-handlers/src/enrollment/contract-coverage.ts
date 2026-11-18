import { contractAt, type DatabaseClient, type TransactionClient } from "@lazuli/db";
import { contractCoverageEnd } from "@lazuli/domain";
import { dateOnly } from "./semester-placement-data.js";

/** Recheck after the enrollment lock so a concurrent publication or termination cannot race the worker. */
export async function entryHasCoverage(
  database: TransactionClient,
  input: { enrollmentId: string; effectiveDate: Date },
): Promise<boolean> {
  const { studentId } = await database.enrollment.findUniqueOrThrow({
    where: { id: input.enrollmentId },
    select: { studentId: true },
  });
  await lockStudent(database, studentId);
  return Boolean(
    await database.contract.findFirst({
      where: { studentId, ...contractAt(input.effectiveDate) },
      select: { id: true },
    }),
  );
}

async function lockStudent(database: TransactionClient, studentId: string): Promise<void> {
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"enrollment:" + studentId.toLowerCase()}, 0))`;
}

/** End uncovered memberships in bounded batches, even on days without any scheduled entry or exit. */
export async function suspendUncoveredMemberships(
  database: DatabaseClient,
  today: Date,
): Promise<void> {
  const where = {
    entryDate: { lte: today },
    exitDate: null,
    deletedAt: null,
    student: { contracts: { none: contractAt(today) } },
  };
  for (;;) {
    const rows = await database.enrollment.findMany({
      where,
      select: { id: true, studentId: true },
      orderBy: { id: "asc" },
      take: 100,
    });
    if (rows.length === 0) return;
    await database.$transaction(
      async (tx) => {
        for (const row of rows.toSorted((left, right) =>
          left.studentId.localeCompare(right.studentId),
        )) {
          await lockStudent(tx, row.studentId);
          const enrollment = await tx.enrollment.findFirst({
            where: { ...where, id: row.id },
            select: {
              entryDate: true,
              student: {
                select: {
                  contracts: {
                    where: { deletedAt: null, terminatedAt: null, startsOn: { lte: today } },
                    select: { startsOn: true, endsOn: true },
                  },
                },
              },
            },
          });
          if (!enrollment) continue;
          const end = contractCoverageEnd(
            enrollment.student.contracts.map((contract) => ({
              startsOn: contract.startsOn && dateOnly(contract.startsOn),
              endsOn: contract.endsOn && dateOnly(contract.endsOn),
            })),
            dateOnly(enrollment.entryDate),
          );
          // Legacy memberships without a dated contract retain their recorded history through the review date.
          const exitDate = end ? new Date(end) : new Date(today);
          if (end) exitDate.setUTCDate(exitDate.getUTCDate() + 1);
          const lastProgress = await tx.pedagogicalProgress.findFirst({
            where: { enrollmentId: row.id, deletedAt: null, endDate: null },
            orderBy: { startDate: "desc" },
            select: { startDate: true },
          });
          const effectiveDate =
            lastProgress && lastProgress.startDate > exitDate ? lastProgress.startDate : exitDate;
          await tx.pedagogicalProgress.updateMany({
            where: { enrollmentId: row.id, endDate: null, deletedAt: null },
            data: { endDate: effectiveDate, endReason: "SUSPENDED" },
          });
          await tx.enrollment.update({
            where: { id: row.id },
            data: { exitDate: effectiveDate, exitReason: "SUSPENDED" },
          });
        }
      },
      { timeout: 30_000 },
    );
  }
}
