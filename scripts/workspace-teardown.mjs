import { teardownWorkspace } from "./lib/workspace-teardown.mjs";

try {
  await teardownWorkspace(process.cwd(), (message) => process.stdout.write(`${message}\n`));
} catch (error) {
  process.stderr.write(`workspace:teardown failed before cleanup: ${error.message}\n`);
  process.exitCode = 1;
}
