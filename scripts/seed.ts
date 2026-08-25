import { createDbClient } from "../packages/db/src/client.js";
import { seedCourseCatalog } from "../packages/db/src/seed-course-catalog.js";
import { seedDevData } from "../packages/db/src/seed-dev.js";

const database = createDbClient();

try {
  await seedCourseCatalog(database);
  await seedDevData(database);
} finally {
  await database.$disconnect();
}
