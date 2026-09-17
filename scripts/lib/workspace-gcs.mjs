import { readdir } from "node:fs/promises";
import path from "node:path";

function curlStatus({ root, url, run }) {
  return run({
    command: "curl",
    arguments_: ["-sS", "-o", "/dev/null", "-w", "%{http_code}", url],
    root,
    capture: true,
    capability: "fake-GCS inspection",
  }).trim();
}

export function localBucketExists({ root, bucket, run }) {
  return (
    curlStatus({
      root,
      url: `http://localhost:4443/storage/v1/b/${bucket}?project=lazuli-local`,
      run,
    }) === "200"
  );
}

async function seedFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const key = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory())
      files.push(...(await seedFiles(path.join(directory, entry.name), key)));
    else if (entry.isFile() && entry.name !== ".gitkeep")
      files.push({ path: path.join(directory, entry.name), key });
  }
  return files;
}

function uploadObject({ root, bucket, file, run, output, overwrite }) {
  const encoded = encodeURIComponent(file.key);
  const objectUrl = `http://localhost:4443/storage/v1/b/${bucket}/o/${encoded}`;
  if (!overwrite && curlStatus({ root, url: objectUrl, run }) === "200") {
    output(`Keeping existing object gs://${bucket}/${file.key}.`);
    return;
  }
  output(`${overwrite ? "Uploading" : "Uploading missing"} object gs://${bucket}/${file.key}...`);
  run({
    command: "curl",
    arguments_: [
      "-fsS",
      "-X",
      "POST",
      "--data-binary",
      `@${file.path}`,
      `http://localhost:4443/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encoded}`,
    ],
    root,
    capability: "fake-GCS object upload",
  });
}

function createBucket({ root, bucket, ownership, run }) {
  run({
    command: "curl",
    arguments_: [
      "-fsS",
      "-X",
      "POST",
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify({ name: bucket, labels: ownership?.labels }),
      "http://localhost:4443/storage/v1/b?project=lazuli-local",
    ],
    root,
    capability: "fake-GCS bucket creation",
  });
  if (ownership === undefined) return;
  run({
    command: "curl",
    arguments_: [
      "-fsS",
      "-X",
      "POST",
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      ownership.contents,
      `http://localhost:4443/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(ownership.objectName)}`,
    ],
    root,
    capability: "fake-GCS bucket ownership marking",
  });
}

export async function ensureLocalBucket({
  root,
  workspace,
  output,
  overwrite = false,
  run,
  ownership,
}) {
  const bucket = workspace.resources.bucket;
  const created = !localBucketExists({ root, bucket, run });
  if (created) {
    output(`Creating fake-GCS bucket ${bucket}...`);
    createBucket({ root, bucket, ownership, run });
  }
  const seedRoot = path.join(root, "infra/local/gcs-seed");
  let files;
  try {
    files = await seedFiles(seedRoot);
  } catch (error) {
    if (error.code === "ENOENT") files = [];
    else throw error;
  }
  for (const file of files) uploadObject({ root, bucket, file, run, output, overwrite });
}
