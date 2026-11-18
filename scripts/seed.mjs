import { resetWorkspace } from "./lib/workspace-maintenance.mjs";

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--sem-proximo-semestre"))
    throw new Error("Usage: pnpm seed [--sem-proximo-semestre]");
  process.env.LAZULI_SEED_SKIP_NEXT_SEMESTER = args.length ? "1" : "0";
  await resetWorkspace({
    root: process.cwd(),
    output: (message) => process.stdout.write(`${message}\n`),
  });
} catch (error) {
  process.stderr.write(`seed failed: ${error.message}\n`);
  process.exitCode = 1;
}
