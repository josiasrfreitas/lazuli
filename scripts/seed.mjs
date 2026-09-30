import { resetWorkspace } from "./lib/workspace-maintenance.mjs";

try {
  if (process.argv.length !== 2) throw new Error("Usage: pnpm seed");
  await resetWorkspace({
    root: process.cwd(),
    output: (message) => process.stdout.write(`${message}\n`),
  });
} catch (error) {
  process.stderr.write(`seed failed: ${error.message}\n`);
  process.exitCode = 1;
}
