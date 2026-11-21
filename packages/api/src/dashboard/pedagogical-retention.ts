import { Prisma } from "@lazuli/db/prisma";
import { saoPauloDateOnly } from "@lazuli/domain";
import { z } from "@lazuli/validators";
import { adminProcedure } from "../trpc/init.js";

import { groupColumns, teachersAtCut } from "./pedagogical-groups.js";

type RetentionRow = {
  id: string;
  period: string;
  previous: string | null;
  start: string;
  end: string;
  groupId: string;
  label: string;
  base: number;
  transferred: number;
  both: number;
  entrants: number;
  entrantExits: number;
  originOnly: number;
  exited: number;
  pending: number;
  terminated: number;
  due: number;
  renewed: number;
};

export const pedagogicalRetention = adminProcedure
  .input(
    z.object({
      through: z.string().date().optional(),
      group: z.enum(["school", "teacher", "age"]).default("school"),
    }),
  )
  .query(async ({ ctx, input }) => {
    const today = saoPauloDateOnly(ctx.now ?? new Date());
    const cutoff = input.through && input.through < today ? input.through : today;
    const rows = await ctx.db.$queryRaw<RetentionRow[]>`
  WITH periods AS (
    SELECT id,name,start_date,end_date,least(end_date,${today}::date) AS cut_day,lag(name) OVER (ORDER BY start_date,id) AS previous,
     lag(id) OVER (ORDER BY start_date,id) AS previous_id,lag(end_date) OVER (ORDER BY start_date,id) AS previous_end
    FROM "Semester" WHERE deleted_at IS NULL
  ), members AS (
    SELECT p.id,e.student_id,bool_or(c.semester_id=p.previous_id) AS origin,bool_or(c.semester_id=p.id) AS destination
    FROM periods p JOIN "Class" c ON c.semester_id IN (p.id,p.previous_id) AND c.deleted_at IS NULL
    JOIN "Enrollment" e ON e.class_id=c.id AND e.deleted_at IS NULL
    JOIN "Student" st ON st.id=e.student_id AND st.deleted_at IS NULL
    WHERE p.start_date<=${today}::date AND ((c.semester_id=p.id AND e.entry_date<=p.cut_day AND (e.exit_date IS NULL OR e.exit_date>=p.start_date))
      OR (c.semester_id=p.previous_id AND e.entry_date<=p.previous_end AND (e.exit_date IS NULL OR e.exit_date>p.previous_end OR (e.exit_date=p.previous_end AND e.exit_reason IN ('COMPLETED','TRANSFERRED')))))
      AND e.exit_reason IS DISTINCT FROM 'CORRECTION'
    GROUP BY p.id,e.student_id
  ), expiries AS (
    SELECT p.id,k.student_id,bool_or(EXISTS (
      SELECT FROM "Contract" r WHERE r.renewed_from_id=k.id AND r.student_id=k.student_id
        AND r.deleted_at IS NULL AND coalesce(r.agreed_on,(r.created_at AT TIME ZONE 'America/Sao_Paulo')::date)<=${cutoff}::date
    )) AS renewed FROM periods p JOIN "Contract" k ON k.ends_on BETWEEN p.start_date AND least(p.end_date,${cutoff}::date)
    JOIN "Student" st ON st.id=k.student_id AND st.deleted_at IS NULL
    WHERE k.deleted_at IS NULL AND (k.terminated_at IS NULL OR (k.terminated_at AT TIME ZONE 'America/Sao_Paulo')::date>=k.ends_on)
    GROUP BY p.id,k.student_id
  ), population AS (
    SELECT id,student_id FROM members UNION SELECT id,student_id FROM expiries
  ), facts AS (
    SELECT p.id,x.student_id, m.origin,m.destination,
      CASE WHEN m.origin AND NOT m.destination THEN EXISTS (
        SELECT FROM "Contract" live WHERE live.student_id=x.student_id AND live.deleted_at IS NULL
          AND live.starts_on<=p.cut_day AND live.ends_on>=p.cut_day
          AND (live.terminated_at IS NULL OR (live.terminated_at AT TIME ZONE 'America/Sao_Paulo')::date>p.cut_day)
      ) END AS continuing_contract,
      ${groupColumns(input.group)},
      k.renewed,events.transferred,events.dropped AND NOT EXISTS (
        SELECT FROM "Enrollment" active JOIN "Class" ac ON ac.id=active.class_id AND ac.deleted_at IS NULL
        JOIN "Semester" ap ON ap.id=ac.semester_id AND ap.deleted_at IS NULL
        WHERE active.student_id=x.student_id AND active.deleted_at IS NULL
          AND ap.start_date<=p.cut_day AND ap.end_date>=events.last_drop
          AND active.entry_date<=p.cut_day AND active.exit_reason IS DISTINCT FROM 'CORRECTION' AND
          (active.exit_date IS NULL OR active.exit_date>events.last_drop)
      ) AS exited,events.terminated
    FROM population x JOIN periods p ON p.id=x.id JOIN "Student" st ON st.id=x.student_id
    LEFT JOIN members m ON m.id=x.id AND m.student_id=x.student_id
    ${input.group === "teacher" ? teachersAtCut(true) : Prisma.empty}
    LEFT JOIN expiries k ON k.id=x.id AND k.student_id=x.student_id
    LEFT JOIN LATERAL (
      SELECT bool_or(e.exit_reason='TRANSFERRED') AS transferred,bool_or(e.exit_reason='DROPPED') AS dropped,
        max(e.exit_date) FILTER (WHERE e.exit_reason='DROPPED') AS last_drop,
        bool_or(e.exit_reason='DROPPED' AND EXISTS (SELECT FROM "Contract" tc WHERE tc.student_id=e.student_id
          AND tc.deleted_at IS NULL AND tc.termination_snapshot->'enrollmentIds' ? e.id::text)) AS terminated
      FROM "Enrollment" e JOIN "Class" ec ON ec.id=e.class_id AND ec.deleted_at IS NULL
      WHERE e.student_id=x.student_id AND e.deleted_at IS NULL
        AND e.exit_date BETWEEN p.start_date AND p.cut_day
    ) events ON true
  )
  SELECT p.id,p.name AS period,p.previous,p.start_date::text AS start,p.end_date::text AS end,
    coalesce(f.grp,'school') AS "groupId",coalesce(f.label,'Toda a escola') AS label,
    count(*) FILTER(WHERE origin)::int AS base,
    count(*) FILTER(WHERE destination AND NOT origin)::int AS entrants,count(*) FILTER(WHERE destination AND NOT origin AND exited)::int AS "entrantExits",
    count(*) FILTER(WHERE origin AND destination)::int AS both,count(*) FILTER(WHERE origin AND NOT destination)::int AS "originOnly",
    count(*) FILTER(WHERE origin AND transferred)::int AS transferred,
    count(*) FILTER(WHERE origin AND exited)::int AS exited,
    count(*) FILTER(WHERE origin AND NOT destination AND exited IS NOT TRUE AND NOT continuing_contract)::int AS pending,
    count(*) FILTER(WHERE origin AND exited AND terminated)::int AS terminated,
    count(renewed)::int AS due,count(*) FILTER(WHERE renewed)::int AS renewed
  FROM periods p LEFT JOIN facts f ON f.id=p.id
  WHERE p.previous IS NOT NULL AND p.start_date<=${today}::date AND (${input.group}='school' OR f.grp IS NOT NULL)
  GROUP BY p.id,p.name,p.previous,p.start_date,p.end_date,f.grp,f.label ORDER BY p.start_date,p.id,label`;
    return { rows, cutoff, today };
  });

export const pedagogicalPeriods = adminProcedure.query(async ({ ctx }) => {
  const today = saoPauloDateOnly(ctx.now ?? new Date());
  const periods = await ctx.db.$queryRaw<
    { id: string; period: string; previous: string | null; start: string; end: string }[]
  >`
    SELECT * FROM (SELECT id,name AS period,lag(name) OVER(ORDER BY start_date,id) AS previous,
      start_date::text AS start,end_date::text AS end FROM "Semester" WHERE deleted_at IS NULL) periods
    WHERE start<=${today} ORDER BY start DESC,id`;
  return { today, periods };
});
