import { readFileSync, writeFileSync } from "node:fs";

const [beforePath, afterPath, outputPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !outputPath) {
  throw new Error("Usage: node scripts/plot-staging-panel-comparison.mjs BEFORE AFTER OUTPUT.svg");
}

const runs = [beforePath, afterPath].map((path) => JSON.parse(readFileSync(path, "utf8")));
const conditions = (run) => ({
  baseUrl: run.baseUrl,
  benchmarkProtocol: run.benchmarkProtocol,
  browserVersion: run.browserVersion,
  method: run.method,
  profile: run.profile,
  routes: run.routes,
  samplesPerRoute: run.samplesPerRoute,
});
if (JSON.stringify(conditions(runs[0])) !== JSON.stringify(conditions(runs[1]))) {
  throw new Error("Benchmark conditions differ");
}

function percentile(run, fraction) {
  const values = run.samples.map((sample) => sample.fullReadyMs).sort((a, b) => a - b);
  if (values.length < 20 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("At least 20 valid fullReadyMs samples are required");
  }
  return Math.round(values[Math.ceil(values.length * fraction) - 1]);
}

const colors = ["#285A78", "#C56932"];
const labels = ["Antes", "Depois"];
const rows = [
  { name: "p50", fraction: 0.5, y: 140 },
  { name: "p95", fraction: 0.95, y: 265 },
];
const left = 185;
const scale = (ms) => (ms / 1300) * 810;
const escape = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const text = (x, y, value, attributes = "") =>
  `<text x="${x}" y="${y}" ${attributes}>${escape(value)}</text>`;
const elements = [
  '<rect width="1100" height="440" fill="#fff"/>',
  text(30, 42, "Painel · primeira navegação", 'font-size="26" font-weight="700"'),
  text(
    30,
    69,
    "Clique até indicadores, gráfico e pendências prontos",
    'font-size="16" fill="#536875"',
  ),
  text(
    30,
    96,
    "20 amostras por imagem · mesmo navegador, conta, protocolo e Colima",
    'font-size="14" fill="#536875"',
  ),
];
for (const tick of [0, 300, 600, 900, 1200]) {
  const x = left + scale(tick);
  elements.push(
    `<line x1="${x}" y1="116" x2="${x}" y2="362" stroke="${tick === 300 ? "#438C5A" : "#E2E8EC"}" stroke-width="${tick === 300 ? 2 : 1}" ${tick === 300 ? 'stroke-dasharray="5 5"' : ""}/>`,
  );
  elements.push(text(x, 386, `${tick} ms`, 'text-anchor="middle" font-size="13"'));
}
for (const row of rows) {
  elements.push(text(30, row.y + 32, row.name, 'font-size="20" font-weight="700"'));
  for (const [index, run] of runs.entries()) {
    const value = percentile(run, row.fraction);
    const y = row.y + index * 39;
    elements.push(text(100, y + 21, labels[index], 'font-size="15"'));
    elements.push(
      `<rect x="${left}" y="${y}" width="${scale(value).toFixed(1)}" height="28" rx="3" fill="${colors[index]}"/>`,
    );
    elements.push(
      text(left + scale(value) + 9, y + 21, `${value} ms`, 'font-size="15" font-weight="700"'),
    );
  }
}
elements.push(
  text(
    30,
    421,
    "Linha verde: meta p95 < 300 ms. As barras representam a tela inteira, não queries isoladas.",
    'font-size="14" fill="#536875"',
  ),
);
writeFileSync(
  outputPath,
  `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="440" viewBox="0 0 1100 440" role="img">
<g font-family="Arial, Helvetica, sans-serif" fill="#183040">${elements.join("\n")}</g>
</svg>\n`,
);
