import { saoPauloDateOnly } from "@lazuli/domain";
import { z } from "@lazuli/validators";
import type { leadSourceLabels } from "@lazuli/validators";
import { adminProcedure } from "../trpc/init.js";

type LeadSource = keyof typeof leadSourceLabels;

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const QUARTERS = 4;
const QUARTER_MONTHS = 3;
const YEAR_MONTHS = 12;
const ISO_DATE_LENGTH = 10;
const yearInput = z.object({ year: z.number().int().min(MIN_YEAR).max(MAX_YEAR) });

export const leadPerformance = adminProcedure
  .input(yearInput.extend({ quarter: z.number().int().min(1).max(QUARTERS).optional() }))
  .query(({ ctx, input }) => {
    const startMonth = input.quarter ? (input.quarter - 1) * QUARTER_MONTHS : 0;
    const endMonth = startMonth + (input.quarter ? QUARTER_MONTHS : YEAR_MONTHS);
    const start = new Date(Date.UTC(input.year, startMonth, 1))
      .toISOString()
      .slice(0, ISO_DATE_LENGTH);
    const end = new Date(Date.UTC(input.year, endMonth, 1)).toISOString().slice(0, ISO_DATE_LENGTH);
    const today = saoPauloDateOnly(ctx.now ?? new Date());
    return ctx.db.$queryRaw<
      {
        source: LeadSource | null;
        ownerId: string | null;
        owner: string | null;
        leads: number;
        enrolled: number;
      }[]
    >`
    SELECT l.source::text AS source, u.id AS "ownerId", u.name AS owner,
           count(*)::int AS leads, count(e.id)::int AS enrolled
    FROM "AdmissionCandidate" l
    LEFT JOIN "User" u ON u.id = l.owner_id
    LEFT JOIN "Enrollment" e ON e.id = l.enrollment_id AND e.deleted_at IS NULL
      AND e.entry_date <= ${today}::date AND e.exit_reason IS DISTINCT FROM 'CORRECTION'
    WHERE l.deleted_at IS NULL AND l.created_at >= (${start}::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND l.created_at < (${end}::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
    GROUP BY l.source, u.id, u.name`;
  });

export const classTickets = adminProcedure
  .input(yearInput.extend({ date: z.string().date().optional() }))
  .query(async ({ ctx, input }) => {
    let date = input.date;
    if (!date) {
      const today = saoPauloDateOnly(ctx.now ?? new Date());
      const first = `${input.year}-01-01`,
        last = `${input.year}-12-31`;
      const anchor = [first, today, last].toSorted()[1]!;
      const [period] = await ctx.db.$queryRaw<{ day: string }[]>`
        SELECT greatest(start_date,least(end_date,${anchor}::date))::text AS day FROM "Semester" p
        WHERE deleted_at IS NULL AND start_date <= ${last}::date AND end_date >= ${first}::date
        AND EXISTS(SELECT FROM "Class" c WHERE c.semester_id=p.id AND c.deleted_at IS NULL)
        ORDER BY abs(greatest(start_date,least(end_date,${anchor}::date))-${anchor}::date),start_date DESC LIMIT 1`;
      date = period?.day ?? anchor;
    }
    const rows = await ctx.db.$queryRaw<
      {
        id: string;
        name: string;
        capacity: number;
        active: number;
        missing: number;
        cents: number;
      }[]
    >`
  WITH active AS (
    SELECT DISTINCT e.class_id, e.student_id FROM "Enrollment" e
    JOIN "Student" s ON s.id=e.student_id AND s.deleted_at IS NULL
    JOIN "Class" c ON c.id=e.class_id AND c.deleted_at IS NULL
    JOIN "Semester" p ON p.id=c.semester_id AND p.deleted_at IS NULL
    WHERE e.deleted_at IS NULL AND e.entry_date <= ${date}::date
      AND (e.exit_date IS NULL OR e.exit_date > ${date}::date)
      AND ${date}::date BETWEEN p.start_date AND p.end_date
      AND NOT EXISTS (SELECT FROM "EnrollmentAction" action WHERE action.enrollment_id=e.id
        AND action.deleted_at IS NULL AND action.status='SCHEDULED' AND action.kind IN ('PAUSE','EXIT')
        AND action.effective_date <= ${date}::date)
  ), amounts AS (
    SELECT student_id, CASE WHEN count(*)=1 THEN max(monthly_amount_cents) END AS amount
    FROM "Contract" WHERE deleted_at IS NULL
      AND ${date}::date BETWEEN starts_on AND ends_on
      AND (terminated_at IS NULL OR (terminated_at AT TIME ZONE 'America/Sao_Paulo')::date > ${date}::date)
    GROUP BY student_id
  ), students AS (
    SELECT active.*, CASE WHEN count(*) OVER (PARTITION BY active.student_id)=1 THEN amounts.amount END AS amount
    FROM active LEFT JOIN amounts USING (student_id)
  )
  SELECT c.id, c.portal_class_name AS name, c.capacity, count(s.student_id)::int AS active,
         (count(s.student_id)-count(s.amount))::int AS missing, coalesce(sum(s.amount),0)::float8 AS cents
  FROM "Class" c JOIN "Semester" p ON p.id=c.semester_id AND p.deleted_at IS NULL
  LEFT JOIN students s ON s.class_id=c.id
  WHERE c.deleted_at IS NULL AND ${date}::date BETWEEN p.start_date AND p.end_date
  GROUP BY c.id ORDER BY c.portal_class_name, c.id`;
    return { date, rows };
  });

export const schoolRetention = adminProcedure
  .input(
    yearInput.extend({
      originClassId: z.string().uuid().optional(),
      through: z.string().date().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const today = saoPauloDateOnly(ctx.now ?? new Date());
    const start = `${input.year}-01-01`;
    const end = `${input.year + 1}-01-01`;
    const cutoff = [input.through ?? today, today, `${input.year}-12-31`].toSorted()[0]!;
    const origins = await ctx.db.$queryRaw<{ id: string; name: string }[]>`
    SELECT DISTINCT c.id,c.portal_class_name AS name FROM "SemesterPlacement" f
    JOIN "Semester" p ON p.id=f.semester_id JOIN "Enrollment" e ON e.id=f.source_enrollment_id
    JOIN "Class" c ON c.id=e.class_id JOIN "Semester" prev ON prev.id=c.semester_id
    WHERE f.deleted_at IS NULL AND c.deleted_at IS NULL AND p.deleted_at IS NULL AND e.deleted_at IS NULL
      AND p.start_date>=${start}::date AND p.start_date<${end}::date AND extract(year FROM prev.start_date)=${input.year - 1}
    ORDER BY name,c.id`;
    const [renewal] = await ctx.db.$queryRaw<
      { eligible: number; renewed: number; declined: number }[]
    >`
    WITH cohort AS (
      SELECT f.student_id, bool_and(f.declined_at IS NOT NULL AND (f.declined_at AT TIME ZONE 'America/Sao_Paulo')::date <= ${cutoff}::date) AS declined
      FROM "SemesterPlacement" f
      JOIN "Semester" p ON p.id=f.semester_id AND p.deleted_at IS NULL
      JOIN "Enrollment" e ON e.id=f.source_enrollment_id AND e.deleted_at IS NULL
      JOIN "Class" c ON c.id=e.class_id AND c.deleted_at IS NULL
      JOIN "Semester" origin ON origin.id=c.semester_id
      WHERE f.deleted_at IS NULL AND p.start_date >= ${start}::date AND p.start_date < ${end}::date
        AND (${input.originClassId ?? null}::uuid IS NULL OR c.id=${input.originClassId ?? null}::uuid)
        AND extract(year FROM origin.start_date)=${input.year - 1}
      GROUP BY f.student_id
    ), outcomes AS (
      SELECT cohort.*, EXISTS (SELECT FROM "Enrollment" e JOIN "Class" c ON c.id=e.class_id
        JOIN "Semester" p ON p.id=c.semester_id WHERE e.student_id=cohort.student_id
        AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.start_date >= ${start}::date AND p.start_date < ${end}::date AND e.entry_date <= ${cutoff}::date
        AND e.exit_reason IS DISTINCT FROM 'CORRECTION') AS renewed FROM cohort
    ) SELECT count(*)::int AS eligible, count(*) FILTER (WHERE renewed)::int AS renewed,
      count(*) FILTER (WHERE declined AND NOT renewed)::int AS declined FROM outcomes`;
    const periods = await ctx.db.$queryRaw<
      { id: string; name: string; base: number; lost: number }[]
    >`
    WITH cohort AS (
      SELECT DISTINCT p.id,p.name,p.start_date,least(p.end_date,${today}::date) AS cutoff,e.student_id
      FROM "Semester" p JOIN "Class" c ON c.semester_id=p.id JOIN "Enrollment" e ON e.class_id=c.id
      WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL AND e.deleted_at IS NULL
        AND p.start_date >= ${start}::date AND p.start_date < ${end}::date AND p.start_date <= ${today}::date
        AND e.entry_date <= p.start_date AND (e.exit_date IS NULL OR e.exit_date > p.start_date)
    ) SELECT id,name,count(*)::int AS base,count(*) FILTER (
      WHERE EXISTS (SELECT FROM "Enrollment" e WHERE e.student_id=cohort.student_id AND e.deleted_at IS NULL
        AND e.exit_reason='DROPPED' AND e.exit_date BETWEEN cohort.start_date AND cutoff)
      AND NOT EXISTS (SELECT FROM "Enrollment" e WHERE e.student_id=cohort.student_id AND e.deleted_at IS NULL
        AND e.entry_date <= cutoff AND (e.exit_date IS NULL OR e.exit_date > cutoff))
    )::int AS lost FROM cohort GROUP BY id,name,start_date ORDER BY start_date`;
    return { renewal: renewal!, periods, origins, cutoff };
  });

export const teachingActivity = adminProcedure.input(yearInput).query(({ ctx, input }) => {
  const today = saoPauloDateOnly(ctx.now ?? new Date());
  return ctx.db.$queryRaw<
    {
      id: string;
      name: string;
      active: number;
      capacity: number;
      pending: number;
      present: number;
      marked: number;
    }[]
  >`
 WITH sessions AS (
   SELECT s.class_id, count(*) FILTER(WHERE s.attendance_confirmed_at IS NULL)::int AS pending
   FROM "ClassSession" s WHERE s.deleted_at IS NULL AND s.status <> 'CANCELLED'
     AND s.date >= make_date(${input.year}::int,1,1) AND s.date < least(${today}::date,make_date(${input.year + 1}::int,1,1))
   GROUP BY s.class_id
 ), marks AS (
   SELECT s.class_id,count(*)::int AS marked,count(*) FILTER(WHERE a.status='PRESENT')::int AS present
   FROM "Attendance" a JOIN "ClassSession" s ON s.id=a.class_session_id
   WHERE a.deleted_at IS NULL AND s.deleted_at IS NULL AND s.status <> 'CANCELLED' AND s.attendance_confirmed_at IS NOT NULL
     AND s.date >= make_date(${input.year}::int,1,1) AND s.date < least(${today}::date,make_date(${input.year + 1}::int,1,1))
   GROUP BY s.class_id
 ) SELECT c.id,c.portal_class_name AS name,c.capacity,count(DISTINCT e.student_id)::int AS active,
   coalesce(s.pending,0) AS pending,coalesce(m.marked,0) AS marked,coalesce(m.present,0) AS present
 FROM "Class" c JOIN "Semester" p ON p.id=c.semester_id AND p.deleted_at IS NULL
 LEFT JOIN sessions s ON c.id=s.class_id LEFT JOIN marks m ON c.id=m.class_id
 LEFT JOIN "Enrollment" e ON e.class_id=c.id AND e.deleted_at IS NULL
   AND e.entry_date <= least(p.end_date,${today}::date)
   AND (e.exit_date IS NULL OR e.exit_date > least(p.end_date,${today}::date))
 WHERE c.deleted_at IS NULL AND c.year=${input.year} AND p.start_date <= ${today}::date
 GROUP BY c.id,s.pending,m.marked,m.present ORDER BY pending DESC,name,c.id`;
});

export const placementDemand = adminProcedure.query(({ ctx }) => {
  const today = saoPauloDateOnly(ctx.now ?? new Date());
  return ctx.db.$queryRaw<
    { stage: string; format: string | null; waiting: number; seats: number }[]
  >`
 WITH demand AS (
   SELECT stage_id,format,count(*)::int AS waiting FROM "AdmissionCandidate"
   WHERE deleted_at IS NULL AND status='WAITING' AND allocation_pending_at IS NOT NULL
   GROUP BY stage_id,format
 ), supply AS (
   SELECT c.shared_stage_id AS stage_id,c.format,greatest(0,c.capacity-count(DISTINCT e.student_id)) AS free
   FROM "Class" c JOIN "Semester" p ON p.id=c.semester_id
   LEFT JOIN "Enrollment" e ON e.class_id=c.id AND e.deleted_at IS NULL AND e.entry_date<=${today}::date
     AND (e.exit_date IS NULL OR e.exit_date>${today}::date)
   WHERE c.deleted_at IS NULL AND c.status='ACTIVE' AND p.deleted_at IS NULL
     AND ${today}::date BETWEEN p.start_date AND p.end_date
   GROUP BY c.id
 ), combined AS (
   SELECT stage_id,format,waiting,0 AS free FROM demand
   UNION ALL SELECT stage_id,format,0 AS waiting,free FROM supply
 ) SELECT coalesce(st.name,'Sem estágio definido') AS stage,x.format::text AS format,
   sum(waiting)::int AS waiting,sum(free)::int AS seats FROM combined x LEFT JOIN "Stage" st ON st.id=x.stage_id
   GROUP BY st.id,st.name,x.format HAVING sum(waiting)>0 OR sum(free)>0 ORDER BY waiting DESC,stage,format`;
});

export const receiptTypes = adminProcedure.input(yearInput).query(({ ctx, input }) => {
  const today = saoPauloDateOnly(ctx.now ?? new Date());
  return ctx.db.$queryRaw<{ month: string; kind: string; cents: number }[]>`
 WITH parts AS (
   SELECT p.date AS day,o.kind,a.amount_cents AS cents FROM "PaymentAllocation" a
   JOIN "PaymentEntry" p ON p.id=a.payment_entry_id JOIN "Installment" i ON i.id=a.installment_id JOIN "Order" o ON o.id=i.order_id
   WHERE p.deleted_at IS NULL AND a.deleted_at IS NULL
   UNION ALL
   SELECT CASE WHEN r.kind='CANCELLATION' THEN p.date ELSE r.occurred_on END AS day,o.kind,-ra.amount_cents
   FROM payment_reversal_allocations ra JOIN payment_reversals r ON r.id=ra.payment_reversal_id
   JOIN "PaymentAllocation" a ON a.id=ra.payment_allocation_id JOIN "PaymentEntry" p ON p.id=r.payment_entry_id
   JOIN "Installment" i ON i.id=a.installment_id JOIN "Order" o ON o.id=i.order_id
   WHERE ra.deleted_at IS NULL AND r.deleted_at IS NULL AND a.deleted_at IS NULL AND p.deleted_at IS NULL
 ) SELECT to_char(day,'YYYY-MM') AS month,kind::text AS kind,sum(cents)::float8 AS cents
 FROM parts WHERE day >= make_date(${input.year}::int,1,1) AND day < make_date(${input.year + 1}::int,1,1)
 AND day<=${today}::date GROUP BY month,kind ORDER BY month,kind`;
});

export const enrollmentProduction = adminProcedure.input(yearInput).query(({ ctx, input }) => {
  const today = saoPauloDateOnly(ctx.now ?? new Date());
  return ctx.db.$queryRaw<
    { month: string; owner: string | null; ownerId: string | null; count: number }[]
  >`
   SELECT to_char(e.entry_date,'YYYY-MM') AS month,u.name AS owner,u.id AS "ownerId",count(*)::int AS count
   FROM "Enrollment" e JOIN "AdmissionCandidate" l ON l.enrollment_id=e.id AND l.deleted_at IS NULL
   LEFT JOIN "User" u ON u.id=l.owner_id
   WHERE e.deleted_at IS NULL AND e.exit_reason IS DISTINCT FROM 'CORRECTION'
   AND e.entry_date >= make_date(${input.year}::int,1,1) AND e.entry_date<make_date(${input.year + 1}::int,1,1)
   AND e.entry_date<=${today}::date GROUP BY month,u.id,u.name ORDER BY month,u.name`;
});
