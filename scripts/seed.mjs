import { resetWorkspace } from "./lib/workspace-maintenance.mjs";

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length > 0 && args[0] !== "--sem-proximo-semestre"))
    throw new Error("Usage: pnpm seed [--sem-proximo-semestre]");
  await resetWorkspace({
    root: process.cwd(),
    seedEnvironment: { LAZULI_SEED_SKIP_NEXT_SEMESTER: args.length > 0 ? "1" : "0" },
    output: (message) => process.stdout.write(`${message}\n`),
  });
} catch (error) {
  process.stderr.write(`seed failed: ${error.message}\n`);
  process.exitCode = 1;
}
