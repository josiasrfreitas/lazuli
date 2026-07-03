import { createDbClient } from "../packages/db/src/client.js";

const database = createDbClient();

// Future scenario fixtures should follow docs/agents/testing.md.
try {
  await database.$queryRaw`SELECT 1`;
} finally {
  await database.$disconnect();
}
