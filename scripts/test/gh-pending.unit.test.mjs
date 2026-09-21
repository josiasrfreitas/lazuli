import assert from "node:assert/strict";
import { it } from "node:test";

import { formatPullRequestStatus, formatReport } from "../gh-pending.mjs";

const branch = {
  name: "feature/installments",
  upstream: "origin/feature/installments",
  ahead: 1,
  behind: 2,
  changedFiles: 3,
};
const repository = { nameWithOwner: "school/lazuli" };

it("distinguishes a merged PR and excludes completed linked issues from pending work", () => {
  const pullRequest = {
    number: 42,
    title: "Agrupa parcelas vencidas",
    state: "CLOSED",
    isDraft: false,
    mergedAt: "2026-09-20T12:00:00Z",
    mergeable: "UNKNOWN",
    reviewDecision: "APPROVED",
    statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }],
    closingIssuesReferences: [
      { number: 7, title: "Issue concluído", state: "CLOSED" },
      { number: 8, title: "Issue ainda aberto", state: "OPEN" },
    ],
    url: "https://github.com/school/lazuli/pull/42",
  };

  const output = formatReport({
    branch,
    repository,
    pullRequest,
    issues: [],
    totalOpenIssues: 0,
  });

  assert.match(output, /Status: mergeado em 2026-09-20T12:00:00Z/u);
  assert.match(output, /Issues vinculados pendentes: #8 Issue ainda aberto/u);
  assert.doesNotMatch(output, /#7 Issue concluído/u);
});

it("reports an open draft independently from its mergeability", () => {
  assert.equal(
    formatPullRequestStatus({ mergedAt: null, state: "OPEN", isDraft: true }),
    "rascunho",
  );
});

it("reports the branch and project backlog when no PR exists", () => {
  const output = formatReport({
    branch,
    repository,
    pullRequest: null,
    issues: [{ number: 97, title: "Pendência do projeto", labels: [{ name: "priority: high" }] }],
    totalOpenIssues: 12,
  });

  assert.match(
    output,
    /Branch: 1 à frente, 2 atrás de origin\/feature\/installments; 3 arquivo\(s\) alterado\(s\)/u,
  );
  assert.match(output, /Nenhum PR encontrado/u);
  assert.match(output, /Projeto: 12 issue\(s\) aberto\(s\)/u);
  assert.match(output, /#97 Pendência do projeto \[priority: high\]/u);
  assert.match(output, /exibindo 1 de 12/u);
});
