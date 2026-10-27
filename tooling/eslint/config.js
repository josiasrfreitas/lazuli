import path from "node:path";

/** Locate the workspace's tsgolint executable without changing the parent environment. */
export function getOxlintEnvironment(binDirectory) {
  return {
    ...process.env,
    PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
  };
}
