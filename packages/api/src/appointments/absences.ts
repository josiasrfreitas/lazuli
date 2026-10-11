import type { Prisma, TransactionClient } from "@lazuli/db";
import { teachingMinutes } from "@lazuli/domain";
import { classRecordSnapshotSchema, type absenceListSchema, type z } from "@lazuli/validators";
import { sql } from "kysely";
import { dateOnly, timeOnly } from "../class-records/data.js";
import { sourceApplicable, sourceInclude } from "./data.js";

const absenceInclude = {
  ...sourceInclude,
  makeupCoverages: {
    where: {
      deletedAt: null,
      appointment: { deletedAt: null, status: { in: ["SCHEDULED", "ATTENDED"] } },
    },
    include: { appointment: { select: { id: true, status: true, date: true } } },
  },
  absenceContacts: {
    where: { deletedAt: null },
    orderBy: [{ contactedAt: "desc" }, { id: "desc" }],
    take: 1,
    include: { actor: { select: { name: true } } },
  },
} satisfies Prisma.AttendanceInclude;
type Absence = Prisma.AttendanceGetPayload<{ include: typeof absenceInclude }>;

function absenceView(row: Absence, excludeAppointmentId?: string) {
  const duration = teachingMinutes({
    startTime: timeOnly(row.classSession.startTime),
    endTime: timeOnly(row.classSession.endTime),
  });
  const coverages = row.makeupCoverages.filter(
    (item) => item.appointmentId !== excludeAppointmentId,
  );
  const compensated = coverages
    .filter((item) => item.appointment.status === "ATTENDED")
    .reduce((sum, item) => sum + item.minutes, 0);
  const reserved = coverages
    .filter((item) => item.appointment.status === "SCHEDULED")
    .reduce((sum, item) => sum + item.minutes, 0);
  const parsed = classRecordSnapshotSchema.safeParse(row.classSession.classRecord?.snapshot);
  const content = parsed.success
    ? (parsed.data.sharedContent ??
      parsed.data.entries.find((item) => item.enrollmentId === row.enrollmentId)?.content ??
      null)
    : null;
  const contact = row.absenceContacts[0];
  return {
    id: row.id,
    studentId: row.enrollment.studentId,
    studentName: row.enrollment.student.fullName,
    enrollmentId: row.enrollmentId,
    classId: row.classSession.classId,
    className: row.enrollment.class.portalClassName,
    date: dateOnly(row.classSession.date),
    startTime: timeOnly(row.classSession.startTime),
    endTime: timeOnly(row.classSession.endTime),
    duration,
    compensated,
    reserved,
    available: Math.max(0, duration - compensated - reserved),
    content,
    lastContact: contact
      ? {
          at: contact.contactedAt,
          author: contact.actor.name,
          outcome: contact.outcome,
          notes: contact.notes,
          nextContactDate: contact.nextContactDate ? dateOnly(contact.nextContactDate) : null,
        }
      : null,
  };
}

/** A student's bounded teaching history; caller owns access to the student/appointment. */
export async function studentAbsences(
  database: Prisma.TransactionClient,
  studentId: string,
  excludeAppointmentId?: string,
) {
  const rows = await database.attendance.findMany({
    where: {
      deletedAt: null,
      status: "ABSENT",
      enrollment: { studentId, deletedAt: null },
      classSession: { deletedAt: null, status: "SCHEDULED", attendanceConfirmedAt: { not: null } },
    },
    include: absenceInclude,
    orderBy: [{ classSession: { date: "desc" } }, { id: "desc" }],
  });
  return rows.filter(sourceApplicable).map((row) => absenceView(row, excludeAppointmentId));
}

/** Derived coverage is filtered before pagination, so a page cannot lose rows after hydration. */
export async function listAbsences(
  database: TransactionClient,
  input: z.infer<typeof absenceListSchema>,
) {
  const available = sql<number>`greatest(0, extract(epoch from (s.end_time - s.start_time)) / 60 - coalesce((
    select sum(c.minutes) from "MakeupCoverage" c join "PedagogicalAppointment" p on p.id = c.appointment_id
    where c.attendance_id = a.id and c.deleted_at is null and p.deleted_at is null and p.status in ('SCHEDULED', 'ATTENDED')
  ), 0))`;
  let query = database.$kysely
    .selectFrom("Attendance as a")
    .innerJoin("ClassSession as s", "s.id", "a.class_session_id")
    .innerJoin("Enrollment as e", "e.id", "a.enrollment_id")
    .innerJoin("Student as student", "student.id", "e.student_id")
    .where("a.deleted_at", "is", null)
    .where("a.status", "=", "ABSENT")
    .where("s.deleted_at", "is", null)
    .where("s.status", "=", "SCHEDULED")
    .where("s.attendance_confirmed_at", "is not", null)
    .where("e.deleted_at", "is", null)
    .where("student.deleted_at", "is", null)
    .whereRef("e.class_id", "=", "s.class_id")
    .whereRef("e.entry_date", "<=", "s.date")
    .where((eb) => eb.or([eb("e.exit_date", "is", null), eb("e.exit_date", ">", eb.ref("s.date"))]))
    .where("s.date", ">=", new Date(input.from))
    .where("s.date", "<=", new Date(input.through));
  if (input.search)
    query = query.where(
      "student.full_name",
      "ilike",
      `%${input.search.replace(/[\\%_]/g, "\\$&")}%`,
    );
  if (input.onlyOpen) query = query.where(available, ">", 0);
  const count = await query
    .select((eb) => eb.fn.countAll<string>().as("total"))
    .executeTakeFirstOrThrow();
  const total = Number(count.total);
  const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, pageCount);
  const ids = await query
    .select("a.id")
    .orderBy("s.date", "desc")
    .orderBy("student.full_name", "asc")
    .orderBy("a.id", "asc")
    .offset((page - 1) * input.pageSize)
    .limit(input.pageSize)
    .execute();
  const rows = await database.attendance.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    include: absenceInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, absenceView(row)]));
  return {
    rows: ids.map((row) => byId.get(row.id)!),
    total,
    page,
    pageCount,
    pageSize: input.pageSize,
  };
}
