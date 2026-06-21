import { createDbClient } from "../packages/db/src/client.js";

const database = createDbClient();

try {
  await database.$queryRaw`SELECT 1`;
} finally {
  await database.$disconnect();
}
