import { refreshWorkspaceFixtures } from "./lib/workspace-maintenance.mjs";

const root = process.cwd();
const EXPECTED_ARGUMENT_COUNT = 3;
const output = (message) => process.stdout.write(`${message}\n`);
const errorOutput = (message) => process.stderr.write(`${message}\n`);

function usage() {
  errorOutput("Usage: pnpm workspace:fixtures refresh");
}

try {
  if (process.argv.length !== EXPECTED_ARGUMENT_COUNT || process.argv[2] !== "refresh") {
    usage();
    process.exitCode = 2;
  } else {
    await refreshWorkspaceFixtures({ root, output });
  }
} catch (error) {
  errorOutput(`workspace:fixtures failed: ${error.message}`);
  process.exitCode = 1;
}
