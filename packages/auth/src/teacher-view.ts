import type { db } from "@lazuli/db";
import { resolveStaffIdentity, staffRoleFromHeaders, type StaffIdentity } from "./staff-access.js";

export const teacherAccessFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  isEnabled: true,
  deletedAt: true,
  employeeProfile: { select: { userId: true } },
  teacherProfile: { select: { departureDate: true, deletedAt: true } },
} as const;

async function teacherViewIdentity(
  database: typeof db,
  actor: StaffIdentity | null,
  teacherId: string,
  now = new Date(),
): Promise<StaffIdentity | null> {
  if (
    !actor ||
    actor.role !== "SUPER_ADMIN" ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(teacherId)
  )
    return null;
  const teacher = resolveStaffIdentity(
    await database.user.findUnique({ where: { id: teacherId }, select: teacherAccessFields }),
    { requestedRole: "TEACHER", now },
  );
  if (teacher?.role !== "TEACHER") return null;
  return {
    ...teacher,
    roles: ["TEACHER"],
    viewer: { id: actor.id, name: actor.name, email: actor.email },
  };
}

/** Resolve the authenticated account first, then narrow reads to the selected teacher. */
export async function requestStaffIdentity(
  database: typeof db,
  email: string,
  headers?: Headers,
  now = new Date(),
): Promise<StaffIdentity | null> {
  const actor = resolveStaffIdentity(
    await database.user.findUnique({ where: { email }, select: teacherAccessFields }),
    { now, requestedRole: staffRoleFromHeaders(headers) },
  );
  const teacherId = headers?.get("x-lazuli-teacher");
  return teacherId == null ? actor : teacherViewIdentity(database, actor, teacherId, now);
}
