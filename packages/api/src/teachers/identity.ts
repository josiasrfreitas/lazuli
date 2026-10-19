import type { Prisma } from "@lazuli/db";

export const teacherIdentityWhere = {
  OR: [
    { role: "TEACHER", teacherProfile: null },
    { teacherProfile: { is: { deletedAt: null } } },
  ],
} satisfies Prisma.UserWhereInput;

export function hasTeacherIdentity(user: { role: string; teacherProfile?: { deletedAt?: Date | null } | null }): boolean {
  return (user.role === "TEACHER" || Boolean(user.teacherProfile)) && !user.teacherProfile?.deletedAt;
}
