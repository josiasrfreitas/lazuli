import { createDbClient } from "../packages/db/src/client.js";
import { getWorkspaceInitializationKey } from "../packages/db/src/config.js";
import { saoPauloTodayIso } from "../packages/db/src/seed-dev-support.js";
import { seedSchool } from "./seed/school.js";

const database = createDbClient();
const workspaceInitializationKey = getWorkspaceInitializationKey();

const todayIso = saoPauloTodayIso();

try {
  await seedSchool(database, todayIso);
  if (workspaceInitializationKey !== undefined) {
    await database.$executeRawUnsafe(
      'INSERT INTO "lazuli_local"."workspace_initializations" (key, completed_at) VALUES ($1, NOW()) ON CONFLICT (key) DO UPDATE SET completed_at = EXCLUDED.completed_at',
      workspaceInitializationKey,
    );
  }
} finally {
  await database.$disconnect();
}
