import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { readHookInput } from "./hook-input.mjs";

const MAXIMUM_FEEDBACK_ATTEMPTS = 3;
const LINTABLE_EXTENSION_PATTERN = /\.[cm]?[jt]sx?$/u;
const projectDirectory = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const defaultStatePath = path.join(
  tmpdir(),
  `lazuli-${path.basename(projectDirectory)}-lint-attempts.json`,
);
const statePath = process.env.LAZULI_GUARDRAIL_STATE_PATH ?? defaultStatePath;

function findEslintDirectory(filePath) {
  let currentDirectory = path.dirname(filePath);

  while (currentDirectory.startsWith(projectDirectory)) {
    if (existsSync(path.join(currentDirectory, "eslint.config.js"))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return null;
    }
    currentDirectory = parentDirectory;
  }

  return null;
}

function readAttempts() {
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(statePath, "utf8"))));
  } catch {
    return new Map();
  }
}

function writeAttempts(attempts) {
  writeFileSync(statePath, `${JSON.stringify(Object.fromEntries(attempts))}\n`);
}

const input = await readHookInput();
const filePath = input.tool_input?.file_path;
const sessionId = typeof input.session_id === "string" ? input.session_id : "unknown-session";

if (typeof filePath === "string" && LINTABLE_EXTENSION_PATTERN.test(filePath)) {
  const absoluteFilePath = path.resolve(filePath);
  const eslintDirectory = findEslintDirectory(absoluteFilePath);

  if (eslintDirectory !== null) {
    const attempts = readAttempts();
    const relativeFilePath = path.relative(projectDirectory, absoluteFilePath);
    const attemptKey = `${sessionId}:${relativeFilePath}`;
    const attemptCount = Number(attempts.get(attemptKey) ?? 0);

    if (attemptCount >= MAXIMUM_FEEDBACK_ATTEMPTS) {
      process.stderr.write(
        `Lint feedback attempt limit reached for ${relativeFilePath}. Stop editing and report the failure.\n`,
      );
      process.exitCode = 2;
    } else {
      const result = spawnSync("pnpm", ["exec", "eslint", absoluteFilePath], {
        cwd: eslintDirectory,
        encoding: "utf8",
      });

      if (result.status === 0) {
        attempts.delete(attemptKey);
        writeAttempts(attempts);
      } else {
        attempts.set(attemptKey, attemptCount + 1);
        writeAttempts(attempts);
        process.stderr.write(`${result.stdout}${result.stderr}`);
        process.exitCode = 2;
      }
    }
  }
}
