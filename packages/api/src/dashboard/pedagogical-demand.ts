import { saoPauloDateOnly } from "@lazuli/domain";
import { z } from "@lazuli/validators";
import { adminProcedure } from "../trpc/init.js";

export const pedagogicalDemand = adminProcedure
  .input(z.object({ periodId: z.string().uuid().optional() }))
  .query(async ({ ctx, input }) => {
    const today = saoPauloDateOnly(ctx.now ?? new Date());
    const rows = await ctx.db.$queryRaw<
      { id: string; label: string; waiting: number; unspecified: number; ppt: number }[]
    >`
    WITH counts AS (
      SELECT a.stage_id,count(DISTINCT coalesce(a.student_id,a.id)) FILTER(WHERE a.schedule_type='REGULAR')::int AS waiting,
        count(DISTINCT coalesce(a.student_id,a.id)) FILTER(WHERE a.schedule_type IS NULL)::int AS unspecified,0 AS ppt
      FROM "AdmissionCandidate" a WHERE a.deleted_at IS NULL AND a.status='WAITING' AND a.allocation_pending_at IS NOT NULL
      GROUP BY a.stage_id
      UNION ALL
      SELECT a.stage_id,0,0,count(DISTINCT e.student_id)::int FROM "AdmissionCandidate" a
      JOIN "Enrollment" e ON e.id=a.enrollment_id AND e.deleted_at IS NULL AND e.exit_reason IS DISTINCT FROM 'CORRECTION'
      JOIN "Class" c ON c.id=e.class_id AND c.deleted_at IS NULL AND c.schedule_type='PERSONALIZED'
      JOIN "Semester" p ON p.id=${input.periodId ?? null}::uuid AND p.deleted_at IS NULL
      WHERE a.deleted_at IS NULL AND e.entry_date BETWEEN p.start_date AND least(p.end_date,${today}::date)
      GROUP BY a.stage_id
    ) SELECT coalesce(s.id::text,'unknown') AS id,coalesce(s.name,'Sem estágio definido') AS label,
      sum(waiting)::int AS waiting,sum(unspecified)::int AS unspecified,sum(ppt)::int AS ppt
      FROM counts LEFT JOIN "Stage" s ON s.id=counts.stage_id GROUP BY s.id,s.name
      HAVING sum(waiting)+sum(unspecified)+sum(ppt)>0 ORDER BY sum(waiting) DESC,label`;
    return { today, rows };
  });
