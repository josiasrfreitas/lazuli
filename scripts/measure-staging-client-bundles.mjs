import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import vm from "node:vm";

const BUILD_ROOT = resolve(process.argv[2] ?? "/app/apps/web/.next");
const includeAssets = process.argv.includes("--include-assets");
const APP_ROOT = join(BUILD_ROOT, "server/app");
const STATIC_ROOT = join(BUILD_ROOT, "static");
const assetCache = new Map();

function manifestsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return manifestsIn(path);
    return entry.name.endsWith("_client-reference-manifest.js") ? [path] : [];
  });
}

function assetSize(path) {
  const normalized = path.replace(/^\/_next\//u, "").replace(/^static\//u, "");
  const cached = assetCache.get(normalized);
  if (cached) return cached;
  const file = join(STATIC_ROOT, normalized);
  const bytes = readFileSync(file);
  const result = {
    path: normalized,
    raw: statSync(file).size,
    gzip: gzipSync(bytes, { level: 6 }).length,
    brotli: brotliCompressSync(bytes).length,
  };
  assetCache.set(normalized, result);
  return result;
}

function summarize(paths) {
  const assets = [...new Set(paths)].map(assetSize);
  return {
    files: assets.length,
    rawBytes: assets.reduce((sum, asset) => sum + asset.raw, 0),
    gzipBytes: assets.reduce((sum, asset) => sum + asset.gzip, 0),
    brotliBytes: assets.reduce((sum, asset) => sum + asset.brotli, 0),
    ...(includeAssets ? { assets } : {}),
  };
}

function pathOf(entry) {
  return typeof entry === "string" ? entry : entry.path;
}

const routes = [];
for (const file of manifestsIn(APP_ROOT)) {
  const context = { globalThis: {} };
  vm.runInNewContext(readFileSync(file, "utf8"), context, { filename: file });
  const routeKey = Object.keys(context.globalThis.__RSC_MANIFEST ?? {})[0];
  if (!routeKey) continue;
  const manifest = context.globalThis.__RSC_MANIFEST[routeKey];
  const jsEntries = Object.entries(manifest.entryJSFiles ?? {});
  const cssEntries = Object.entries(manifest.entryCSSFiles ?? {});
  const pageJs = jsEntries.at(-1)?.[1] ?? [];
  const pageCss = cssEntries.at(-1)?.[1]?.map(pathOf) ?? [];
  const layoutJs =
    jsEntries
      .filter(([key]) => key.includes("apps/web/src/app") && key.includes("layout"))
      .at(-1)?.[1] ?? [];
  const layoutCss =
    cssEntries
      .filter(([key]) => key.includes("apps/web/src/app") && key.includes("layout"))
      .at(-1)?.[1]
      ?.map(pathOf) ?? [];
  const route = routeKey.replace(/\/\([^/]+\)/gu, "").replace(/\/page$/u, "") || "/";
  routes.push({
    route,
    js: summarize(pageJs),
    css: summarize(pageCss),
    incrementalJs: summarize(pageJs.filter((path) => !layoutJs.includes(path))),
    incrementalCss: summarize(pageCss.filter((path) => !layoutCss.includes(path))),
  });
}

const largestAssets = [...assetCache.values()].sort((a, b) => b.brotli - a.brotli).slice(0, 12);
console.log(
  JSON.stringify({
    method: "Next.js client-reference manifests; initial route assets, cold cache estimate",
    buildRoot: relative("/app", BUILD_ROOT),
    buildId: readFileSync(join(BUILD_ROOT, "BUILD_ID"), "utf8").trim(),
    routeCount: routes.length,
    routes: routes.sort((a, b) => b.js.brotliBytes - a.js.brotliBytes),
    largestAssets,
  }),
);
