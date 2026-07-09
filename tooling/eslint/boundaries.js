import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageImports = {
  api: ["@lazuli/api", "@lazuli/api/*"],
  database: ["@lazuli/db", "@lazuli/db/*"],
  integrations: ["@lazuli/integrations", "@lazuli/integrations/*"],
  jobContracts: ["@lazuli/job-contracts", "@lazuli/job-contracts/*"],
  prisma: ["@prisma/client", "@prisma/client/*", "prisma", "prisma/*"],
  ui: ["@lazuli/ui", "@lazuli/ui/*"],
  workerHandlers: ["@lazuli/worker-handlers", "@lazuli/worker-handlers/*"],
};

const restrictedImportProfiles = new Map([
  [
    "api",
    [
      {
        group: packageImports.workerHandlers,
        message: "API code must enqueue work through @lazuli/job-contracts.",
      },
    ],
  ],
  ["base", []],
  [
    "domain",
    [
      {
        group: [...packageImports.api, ...packageImports.database, ...packageImports.ui],
        message: "Domain code must remain pure and independent of API, database, and UI packages.",
      },
    ],
  ],
  [
    "job-contracts",
    [
      {
        group: packageImports.workerHandlers,
        message: "Job contracts define payloads and enqueue helpers; they never import handlers.",
      },
    ],
  ],
  [
    "ui",
    [
      {
        group: [
          ...packageImports.api,
          ...packageImports.database,
          ...packageImports.integrations,
          ...packageImports.jobContracts,
          ...packageImports.workerHandlers,
        ],
        message: "Shared UI components cannot depend on services, persistence, or workers.",
      },
    ],
  ],
  [
    "web",
    [
      {
        group: [...packageImports.prisma, ...packageImports.database],
        message: "Web code accesses persistence through the @lazuli/api BFF.",
      },
      {
        group: packageImports.workerHandlers,
        message: "Web code enqueues work through @lazuli/job-contracts; handlers stay worker-only.",
      },
    ],
  ],
  [
    "worker",
    [
      {
        group: packageImports.ui,
        message: "Workers cannot import UI code.",
      },
    ],
  ],
]);

const packageDirectories = {
  api: "./packages/api",
  database: "./packages/db",
  domain: "./packages/domain",
  integrations: "./packages/integrations",
  jobContracts: "./packages/job-contracts",
  ui: "./packages/ui",
  web: "./apps/web",
  worker: "./apps/worker",
  workerHandlers: "./packages/worker-handlers",
};

const packageBoundaryPathZones = [
  [packageDirectories.web, packageDirectories.database],
  [packageDirectories.web, packageDirectories.workerHandlers],
  [packageDirectories.api, packageDirectories.workerHandlers],
  [packageDirectories.jobContracts, packageDirectories.workerHandlers],
  [packageDirectories.domain, packageDirectories.api],
  [packageDirectories.domain, packageDirectories.database],
  [packageDirectories.domain, packageDirectories.ui],
  [packageDirectories.ui, packageDirectories.api],
  [packageDirectories.ui, packageDirectories.database],
  [packageDirectories.ui, packageDirectories.integrations],
  [packageDirectories.ui, packageDirectories.jobContracts],
  [packageDirectories.ui, packageDirectories.workerHandlers],
  [packageDirectories.worker, packageDirectories.ui],
  [packageDirectories.workerHandlers, packageDirectories.ui],
].map(([target, from]) => ({
  from,
  message:
    "Import crosses a Lazuli package boundary. Use the package graph documented in AGENTS.md.",
  target,
}));

const receivablesInternalPrivacyZone = {
  from: "./packages/api/src/receivables/internal",
  message:
    "Receivables internals are private. Call packages/api/src/receivables/index.ts instead.",
  target: [
    "./apps/**",
    "./packages/api/src/*.ts",
    "./packages/api/src/{attendance,calendar,classes,enrollment,reports,students,trpc}/**",
    "./packages/api/test/**",
    "./packages/{auth,db,domain,integrations,job-contracts,ui,worker-handlers}/**",
  ],
};

const restrictedPathZones = [...packageBoundaryPathZones, receivablesInternalPrivacyZone];

/** Returns lint rules that enforce package imports and physical paths. */
export function createBoundaryConfig(packageType) {
  return {
    rules: {
      "import/no-restricted-paths": [
        "error",
        { basePath: repositoryRoot, zones: restrictedPathZones },
      ],
      "no-restricted-imports": ["error", { patterns: restrictedImportProfiles.get(packageType) }],
    },
  };
}
