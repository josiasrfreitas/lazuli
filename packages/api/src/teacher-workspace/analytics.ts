import { saoPauloDateOnly } from "@lazuli/domain";
import { teacherPeriod } from "../dashboard/attendance-trend.js";
import { workspaceClasses, currentEnrollment } from "./read.js";
import { teacherProcedure } from "../trpc/init.js";

export const teacherAttendanceAnalytics = teacherProcedure
  .input(teacherPeriod)
  .query(async ({ ctx, input }) => {
    const until = saoPauloDateOnly(ctx.now ?? new Date());
    const groups = await workspaceClasses({
      database: ctx.db,
      staffUser: ctx.staffUser,
      now: ctx.now ?? new Date(),
    });
    const current = groups.filter((group) => group.current).map((group) => group.id);
    const [roster, history] = await Promise.all([
      ctx.db.enrollment.findMany({
        where: {
          ...currentEnrollment(new Date(until)),
          classId: { in: current },
          student: { deletedAt: null },
        },
        select: {
          studentId: true,
          classId: true,
          student: { select: { fullName: true } },
          class: { select: { portalClassName: true } },
        },
      }),
      ctx.db.$queryRaw<
        {
          studentId: string;
          name: string;
          classId: string;
          className: string;
          present: number;
          absent: number;
        }[]
      >`
 SELECT st.id AS "studentId",st.full_name AS name,c.id AS "classId",c.portal_class_name AS "className",
   count(*) FILTER(WHERE a.status='PRESENT')::int AS present,
   count(*) FILTER(WHERE a.status='ABSENT')::int AS absent
 FROM "ClassSession" s LEFT JOIN "ClassSessionRecord" r ON r.class_session_id=s.id AND r.deleted_at IS NULL
 JOIN "Class" c ON c.id=s.class_id JOIN "Attendance" a ON a.class_session_id=s.id
 JOIN "Enrollment" e ON e.id=a.enrollment_id AND e.class_id=c.id JOIN "Student" st ON st.id=e.student_id
 WHERE coalesce(r.teaching_teacher_id,s.usual_teacher_id)=${ctx.staffUser.id}::uuid AND s.deleted_at IS NULL
   AND c.deleted_at IS NULL AND e.deleted_at IS NULL AND a.deleted_at IS NULL AND st.deleted_at IS NULL
   AND s.status <> 'CANCELLED' AND s.attendance_confirmed_at IS NOT NULL
   AND s.date BETWEEN ${until}::date-(${input.days}::int-1) AND ${until}::date
 GROUP BY st.id,c.id ORDER BY absent DESC,st.full_name,c.portal_class_name,st.id,c.id`,
    ]);
    const seen = new Set(history.map((row) => row.studentId + row.classId));
    for (const row of roster) {
      const key = row.studentId + row.classId;
      if (seen.has(key)) continue;
      seen.add(key);
      history.push({
        studentId: row.studentId,
        classId: row.classId,
        name: row.student.fullName,
        className: row.class.portalClassName,
        present: 0,
        absent: 0,
      });
    }
    return history;
  });
