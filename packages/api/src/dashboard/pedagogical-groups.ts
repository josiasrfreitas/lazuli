import { Prisma } from "@lazuli/db/prisma";

export function groupColumns(group: "school" | "age" | "teacher"): Prisma.Sql {
  if (group === "school") return Prisma.sql`'school'::text AS grp,'Toda a escola'::text AS label`;
  if (group === "teacher")
    return Prisma.sql`coalesce(t.id::text,'unknown') AS grp,coalesce(t.name,'Professor não informado') AS label`;
  const band = Prisma.sql`CASE WHEN st.birth_date IS NULL THEN 'Idade não informada'
    WHEN age(p.start_date,st.birth_date)<interval '12 years' THEN 'Até 11 anos'
    WHEN age(p.start_date,st.birth_date)<interval '18 years' THEN '12 a 17 anos'
    ELSE '18 anos ou mais' END`;
  return Prisma.sql`${band} AS grp,${band} AS label`;
}

// Use concurrent classes at the reference date, or the last classes attended before leaving.
export function teachersAtCut(includeOrigin = false): Prisma.Sql {
  const periods = includeOrigin ? Prisma.sql`(p.id,p.previous_id)` : Prisma.sql`(p.id)`;
  return Prisma.sql`LEFT JOIN LATERAL (
  SELECT DISTINCT u.id,u.name FROM (
    SELECT c.id,c.teacher_id,least(p.cut_day,cp.end_date,coalesce(e.exit_date-1,cp.end_date)) AS day,
      dense_rank() OVER (ORDER BY least(p.cut_day,cp.end_date,coalesce(e.exit_date-1,cp.end_date)) DESC) AS position
    FROM "Enrollment" e JOIN "Class" c ON c.id=e.class_id AND c.deleted_at IS NULL
    JOIN "Semester" cp ON cp.id=c.semester_id AND cp.deleted_at IS NULL
    WHERE e.student_id=st.id AND c.semester_id IN ${periods} AND e.deleted_at IS NULL
      AND e.entry_date<=p.cut_day AND (e.exit_date IS NULL OR e.exit_date>=greatest(cp.start_date,e.entry_date))
      AND e.exit_reason IS DISTINCT FROM 'CORRECTION'
  ) last_class
  LEFT JOIN LATERAL (SELECT a.teacher_id FROM "ClassTeacherAssignment" a WHERE a.class_id=last_class.id
    AND a.deleted_at IS NULL AND a.superseded_at IS NULL AND a.effective_date<=last_class.day
    ORDER BY a.effective_date DESC,a.recorded_at DESC LIMIT 1) assignment ON true
  LEFT JOIN "User" u ON u.id=coalesce(assignment.teacher_id, CASE WHEN NOT EXISTS (
    SELECT FROM "ClassTeacherAssignment" a WHERE a.class_id=last_class.id AND a.deleted_at IS NULL AND a.superseded_at IS NULL
  ) THEN last_class.teacher_id END)
  WHERE last_class.position=1
) t ON true`;
}
