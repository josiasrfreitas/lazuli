// Stryker does not track imported helpers or workspace dependencies. Hash all repository
// inputs conservatively; only dedicated documentation paths are irrelevant to execution.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";

import {
  groupSourceFilesByPackage,
  listChangedFiles,
  readOption,
} from "./changed-source-files.mjs";

const environment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
);
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    encoding: "utf8",
    env: environment,
  },
)
  .split("\0")
  .filter(Boolean);
const fingerprint = createHash("sha256").update(process.version);
fingerprint.update(
  JSON.stringify([process.env.ImageOS, process.env.ImageVersion, process.env.NODE_OPTIONS]),
);
const base = readOption("base");
if (base) {
  fingerprint.update(JSON.stringify([...groupSourceFilesByPackage(listChangedFiles(base))]));
}

for (const file of [...new Set(files)].toSorted()) {
  if (file.startsWith("docs/") || file.startsWith(".design/") || /^[^/]+\.md$/u.test(file))
    continue;
  const metadata = lstatSync(file, { throwIfNoEntry: false });
  if (!metadata) continue;
  fingerprint.update(file).update("\0").update(String(metadata.mode));
  // Git tracks a symlink's target path, including the directory links used by skills.
  const content = metadata.isSymbolicLink() ? readlinkSync(file) : readFileSync(file);
  fingerprint.update("\0").update(content).update("\0");
}

process.stdout.write(`${fingerprint.digest("hex")}\n`);
