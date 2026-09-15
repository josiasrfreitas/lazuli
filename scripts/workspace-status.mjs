import { spawnSync } from "node:child_process";

import { readWorkspaceMetadata } from "./lib/workspace-metadata.mjs";

const root = process.cwd();
const STATUS_ARGUMENT_COUNT = 2;

function output(message) {
  process.stdout.write(`${message}\n`);
}

function errorOutput(message) {
  process.stderr.write(`${message}\n`);
}

function observedStackHealth() {
  const result = spawnSync("docker", ["compose", "ps", "--format", "json"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error?.code === "ENOENT") return "não observada (Docker indisponível)";
  if (result.status !== 0) return "não observada (Docker não está acessível)";
  const rows = result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    });
  if (rows.length === 0) return "não observada (nenhum serviço compartilhado em execução)";
  return rows
    .map(
      (row) =>
        `${row.Service ?? row.Name ?? "serviço"}: ${row.Health ?? row.State ?? "estado desconhecido"}`,
    )
    .join(", ");
}

async function main() {
  if (process.argv.length !== STATUS_ARGUMENT_COUNT) {
    errorOutput("Usage: pnpm workspace:status");
    process.exitCode = 2;
    return;
  }
  const workspace = await readWorkspaceMetadata(root);
  if (workspace === null) {
    throw new Error("workspace metadata is absent; run pnpm workspace:setup light first");
  }
  output(`Perfil: ${workspace.profile}`);
  output(`Identidade: ${workspace.identity}`);
  output(`URL Web: ${workspace.urls.web}`);
  output(`URL Storybook: ${workspace.urls.storybook}`);
  output(`Porta Web: ${workspace.ports.web}`);
  output(`Porta Storybook: ${workspace.ports.storybook}`);
  output(`Banco pretendido: ${workspace.resources.database} (não provisionado pelo perfil light)`);
  output(`Bucket pretendido: ${workspace.resources.bucket} (não provisionado pelo perfil light)`);
  output(
    "Dependências: pnpm para instalação; Docker Compose é opcional para a stack compartilhada.",
  );
  output(`Stack compartilhada (saúde observada): ${observedStackHealth()}`);
}

try {
  await main();
} catch (error) {
  errorOutput(`workspace:status failed: ${error.message}`);
  process.exitCode = 1;
}
