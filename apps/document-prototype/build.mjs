import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";

await mkdir("dist/assets", { recursive: true });
await build({
  entryPoints: ["src/client.jsx"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "dist/assets",
  minify: true,
  jsx: "automatic",
  target: "es2022",
  define: { "process.env.NODE_ENV": '"production"' },
});
const css = await postcss([tailwind()]).process(await readFile("src/style.css", "utf8"), {
  from: "src/style.css",
});
await writeFile("dist/assets/style.css", css.css);
for (const name of ["server", "ocr-worker"]) {
  await build({
    entryPoints: [`src/${name}.mjs`],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: `dist/${name}.mjs`,
    target: "node22",
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
  });
}
await cp("src/index.html", "dist/index.html");
