import type { Prisma } from "@lazuli/db";

const identitySelect = {
  id: true,
  name: true,
  teacherProfile: { select: { departureDate: true } },
} satisfies Prisma.UserSelect;
type IdentityDatabase = {
  user: {
    findMany: (args: {
      where: Prisma.UserWhereInput;
      select: typeof identitySelect;
    }) => Promise<TeacherIdentity[]>;
  };
};

/** Batch the same identities used by responsibility, sessions and substitutions. */
export async function loadTeacherIdentities(
  database: IdentityDatabase,
  ids: Iterable<string | null>,
): Promise<Map<string, TeacherIdentity>> {
  const unique = [...new Set([...ids].filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map<string, TeacherIdentity>();
  const rows = await database.user.findMany({
    // Relation reads include historical identities even after soft deletion.
    where: { id: { in: unique }, deletedAt: {} },
    select: identitySelect,
  });
  return new Map(rows.map((row) => [row.id, row]));
}
export type TeacherIdentity = {
  id: string;
  name: string;
  teacherProfile: { departureDate: Date | null } | null;
};
