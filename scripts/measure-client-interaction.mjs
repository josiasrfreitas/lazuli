import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Use Orca's existing authenticated page; no alternate browser or credentials.
const [page, operation = "read", label = "interaction", selector] = process.argv.slice(2);
if (!page)
  throw new Error(
    "Usage: node scripts/measure-client-interaction.mjs PAGE arm|read LABEL READY_SELECTOR",
  );
if (!["arm", "read"].includes(operation)) throw new Error("Operation must be arm or read");
if (operation === "arm" && !selector)
  throw new Error("Provide a selector that proves functional readiness for this interaction");
const expression =
  operation === "arm"
    ? `(${readFileSync(new URL("./lib/client-interaction-observer.js", import.meta.url), "utf8")})(${JSON.stringify({ label, selector })})`
    : "JSON.stringify(globalThis.__lazuliClientProbe?.read() ?? null)";
const executable =
  process.env.ORCA_CLI_COMMAND || (process.env.ORCA_DEV_REPO_ROOT ? "orca-dev" : "orca");
const result = spawnSync(
  executable,
  ["eval", "--page", page, "--expression", expression, "--json"],
  { encoding: "utf8" },
);
if (result.status !== 0) throw new Error(result.stderr || result.stdout);
const response = JSON.parse(result.stdout);
if (!response.ok) throw new Error(JSON.stringify(response.error));
const value = JSON.parse(response.result.result);
if (!value) throw new Error("Arm a probe on this page before reading it");
const tabs = spawnSync(executable, ["tab", "list", "--json"], { encoding: "utf8" });
if (tabs.status === 0) {
  const tabResponse = JSON.parse(tabs.stdout);
  value.activeTab = tabResponse.result?.tabs?.find((tab) => tab.browserPageId === page)?.active;
  if (operation !== "arm") value.validForLatency &&= value.activeTab === true;
}
console.log(JSON.stringify(value));
