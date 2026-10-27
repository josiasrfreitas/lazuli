import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";

import { applySuppressions, readSuppressions } from "./suppressions.js";
import { getOxlintEnvironment } from "./config.js";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("oxlint/package.json")), "bin/oxlint");
const binDirectory = fileURLToPath(new URL("node_modules/.bin", import.meta.url));
const maximumOutputBytes = 67_108_864;

export function originalRuleId(code) {
  const match = /^(.+)\((.+)\)$/u.exec(code ?? "");
  if (!match) return code ?? null;
  const [, plugin, rule] = match;
  const aliases = {
    typescript: "@typescript-eslint",
    "unicorn-compat": "unicorn",
    "import-x-compat": "import-x",
    import: "import-x",
  };
  return plugin === "eslint" || plugin === "eslint-compat"
    ? rule
    : `${aliases[plugin] ?? plugin}/${rule}`;
}

async function invoke(args, cwd) {
  try {
    return await execute(process.execPath, [binary, ...args], {
      cwd,
      env: getOxlintEnvironment(binDirectory),
      maxBuffer: maximumOutputBytes,
    });
  } catch (error) {
    if (error.code === 1 && error.stdout) return error;
    throw error;
  }
}

function lintMessage(diagnostic) {
  const span = diagnostic.labels?.[0]?.span;
  return {
    ruleId: originalRuleId(diagnostic.code),
    severity: diagnostic.severity === "warning" ? 1 : 2,
    message: [diagnostic.message, diagnostic.help].filter(Boolean).join(" "),
    line: span?.line ?? 1,
    column: span?.column ?? 1,
  };
}

function lintResults(diagnostics, cwd) {
  const results = new Map();
  for (const diagnostic of diagnostics) {
    const filePath = path.resolve(cwd, diagnostic.filename ?? ".oxlintrc.json");
    if (!results.has(filePath))
      results.set(filePath, { filePath, messages: [], suppressedMessages: [] });
    results.get(filePath).messages.push(lintMessage(diagnostic));
  }
  return results;
}

async function readReport(command, cwd) {
  const { stdout, stderr } = await invoke([...command, "--format=json"], cwd);
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error(`Oxlint failed:\n${stdout}${stderr}`);
  }
  if (!Array.isArray(report.diagnostics)) throw new Error("Oxlint returned no diagnostics report.");
  return lintResults(report.diagnostics, cwd);
}

async function applyFileAllowances(results, { command, cwd }) {
  const suppressions = await readSuppressions(cwd);
  if (Object.keys(suppressions).length === 0) return [...results.values()];
  // Include checked files without diagnostics to detect stale allowances.
  const selected = await invoke([...command, "--debug=files"], cwd);
  for (const file of selected.stdout.trim().split("\n").filter(Boolean)) {
    const filePath = path.resolve(cwd, file);
    if (!results.has(filePath))
      results.set(filePath, { filePath, messages: [], suppressedMessages: [] });
  }
  return applySuppressions([...results.values()], { suppressions, cwd });
}

export async function lintFiles({
  cwd = process.cwd(),
  files = ["."],
  config,
  suppress = true,
  args = [],
}) {
  // Overrides are relative to the config's directory, just like the workspace config.
  const configPath = config ? path.join(cwd, `.oxlint-probe-${randomUUID()}.json`) : null;
  try {
    const configArgs = [];
    if (configPath) {
      await writeFile(configPath, JSON.stringify(config), { flag: "wx" });
      configArgs.push("--config", configPath);
    }
    const command = [...configArgs, ...args, ...files];
    const results = await readReport(command, cwd);
    return suppress ? await applyFileAllowances(results, { command, cwd }) : [...results.values()];
  } finally {
    if (configPath) await rm(configPath, { force: true });
  }
}

/** Oxlint needs a real file; isolated copies also preserve staged test content. */
export async function lintText({ source, filePath, config, cwd = process.cwd() }) {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-oxlint-text-"));
  try {
    const temporaryFile = path.join(directory, path.basename(filePath));
    await writeFile(temporaryFile, source);
    const results = await lintFiles({
      cwd,
      files: [temporaryFile],
      config,
      suppress: false,
      args: ["--no-ignore"],
    });
    return results.map((result) => ({ ...result, filePath: path.resolve(cwd, filePath) }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function formatResults(results) {
  return results
    .flatMap((result) =>
      result.messages.map(
        (message) =>
          `${result.filePath}:${message.line}:${message.column} ${message.severity === 2 ? "error" : "warning"} ${message.message} [${message.ruleId ?? "parse-error"}]\n`,
      ),
    )
    .join("");
}
