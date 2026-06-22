import path from "node:path";

import { readHookInput } from "./hook-input.mjs";

const projectDirectory = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const protectedDirectories = ["scripts/guardrails", "tooling/eslint", "tooling/tsconfig"];
const protectedFiles = new Set([".claude/settings.json", "jscpd.json"]);

function isProtectedConfigurationName(fileName) {
  return (
    fileName === "eslint.config.js" ||
    fileName === "eslint.config.cjs" ||
    fileName === "eslint.config.mjs" ||
    (fileName.startsWith("tsconfig") && fileName.endsWith(".json"))
  );
}

function isProtected(filePath) {
  const relativePath = path
    .relative(projectDirectory, path.resolve(filePath))
    .split(path.sep)
    .join("/");
  const isInProtectedDirectory = protectedDirectories.some(
    (directory) => relativePath === directory || relativePath.startsWith(`${directory}/`),
  );

  return (
    isInProtectedDirectory ||
    protectedFiles.has(relativePath) ||
    isProtectedConfigurationName(path.basename(relativePath))
  );
}

const input = await readHookInput();
const filePath = input.tool_input?.file_path;

if (typeof filePath === "string" && isProtected(filePath)) {
  process.stderr.write(
    "Blocked edit to guardrail configuration. Fix the source violation or ask the user to approve a guardrail change.\n",
  );
  process.exitCode = 2;
}
