import path from "node:path";
import { fileURLToPath } from "node:url";

import base from "./base.json" with { type: "json" };
import api from "../../packages/api/.oxlintrc.json" with { type: "json" };
import domain from "../../packages/domain/.oxlintrc.json" with { type: "json" };
import jobContracts from "../../packages/job-contracts/.oxlintrc.json" with { type: "json" };
import ui from "../../packages/ui/.oxlintrc.json" with { type: "json" };
import web from "../../apps/web/.oxlintrc.json" with { type: "json" };
import worker from "../../apps/worker/.oxlintrc.json" with { type: "json" };

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const profiles = { api, base, domain, "job-contracts": jobContracts, ui, web, worker };

/** Reuse production boundary policies in isolated guardrail probes. */
export function createBoundaryConfig(packageType) {
  const [severity, options] = base.rules["import-x-compat/no-restricted-paths"];
  return {
    rules: {
      "import-x/no-restricted-paths": [severity, { ...options, basePath: repositoryRoot }],
      "no-restricted-imports": profiles[packageType].rules["no-restricted-imports"],
    },
  };
}
