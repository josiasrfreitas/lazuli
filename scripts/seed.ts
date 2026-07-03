import { createDbClient } from "../packages/db/src/client.js";
import { seedCourseCatalog } from "../packages/db/src/seed-course-catalog.js";

const database = createDbClient();

try {
  await seedCourseCatalog(database);
} finally {
  await database.$disconnect();
}
