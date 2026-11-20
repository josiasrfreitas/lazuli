import { Prisma } from "@lazuli/db/prisma";

export function upcomingMaterial(studentId: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
        SELECT successor.name FROM "Enrollment" e JOIN "Class" cl ON cl.id=e.class_id
        JOIN "Semester" sem ON sem.id=cl.semester_id
        JOIN "PedagogicalProgress" pg ON pg.enrollment_id=e.id AND pg.deleted_at IS NULL AND pg.start_date <= params.today AND (pg.end_date IS NULL OR pg.end_date > params.today)
        JOIN "Stage" current_stage ON current_stage.id=pg.stage_id
        LEFT JOIN "StagePlan" plan ON plan.id=pg.stage_plan_id AND plan.stage_id=pg.stage_id AND plan.student_id=e.student_id AND plan.deleted_at IS NULL
        CROSS JOIN LATERAL (
          SELECT st.id, st.name FROM "Stage" st WHERE st.deleted_at IS NULL AND st.id=COALESCE(
            (SELECT sp.stage_id FROM "SemesterPlacement" sp JOIN "Semester" dest ON dest.id=sp.semester_id WHERE cl.schedule_type='REGULAR' AND sp.source_enrollment_id=e.id AND sp.deleted_at IS NULL AND sp.declined_at IS NULL AND dest.deleted_at IS NULL AND COALESCE(sp.effective_date,dest.start_date)>params.today ORDER BY dest.start_date,sp.id LIMIT 1),
            (SELECT st2.id FROM "Stage" st2 WHERE st2.track_id=current_stage.track_id AND st2.sequence>current_stage.sequence AND st2.deleted_at IS NULL ORDER BY st2.sequence LIMIT 1))
        ) successor
        WHERE e.student_id=${studentId} AND e.deleted_at IS NULL AND cl.deleted_at IS NULL AND sem.deleted_at IS NULL
          AND e.entry_date <= params.today AND (e.exit_date IS NULL OR e.exit_date > params.today)
          AND (CASE WHEN cl.schedule_type='REGULAR' THEN sem.end_date ELSE plan.planned_end_on END) <= params.today + 60
          AND successor.id <> pg.stage_id
          AND NOT EXISTS (SELECT 1 FROM "Contract" c JOIN "Order" o ON o.contract_id=c.id JOIN "MaterialOrder" m ON m.order_id=o.id WHERE c.student_id=e.student_id AND c.deleted_at IS NULL AND o.deleted_at IS NULL AND o.cancelled_at IS NULL AND (m.stage_id=successor.id OR EXISTS (SELECT 1 FROM "MaterialOrderItem" i WHERE i.order_id=o.id AND i.stage_id=successor.id)))
        ORDER BY CASE WHEN cl.schedule_type='REGULAR' THEN sem.end_date ELSE plan.planned_end_on END, e.id LIMIT 1
  `;
}
