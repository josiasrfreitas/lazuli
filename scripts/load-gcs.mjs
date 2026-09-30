// Internal bridge for legacy bootstrap; full workspaces use ensureBucket.
import { ensureLocalBucket } from "./lib/workspace-gcs.mjs";
import { runWorkspaceCommand } from "./lib/workspace-full.mjs";

const bucket = process.argv[2];
if (!/^lazuli-[a-z0-9-]+$/u.test(bucket ?? "")) throw new Error("Invalid local fixture bucket");
await ensureLocalBucket({
  root: process.cwd(),
  workspace: { resources: { bucket } },
  output: (message) => process.stdout.write(`${message}\n`),
  run: runWorkspaceCommand,
});
