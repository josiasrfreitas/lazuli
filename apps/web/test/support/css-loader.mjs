import { readFile } from "node:fs/promises";
import { URL } from "node:url";

// Adapt Node’s three-argument module hook at the boundary.
export async function load(...[url, context, nextLoad]) {
  if (!url.endsWith(".css")) return nextLoad(url, context);
  const css = await readFile(new URL(url), "utf8");
  const classes = [...css.matchAll(/\.([_a-zA-Z][_a-zA-Z0-9-]*)/gu)].map((match) => [
    match[1],
    match[1],
  ]);
  return {
    format: "module",
    shortCircuit: true,
    source: `export default ${JSON.stringify(Object.fromEntries(classes))};`,
  };
}
