import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const output = join(import.meta.dirname, "..", "docs", "performance");
const data = JSON.parse(
  readFileSync(join(output, "staging-navigation-smoke-comparison-2026-11-04.json"), "utf8"),
);
const [initial, current] = data.runs;
const labels = new Map([
  ["/", "Painel"],
  ["/alunos", "Alunos"],
  ["/turmas", "Turmas"],
  ["/recebiveis", "Recebíveis"],
  ["/financeiro", "Financeiro"],
  ["/aulas", "Aulas"],
]);
const blue = "#285A78";
const orange = "#C56932";
const grey = "#A9BAC4";
const ink = "#183040";
const escape = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const label = (x, y, value, extra = "") =>
  `<text x="${x}" y="${y}" ${extra}>${escape(value)}</text>`;
const base = (height, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}" viewBox="0 0 1100 ${height}" role="img">
<rect width="1100" height="${height}" fill="#FFFFFF"/>
<g font-family="Arial, Helvetica, sans-serif" fill="${ink}">${body}</g>
</svg>\n`;

function routeComparison() {
  const left = 195;
  const width = 790;
  const scale = (ms) => (ms / 1300) * width;
  const rows = initial.routes.map((before, index) => {
    const after = current.routes.find((row) => row.path === before.path);
    if (!after) throw new Error(`Missing route ${before.path}`);
    const y = 160 + index * 64;
    return [
      label(30, y + 18, labels.get(before.path) ?? before.path, 'font-size="17"'),
      `<rect x="${left}" y="${y}" width="${scale(before.readyMs).toFixed(1)}" height="20" fill="${blue}" rx="3"/>`,
      `<rect x="${left}" y="${y + 25}" width="${scale(after.readyMs).toFixed(1)}" height="20" fill="${orange}" rx="3"/>`,
      label(left + scale(before.readyMs) + 8, y + 16, `${before.readyMs} ms`, 'font-size="14"'),
      label(left + scale(after.readyMs) + 8, y + 41, `${after.readyMs} ms`, 'font-size="14"'),
    ].join("\n");
  });
  const ticks = [0, 300, 400, 600, 900, 1200]
    .map((value) => {
      const x = left + scale(value);
      return `<line x1="${x}" y1="148" x2="${x}" y2="532" stroke="#E2E8EC"/>\n${label(x, 550, value, 'text-anchor="middle" font-size="13"')}`;
    })
    .join("\n");
  const targetX = left + scale(300);
  const body = [
    label(30, 42, "Primeira navegação · staging", 'font-size="25" font-weight="700"'),
    label(
      30,
      68,
      "Clique até tela pronta · mesma conta e protocolo",
      'font-size="16" fill="#536875"',
    ),
    `<rect x="${left}" y="102" width="15" height="15" fill="${blue}"/>`,
    label(left + 23, 115, "Inicial", 'font-size="15"'),
    `<rect x="${left + 110}" y="102" width="15" height="15" fill="${orange}"/>`,
    label(left + 133, 115, "Nova imagem", 'font-size="15"'),
    ticks,
    `<line x1="${targetX}" y1="148" x2="${targetX}" y2="532" stroke="#438C5A" stroke-width="2" stroke-dasharray="5 5"/>`,
    rows.join("\n"),
    label(
      30,
      580,
      "Linha verde: meta p95 < 300 ms. Uma amostra por rota; barras não são p95 nem ganho causal.",
      'font-size="14" fill="#536875"',
    ),
  ].join("\n");
  writeFileSync(
    join(output, "staging-navigation-smoke-comparison-2026-11-04.svg"),
    base(610, body),
  );
}

function panelWaterfall() {
  const left = 195;
  const width = 790;
  const scale = (ms) => (ms / 1300) * width;
  const rows = [initial, current].map((run, index) => {
    const home = run.routes.find((row) => row.path === "/");
    if (!home || home.firstApiStartMs === null || home.lastApiEndMs === null) {
      throw new Error("Missing panel network milestones");
    }
    const y = 165 + index * 100;
    return [
      label(30, y + 22, run.label, 'font-size="17"'),
      `<rect x="${left}" y="${y}" width="${scale(home.firstApiStartMs).toFixed(1)}" height="35" fill="${grey}"/>`,
      `<rect x="${left + scale(home.firstApiStartMs)}" y="${y}" width="${scale(home.lastApiEndMs - home.firstApiStartMs).toFixed(1)}" height="35" fill="${blue}"/>`,
      `<rect x="${left + scale(home.lastApiEndMs)}" y="${y}" width="${scale(home.readyMs - home.lastApiEndMs).toFixed(1)}" height="35" fill="${orange}"/>`,
      label(
        left + scale(home.readyMs) + 10,
        y + 24,
        `${home.readyMs} ms`,
        'font-size="16" font-weight="700"',
      ),
      label(
        left,
        y + 57,
        `API iniciou ${home.firstApiStartMs} ms · respondeu ${home.lastApiEndMs} ms`,
        'font-size="14" fill="#536875"',
      ),
    ].join("\n");
  });
  const ticks = [0, 300, 600, 900, 1200]
    .map((value) => {
      const x = left + scale(value);
      return `<line x1="${x}" y1="150" x2="${x}" y2="350" stroke="#E2E8EC"/>\n${label(x, 370, value, 'text-anchor="middle" font-size="13"')}`;
    })
    .join("\n");
  const body = [
    label(30, 42, "Painel · caminho até a tela pronta", 'font-size="25" font-weight="700"'),
    label(
      30,
      68,
      "O lote tRPC começou antes, mas demorou mais nesta amostra",
      'font-size="16" fill="#536875"',
    ),
    `<rect x="195" y="101" width="15" height="15" fill="${grey}"/>`,
    label(218, 114, "Até iniciar API", 'font-size="14"'),
    `<rect x="365" y="101" width="15" height="15" fill="${blue}"/>`,
    label(388, 114, "API até última resposta", 'font-size="14"'),
    `<rect x="585" y="101" width="15" height="15" fill="${orange}"/>`,
    label(608, 114, "Resposta até pronta", 'font-size="14"'),
    ticks,
    rows.join("\n"),
    label(
      30,
      410,
      "Uma amostra por versão; duração do lote inclui rede e servidor, não mede queries isoladas.",
      'font-size="14" fill="#536875"',
    ),
  ].join("\n");
  writeFileSync(join(output, "staging-panel-smoke-waterfall-2026-11-04.svg"), base(440, body));
}

routeComparison();
panelWaterfall();
