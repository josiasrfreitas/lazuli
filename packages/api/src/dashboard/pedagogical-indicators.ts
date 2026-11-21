import {
  type StudentHealthIndicator,
  calculateStudentHealth,
  saoPauloDateOnly,
} from "@lazuli/domain";
import { z } from "@lazuli/validators";
import { adminProcedure } from "../trpc/init.js";
import { groupColumns, teachersAtCut } from "./pedagogical-groups.js";
import { Prisma } from "@lazuli/db/prisma";

type Pupil = {
  grp: string;
  label: string;
  present: number;
  marked: number;
  minutes: number;
  attended: number;
  grades: number[];
  occurrences: number;
  accompanied: number;
};
const SCALE = 100;
const mean = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((total, score) => total + score, 0) / values.length : null;
type Statistic = { value: number | null; covered: number };
type GroupSummary = {
  id: string;
  label: string;
  base: number;
  score: Statistic;
  attendance: Statistic;
  grades: Statistic;
  occurrences: Statistic;
  components: { key: StudentHealthIndicator; weight: number; value: number | null }[];
};
function summarize(id: string, students: Pupil[]): GroupSummary {
  const health = students.map((student) =>
    calculateStudentHealth({
      attendancePercent: student.minutes ? student.attended / student.minutes : null,
      grades: student.grades,
      heldSessions: student.marked,
      occurrenceCount: student.occurrences,
      accompaniedOccurrences: student.accompanied,
    }),
  );
  const scores = health.flatMap((result) => result.score ?? []);
  const grades = students.flatMap((student) => mean(student.grades) ?? []);
  const marked = students.reduce((sum, student) => sum + student.marked, 0);
  const present = students.reduce((sum, student) => sum + student.present, 0);
  const observed = students.filter((student) => student.marked || student.occurrences);
  return {
    id,
    label: students[0]!.label,
    base: students.length,
    score: { value: mean(scores), covered: scores.length },
    attendance: {
      value: marked ? (SCALE * present) / marked : null,
      covered: students.filter((student) => student.marked).length,
    },
    grades: { value: mean(grades), covered: grades.length },
    occurrences: {
      value:
        observed.length > 0
          ? observed.reduce((sum, student) => sum + student.occurrences, 0)
          : null,
      covered: observed.length,
    },
    components: health[0]!.indicators.map(({ key, weight }, index) => ({
      key,
      weight,
      value: mean(health.flatMap((result) => result.indicators[index]!.score ?? [])),
    })),
  };
}

export const pedagogicalIndicators = adminProcedure
  .input(
    z.object({
      periodId: z.string().uuid(),
      group: z.enum(["age", "teacher"]),
    }),
  )
  .query(async ({ ctx, input }) => {
    const today = saoPauloDateOnly(ctx.now ?? new Date());
    const common = Prisma.sql`WITH p AS (
    SELECT id,start_date,least(end_date,${today}::date) AS cut_day FROM "Semester" WHERE id=${input.periodId}::uuid AND deleted_at IS NULL
  ), roster AS (
    SELECT DISTINCT e.student_id FROM p JOIN "Class" c ON c.semester_id=p.id AND c.deleted_at IS NULL
    JOIN "Enrollment" e ON e.class_id=c.id AND e.deleted_at IS NULL
    WHERE e.entry_date<=p.cut_day AND (e.exit_date IS NULL OR e.exit_date>greatest(p.start_date,e.entry_date))
      AND e.exit_reason IS DISTINCT FROM 'CORRECTION'
  ), groups AS (
    SELECT DISTINCT st.id,${groupColumns(input.group)} FROM roster JOIN "Student" st ON st.id=roster.student_id AND st.deleted_at IS NULL
    CROSS JOIN p ${input.group === "teacher" ? teachersAtCut() : Prisma.empty}
  ), marks AS (
    SELECT e.student_id,a.id,a.status,s.date,greatest(0,extract(epoch FROM s.end_time-s.start_time)/60) AS minutes
    FROM p JOIN "Class" c ON c.semester_id=p.id AND c.deleted_at IS NULL
    JOIN "ClassSession" s ON s.class_id=c.id AND s.deleted_at IS NULL AND s.status<>'CANCELLED'
    JOIN "Attendance" a ON a.class_session_id=s.id AND a.deleted_at IS NULL
    JOIN "Enrollment" e ON e.id=a.enrollment_id AND e.class_id=c.id AND e.deleted_at IS NULL
    WHERE s.attendance_confirmed_at IS NOT NULL AND s.date BETWEEN greatest(p.start_date,e.entry_date) AND p.cut_day
      AND (e.exit_date IS NULL OR e.exit_date>s.date) AND e.exit_reason IS DISTINCT FROM 'CORRECTION'
  )`;
    const rows = await ctx.db.$queryRaw<Pupil[]>`${common}, attendance AS (
    SELECT student_id,count(*)::int AS marked,count(*) FILTER(WHERE status='PRESENT')::int AS present,
      sum(minutes)::float8 AS minutes,sum(CASE WHEN status='PRESENT' THEN minutes ELSE least(minutes,coalesce((
        SELECT sum(mc.minutes) FROM "MakeupCoverage" mc JOIN "PedagogicalAppointment" ap ON ap.id=mc.appointment_id
        WHERE mc.attendance_id=marks.id AND mc.deleted_at IS NULL AND ap.deleted_at IS NULL AND ap.status='ATTENDED'
          AND ap.date<=(SELECT cut_day FROM p)
      ),0)) END)::float8 AS attended FROM marks GROUP BY student_id
  ), grades AS (
    SELECT sa.student_id,array_agg(g.score::float8) AS scores FROM p
    JOIN "AssessmentGrade" g ON g.assessed_on BETWEEN p.start_date AND p.cut_day AND g.deleted_at IS NULL
    JOIN "StageAssessment" sa ON sa.id=g.assessment_id AND sa.deleted_at IS NULL GROUP BY sa.student_id
  ), occurrences AS (
    SELECT o.student_id,count(*)::int AS total,count(*) FILTER(WHERE EXISTS (
      SELECT FROM "InterventionOccurrence" link JOIN "PedagogicalIntervention" i ON i.id=link.intervention_id
      WHERE link.occurrence_id=o.id AND link.deleted_at IS NULL AND i.deleted_at IS NULL AND i.student_id=o.student_id
        AND i.performed_on<=p.cut_day
    ))::int AS accompanied FROM p CROSS JOIN "PedagogicalOccurrence" o
    LEFT JOIN "ClassSession" s ON s.id=o.class_session_id AND s.deleted_at IS NULL
    WHERE o.deleted_at IS NULL AND coalesce(o.occurred_on,s.date) BETWEEN p.start_date AND p.cut_day GROUP BY o.student_id
  ) SELECT g.grp,g.label,coalesce(a.marked,0) AS marked,coalesce(a.present,0) AS present,
    coalesce(a.minutes,0) AS minutes,coalesce(a.attended,0) AS attended,coalesce(gr.scores,'{}') AS grades,
    coalesce(o.total,0) AS occurrences,coalesce(o.accompanied,0) AS accompanied FROM groups g
    LEFT JOIN attendance a ON a.student_id=g.id LEFT JOIN grades gr ON gr.student_id=g.id LEFT JOIN occurrences o ON o.student_id=g.id
    ORDER BY g.label,g.id`;
    const weekly = await ctx.db.$queryRaw<
      { week: string; groupId: string; marked: number; present: number }[]
    >`${common}
    SELECT date_trunc('week',m.date)::date::text AS week,g.grp AS "groupId",count(*)::int AS marked,
    count(*) FILTER(WHERE m.status='PRESENT')::int AS present FROM marks m JOIN groups g ON g.id=m.student_id GROUP BY week,g.grp ORDER BY week`;
    const grouped = new Map<string, Pupil[]>();
    for (const row of rows) {
      const students = grouped.get(row.grp);
      if (students) students.push(row);
      else grouped.set(row.grp, [row]);
    }
    return {
      groups: [...grouped].map(([id, students]) => summarize(id, students)),
      weekly,
    };
  });
