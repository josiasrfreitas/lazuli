import type { Prisma } from "@lazuli/db";

export const teacherIdentityWhere = {
  OR: [
    { role: "TEACHER", employeeProfile: null, teacherProfile: null },
    { teacherProfile: { is: { deletedAt: null } } },
  ],
} satisfies Prisma.UserWhereInput;

export function hasTeacherIdentity(user: {
  role: string;
  employeeProfile?: object | null;
  teacherProfile?: { deletedAt?: Date | null } | null;
}): boolean {
  return (
    ((user.role === "TEACHER" && !user.employeeProfile) || Boolean(user.teacherProfile)) &&
    !user.teacherProfile?.deletedAt
  );
}
