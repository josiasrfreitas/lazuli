import { readFile } from "node:fs/promises";
import { createDbClient } from "../../packages/db/src/client.js";
import { importTeachingProgram } from "../../packages/api/src/teaching-programs/import.js";

import { teachingProgramImportSchema } from "../../packages/validators/src/teaching-program.js";

const path = process.argv[2];
if (!path) throw new Error("Informe o arquivo JSON da programação estruturada.");
const database = createDbClient();
try {
  const result = await importTeachingProgram(
    database,
    teachingProgramImportSchema.parse(JSON.parse(await readFile(path, "utf8"))),
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await database.$disconnect();
}
