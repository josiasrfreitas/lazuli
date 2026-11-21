import { saoPauloDateOnly } from "@lazuli/domain";
import { z } from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { adminProcedure, teacherProcedure } from "../trpc/init.js";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MONTH_DAYS = 30;
const QUARTER_DAYS = 90;
const HALF_YEAR_DAYS = 180;
const ISO_DATE_LENGTH = 10;

type AttendanceWeek = {
  week: string;
  classId: string;
  className: string;
  present: number;
  marked: number;
};
type AttendanceScope = { start: string; end: string; teacherId: string | null };

function weeklyAttendance(
  db: Context["db"],
  { start, end, teacherId }: AttendanceScope,
): Promise<AttendanceWeek[]> {
  return db.$queryRaw<AttendanceWeek[]>`
   SELECT date_trunc('week',s.date)::date::text AS week,c.id AS "classId",c.portal_class_name AS "className",
     count(*) FILTER(WHERE a.status='PRESENT')::int AS present,count(*)::int AS marked
   FROM "ClassSession" s JOIN "Class" c ON c.id=s.class_id JOIN "Attendance" a ON a.class_session_id=s.id
   JOIN "Enrollment" e ON e.id=a.enrollment_id AND e.class_id=c.id JOIN "Student" st ON st.id=e.student_id
   LEFT JOIN "ClassSessionRecord" r ON r.class_session_id=s.id AND r.deleted_at IS NULL
   WHERE c.deleted_at IS NULL AND s.deleted_at IS NULL AND a.deleted_at IS NULL
     AND e.deleted_at IS NULL AND st.deleted_at IS NULL AND s.status <> 'CANCELLED'
     AND s.attendance_confirmed_at IS NOT NULL AND s.date BETWEEN ${start}::date AND ${end}::date
     AND (${teacherId}::uuid IS NULL OR r.teaching_teacher_id=${teacherId}::uuid)
   GROUP BY week,c.id ORDER BY week,c.portal_class_name`;
}
export const schoolAttendanceTrend = adminProcedure
  .input(z.object({ year: z.number().int().min(MIN_YEAR).max(MAX_YEAR) }))
  .query(({ ctx, input }) => {
    const today = saoPauloDateOnly(ctx.now ?? new Date());
    return weeklyAttendance(ctx.db, {
      start: `${input.year}-01-01`,
      end: [`${input.year}-12-31`, today].toSorted()[0]!,
      teacherId: null,
    });
  });
export const teacherPeriod = z
  .object({
    days: z.union([z.literal(MONTH_DAYS), z.literal(QUARTER_DAYS), z.literal(HALF_YEAR_DAYS)]),
  })
  .strict();
export const teacherAttendanceTrend = teacherProcedure
  .input(teacherPeriod)
  .query(({ ctx, input }) => {
    const end = saoPauloDateOnly(ctx.now ?? new Date());
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - input.days + 1);
    return weeklyAttendance(ctx.db, {
      start: start.toISOString().slice(0, ISO_DATE_LENGTH),
      end,
      teacherId: ctx.staffUser.id,
    });
  });
