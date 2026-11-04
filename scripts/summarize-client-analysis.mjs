import { readFileSync } from "node:fs";
import { join } from "node:path";

const [analysisDirectory, route = "alunos/[id]"] = process.argv.slice(2);
if (!analysisDirectory)
  throw new Error("Usage: node scripts/summarize-client-analysis.mjs ANALYSIS_DIRECTORY [ROUTE]");
const buffer = readFileSync(join(analysisDirectory, "data", route, "analyze.data"));
// Next 16.2's experimental analyzer format: JSON length, JSON, binary indexes.
const graph = JSON.parse(buffer.subarray(4, 4 + buffer.readUInt32BE(0)).toString());
const sourcePaths = new Map();
function sourcePath(index) {
  if (sourcePaths.has(index)) return sourcePaths.get(index);
  const source = graph.sources[index];
  const result =
    `${source.parent_source_index == null ? "" : sourcePath(source.parent_source_index) + "/"}${source.path}`.replace(
      /\/+/gu,
      "/",
    );
  sourcePaths.set(index, result);
  return result;
}
const sources = new Map();
for (const part of graph.chunk_parts) {
  const filename = graph.output_files[part.output_file_index].filename;
  if (!filename.startsWith("[client-fs]") || !filename.endsWith(".js")) continue;
  const path = sourcePath(part.source_index);
  sources.set(path, (sources.get(path) ?? 0) + part.size);
}
const packages = new Map();
for (const [path, bytes] of sources) {
  const dependencyPath = path.split("/node_modules/").at(-1);
  const name = path.includes("/node_modules/")
    ? dependencyPath
        .split("/")
        .slice(0, dependencyPath.startsWith("@") ? 2 : 1)
        .join("/")
    : "workspace";
  packages.set(name, (packages.get(name) ?? 0) + bytes);
}
const descending = (map) => [...map].sort((first, second) => second[1] - first[1]);
console.log(
  JSON.stringify(
    {
      method:
        "Next 16.2 experimental-analyze client emitted module sizes; includes deferred chunks, not initial transfer or CPU",
      route,
      packages: descending(packages).map(([name, rawBytes]) => ({ name, rawBytes })),
      largestModules: descending(sources)
        .slice(0, 30)
        .map(([path, rawBytes]) => ({ path, rawBytes })),
      productModules: descending(sources)
        .filter(([path]) => path.includes("/apps/web/src/"))
        .slice(0, 30)
        .map(([path, rawBytes]) => ({ path, rawBytes })),
    },
    null,
    2,
  ),
);
