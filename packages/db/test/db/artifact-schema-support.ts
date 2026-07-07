import type { createDbClient } from "../../src/client.js";

export const TEST_PREFIX = "GRE-66 Artifact ";
export const ADMIN_USER_ID = "00000000-0000-0000-0000-0000000000ad";

export type DatabaseClient = ReturnType<typeof createDbClient>;

export async function cleanArtifactSchemaTestData(database: DatabaseClient): Promise<void> {
  await database.generatedArtifact.deleteMany({
    where: { fileName: { startsWith: TEST_PREFIX } },
  });
  await database.user.deleteMany({
    where: { id: ADMIN_USER_ID },
  });
}

export async function ensureAdminUser(database: DatabaseClient): Promise<void> {
  await database.user.upsert({
    where: { id: ADMIN_USER_ID },
    create: {
      id: ADMIN_USER_ID,
      email: "gre66-artifact-admin@example.com",
      name: "GRE-66 Artifact Admin",
      role: "ADMIN",
      isEnabled: true,
    },
    update: {},
  });
}
