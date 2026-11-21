import { Prisma } from "@lazuli/db";

/** A lesson record identifies who taught. Attendance-only confirmation freezes the usual teacher. */
export const confirmedTeacherId = Prisma.sql`coalesce(r.teaching_teacher_id, s.usual_teacher_id)`;
