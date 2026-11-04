import {
  computeCompensatedAttendance,
  attendanceProgressFromTotals,
  intersectEnrollmentSemesterWindows,
  type AttendanceProgress,
} from "@lazuli/domain";
import { sql } from "kysely";
import type { TransactionClient } from "./client.js";

type EnrollmentWindow = { id: string; classId: string; entryDate: Date; exitDate: Date | null };
type SemesterWindowDates = { startDate: Date; endDate: Date };
type AttendanceDatabase = Pick<TransactionClient, "$kysely">;

/** Confirmed home lessons define the denominator; completed source-linked compensation adds minutes. */
export async function computeEnrollmentPercentInWindow(input: {
  database: AttendanceDatabase;
  values: { enrollment: EnrollmentWindow; semester: SemesterWindowDates };
}): Promise<AttendanceProgress> {
  const results = await computeEnrollmentsPercentInWindow({
    database: input.database,
    values: { enrollments: [input.values.enrollment], semester: input.values.semester },
  });
  return results.get(input.values.enrollment.id)!;
}

/** Aggregate confirmed lessons in PostgreSQL; return one small row per enrollment. */
export async function computeEnrollmentsPercentInWindow(input: {
  database: AttendanceDatabase;
  values: { enrollments: EnrollmentWindow[]; semester: SemesterWindowDates };
}): Promise<Map<string, AttendanceProgress>> {
  const results = new Map(
    input.values.enrollments.map((enrollment) => [enrollment.id, computeCompensatedAttendance([])]),
  );
  const windows = input.values.enrollments.flatMap((enrollment) => {
    const window = intersectEnrollmentSemesterWindows({
      enrollment,
      semester: input.values.semester,
    });
    return window === null
      ? []
      : [
          sql`(${enrollment.id}::uuid, ${enrollment.classId}::uuid,
      ${window.startDate}::date, ${window.endDate}::date, ${enrollment.exitDate}::date)`,
        ];
  });
  if (windows.length === 0) return results;
  const rows = await input.database.$kysely
    .with(
      "windows",
      () => sql<WindowRow>`(select * from (values ${sql.join(windows)})
      as w(id, class_id, start_date, end_date, exit_date))`,
    )
    .with("facts", (database) =>
      database
        .selectFrom("windows as w")
        .innerJoin("ClassSession as s", (join) =>
          join
            .onRef("s.class_id", "=", "w.class_id")
            .onRef("s.date", ">=", "w.start_date")
            .onRef("s.date", "<=", "w.end_date")
            .on((eb) =>
              eb.or([eb("w.exit_date", "is", null), eb("s.date", "<", eb.ref("w.exit_date"))]),
            ),
        )
        .leftJoin("Attendance as a", (join) =>
          join
            .onRef("a.class_session_id", "=", "s.id")
            .onRef("a.enrollment_id", "=", "w.id")
            .on("a.deleted_at", "is", null),
        )
        .where("s.deleted_at", "is", null)
        .where("s.status", "=", "SCHEDULED")
        .where("s.attendance_confirmed_at", "is not", null)
        .select((eb) => [
          "w.id",
          "a.status",
          // Match teachingMinutes(HH:mm): ignore seconds and clamp negative durations.
          sql<number>`greatest(0,
          extract(hour from ${eb.ref("s.end_time")}) * 60 + extract(minute from ${eb.ref("s.end_time")}) -
          extract(hour from ${eb.ref("s.start_time")}) * 60 - extract(minute from ${eb.ref("s.start_time")}))`.as(
            "minutes",
          ),
          eb
            .selectFrom("MakeupCoverage as c")
            .innerJoin("PedagogicalAppointment as p", "p.id", "c.appointment_id")
            .whereRef("c.attendance_id", "=", "a.id")
            .where("c.deleted_at", "is", null)
            .where("p.deleted_at", "is", null)
            .where("p.status", "=", "ATTENDED")
            .select((coverage) =>
              coverage.fn
                .coalesce(coverage.fn.sum<number>("c.minutes"), coverage.val(0))
                .as("total"),
            )
            .as("compensation"),
        ]),
    )
    .selectFrom("facts")
    .select((eb) => [
      "id",
      eb.fn.countAll<number>().as("heldSessions"),
      eb.fn.countAll<number>().filterWhere("status", "=", "PRESENT").as("presentCount"),
      eb.fn.sum<number>("minutes").as("heldMinutes"),
      sql<number>`coalesce(sum(${eb.ref("minutes")}) filter (where ${eb.ref("status")} = 'PRESENT'), 0)`.as(
        "presentMinutes",
      ),
      sql<number>`coalesce(sum(least(${eb.ref("minutes")}, greatest(0, ${eb.ref("compensation")})))
        filter (where ${eb.ref("status")} = 'ABSENT'), 0)`.as("compensatedMinutes"),
    ])
    .groupBy("id")
    .execute();
  for (const row of rows)
    results.set(
      row.id,
      attendanceProgressFromTotals({
        heldSessions: Number(row.heldSessions),
        presentCount: Number(row.presentCount),
        heldMinutes: Number(row.heldMinutes),
        presentMinutes: Number(row.presentMinutes),
        compensatedMinutes: Number(row.compensatedMinutes),
      }),
    );
  return results;
}

type WindowRow = {
  id: string;
  class_id: string;
  start_date: Date;
  end_date: Date;
  exit_date: Date | null;
};
