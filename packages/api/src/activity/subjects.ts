import type { Prisma } from "@lazuli/db";
import type { ActivitySubject } from "./record.js";
type Database = Prisma.TransactionClient;

export async function studentSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.student.findUniqueOrThrow({
    where: { id },
    select: { fullName: true },
  });
  return { type: "student", id, name: row.fullName };
}
export async function classSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.class.findUniqueOrThrow({
    where: { id },
    select: { portalClassName: true },
  });
  return { type: "class", id, name: row.portalClassName };
}
export async function teacherSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.user.findUniqueOrThrow({ where: { id }, select: { name: true } });
  return { type: "teacher", id, name: row.name };
}
export async function leadSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.admissionCandidate.findUniqueOrThrow({
    where: { id },
    select: { fullName: true },
  });
  return { type: "lead", id, name: row.fullName };
}
export async function enrollmentSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.enrollment.findUniqueOrThrow({
    // Cancelling a scheduled entry soft-deletes it before its attributed activity is recorded.
    where: { id, deletedAt: {} },
    select: {
      student: { select: { id: true, fullName: true } },
      class: { select: { portalClassName: true } },
    },
  });
  return {
    type: "student",
    id: row.student.id,
    name: `${row.student.fullName} · ${row.class.portalClassName}`,
  };
}
export async function enrollmentActionSubject(
  database: Database,
  id: string,
): Promise<ActivitySubject> {
  const row = await database.enrollmentAction.findUniqueOrThrow({
    where: { id },
    select: { enrollmentId: true },
  });
  return enrollmentSubject(database, row.enrollmentId);
}
export async function sessionSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.classSession.findUniqueOrThrow({
    where: { id },
    select: { classId: true },
  });
  return classSubject(database, row.classId);
}
export async function makeupSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.makeup.findUniqueOrThrow({
    where: { id },
    select: { originEnrollmentId: true },
  });
  return enrollmentSubject(database, row.originEnrollmentId);
}
export async function visitSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.entryVisit.findUniqueOrThrow({
    where: { id },
    select: { candidateId: true },
  });
  return leadSubject(database, row.candidateId);
}
export async function payerSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.payer.findUniqueOrThrow({ where: { id }, select: { name: true } });
  return { type: "payer", id, name: row.name };
}
export async function orderSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.order.findUniqueOrThrow({
    where: { id },
    select: {
      contract: { select: { student: { select: { fullName: true } } } },
      payer: { select: { name: true } },
    },
  });
  return {
    type: "receivable",
    id,
    name: row.contract?.student.fullName ?? row.payer?.name ?? "Cobrança",
  };
}
export async function installmentSubject(database: Database, id: string): Promise<ActivitySubject> {
  const row = await database.installment.findUniqueOrThrow({
    where: { id },
    select: { orderId: true },
  });
  return orderSubject(database, row.orderId);
}
