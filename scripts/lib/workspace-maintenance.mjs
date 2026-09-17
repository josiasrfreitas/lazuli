import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DATABASE_INITIALIZATION_PATH,
  bucketExists,
  ensureBucket,
  ensureDatabase,
  runWorkspaceCommand,
  withFullSetupLock,
} from "./workspace-full.mjs";
import { assertOwnedFullWorkspace } from "./workspace-resource-guard.mjs";

async function writePendingJournal(root, database) {
  const target = path.join(root, DATABASE_INITIALIZATION_PATH);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ database, status: "pending" }, null, 2)}\n`);
  await rename(temporary, target);
}

function listBucketObjects(root, bucket) {
  const source = runWorkspaceCommand({
    command: "curl",
    arguments_: ["-fsS", `http://localhost:4443/storage/v1/b/${bucket}/o`],
    root,
    capture: true,
    capability: "fake-GCS object listing",
  });
  let listing;
  try {
    listing = JSON.parse(source);
  } catch {
    throw new Error("fake-GCS returned an invalid object listing");
  }
  if (listing.nextPageToken !== undefined) {
    throw new Error("fake-GCS object listing was unexpectedly paginated");
  }
  return (listing.items ?? []).map((item) => {
    if (typeof item?.name !== "string") throw new Error("fake-GCS returned an invalid object");
    return item.name;
  });
}

function deleteDatabase(root, database) {
  runWorkspaceCommand({
    command: "docker",
    arguments_: [
      "exec",
      "lazuli-postgres",
      "psql",
      "-U",
      "lazuli",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
    ],
    root,
    capability: "worktree database removal",
  });
}

function deleteBucket(root, bucket) {
  if (!bucketExists(root, bucket)) return;
  for (const object of listBucketObjects(root, bucket)) {
    runWorkspaceCommand({
      command: "curl",
      arguments_: [
        "-fsS",
        "-X",
        "DELETE",
        `http://localhost:4443/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}`,
      ],
      root,
      capability: "worktree fake-GCS object removal",
    });
  }
  runWorkspaceCommand({
    command: "curl",
    arguments_: ["-fsS", "-X", "DELETE", `http://localhost:4443/storage/v1/b/${bucket}`],
    root,
    capability: "worktree fake-GCS bucket removal",
  });
}

export async function refreshWorkspaceFixtures({ root, output }) {
  await withFullSetupLock(root, async () => {
    const workspace = await assertOwnedFullWorkspace(root);
    output(`Refreshing database fixtures in ${workspace.resources.database}...`);
    runWorkspaceCommand({
      command: "pnpm",
      arguments_: ["prisma:seed"],
      root,
      capability: "database fixture refresh",
    });
    await ensureBucket({ root, workspace, output, overwrite: true });
    output("Fixture refresh complete.");
    output("Extra records, manual deletions, and unversioned GCS objects may remain.");
    output("This command does not guarantee a clean snapshot; use pnpm workspace:reset if needed.");
  });
}

export async function resetWorkspace({ root, output }) {
  await withFullSetupLock(root, async () => {
    const workspace = await assertOwnedFullWorkspace(root);
    await writePendingJournal(root, workspace.resources.database);
    output(`Removing Postgres database ${workspace.resources.database}...`);
    deleteDatabase(root, workspace.resources.database);
    output(`Removing fake-GCS bucket ${workspace.resources.bucket}...`);
    deleteBucket(root, workspace.resources.bucket);
    await ensureDatabase({ root, workspace, output });
    await ensureBucket({ root, workspace, output });
    output("Workspace data reset complete. Shared Compose services were preserved.");
  });
}
