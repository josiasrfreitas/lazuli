import { createDbClient } from "../packages/db/src/client.js";
import { getWorkspaceInitializationKey } from "../packages/db/src/config.js";
import { seedCourseCatalog } from "../packages/db/src/seed-course-catalog.js";
import { seedDevData } from "../packages/db/src/seed-dev.js";

const database = createDbClient();
const workspaceInitializationKey = getWorkspaceInitializationKey();

try {
  await seedCourseCatalog(database);
  await seedDevData(
    database,
    workspaceInitializationKey === undefined ? {} : { workspaceInitializationKey },
  );
} finally {
  await database.$disconnect();
}
