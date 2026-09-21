#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ISSUE_LIMIT = 10;

export function formatReport({ branch, repository, pullRequest, issues, totalOpenIssues }) {
  const lines = [
    `${repository.nameWithOwner} — ${branch.name}`,
    `Branch: ${formatBranchStatus(branch)}`,
    "",
    "PR da branch",
  ];

  if (pullRequest === null) {
    lines.push("  Nenhum PR encontrado para esta branch.");
  } else {
    lines.push(...formatPullRequest(pullRequest));
  }

  lines.push("", `Projeto: ${totalOpenIssues} issue(s) aberto(s)`);
  if (issues.length === 0) {
    lines.push("  Nenhuma pendência aberta.");
  } else {
    for (const issue of issues) {
      const labels = issue.labels.map((label) => label.name).join(", ");
      const suffix = labels.length > 0 ? ` [${labels}]` : "";
      lines.push(`  #${issue.number} ${issue.title}${suffix}`);
    }
    if (totalOpenIssues > issues.length) {
      lines.push(`  … exibindo ${issues.length} de ${totalOpenIssues}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatPullRequest(pullRequest) {
  const linkedOpenIssues = pullRequest.closingIssuesReferences.filter(
    (issue) => issue.state === "OPEN",
  );
  const linkedIssues =
    linkedOpenIssues.length === 0
      ? "  Issues vinculados pendentes: nenhum"
      : `  Issues vinculados pendentes: ${linkedOpenIssues
          .map((issue) => `#${issue.number} ${issue.title}`)
          .join("; ")}`;

  return [
    `  #${pullRequest.number} ${pullRequest.title}`,
    `  Status: ${formatPullRequestStatus(pullRequest)}`,
    `  Reviews: ${formatReviewDecision(pullRequest.reviewDecision)}`,
    `  Checks: ${formatChecks(pullRequest.statusCheckRollup)}`,
    `  Merge: ${formatMergeability(pullRequest)}`,
    `  ${pullRequest.url}`,
    linkedIssues,
  ];
}

export function formatPullRequestStatus(pullRequest) {
  if (pullRequest.mergedAt !== null) return `mergeado em ${pullRequest.mergedAt}`;
  if (pullRequest.state === "CLOSED") return "fechado sem merge";
  if (pullRequest.isDraft) return "rascunho";
  return "aberto";
}

function formatBranchStatus(branch) {
  const sync = branch.upstream
    ? `${branch.ahead} à frente, ${branch.behind} atrás de ${branch.upstream}`
    : "sem upstream";
  const worktree =
    branch.changedFiles === 0 ? "worktree limpo" : `${branch.changedFiles} arquivo(s) alterado(s)`;
  return `${sync}; ${worktree}`;
}

function formatReviewDecision(decision) {
  if (decision === "APPROVED") return "aprovado";
  if (decision === "CHANGES_REQUESTED") return "alterações solicitadas";
  if (decision === "REVIEW_REQUIRED") return "review pendente";
  return "sem decisão";
}

function formatChecks(checks) {
  if (checks.length === 0) return "nenhum";
  const failing = checks.filter((check) =>
    ["ACTION_REQUIRED", "CANCELLED", "FAILURE", "STALE", "TIMED_OUT"].includes(check.conclusion),
  ).length;
  const pending = checks.filter((check) => check.status !== "COMPLETED").length;
  const passing = checks.length - failing - pending;
  return `${passing} ok, ${pending} pendente(s), ${failing} falhando`;
}

function formatMergeability(pullRequest) {
  if (pullRequest.mergedAt !== null) return "concluído";
  if (pullRequest.mergeable === "CONFLICTING") return "com conflitos";
  if (pullRequest.mergeable === "MERGEABLE") return "liberado";
  if (pullRequest.mergeable === "UNKNOWN") return "indefinido";
  return pullRequest.mergeable.toLowerCase();
}

function run({ command, arguments_, allowFailure = false }) {
  const result = spawnSync(command, arguments_, { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    const detail = result.stderr.trim() || result.stdout.trim() || `status ${result.status}`;
    throw new Error(`${command} ${arguments_.join(" ")} falhou: ${detail}`);
  }
  return result;
}

function readJson({ command, arguments_, allowFailure = false }) {
  const result = run({ command, arguments_, allowFailure });
  if (result.status !== 0) return null;
  return JSON.parse(result.stdout);
}

function readBranch() {
  const output = run({
    command: "git",
    arguments_: ["status", "--porcelain=v2", "--branch"],
  }).stdout;
  const name = output.match(/^# branch\.head (.+)$/mu)?.[1];
  if (!name || name === "(detached)")
    throw new Error("Não foi possível identificar a branch atual.");
  const upstream = output.match(/^# branch\.upstream (.+)$/mu)?.[1] ?? null;
  const divergence = output.match(/^# branch\.ab \+(\d+) -(\d+)$/mu);
  const changedFiles = output.split("\n").filter((line) => /^[12u?] /u.test(line)).length;
  return {
    name,
    upstream,
    ahead: Number(divergence?.[1] ?? 0),
    behind: Number(divergence?.[2] ?? 0),
    changedFiles,
  };
}

function readPullRequest(branchName) {
  const pullRequests = readJson({
    command: "gh",
    arguments_: [
      "pr",
      "list",
      "--head",
      branchName,
      "--state",
      "all",
      "--limit",
      "1",
      "--json",
      "number,title,state,isDraft,mergedAt,mergeable,reviewDecision,statusCheckRollup,closingIssuesReferences,url",
    ],
  });
  return pullRequests[0] ?? null;
}

function readOpenIssueCount(repository) {
  const result = readJson({
    command: "gh",
    arguments_: [
      "api",
      "-X",
      "GET",
      "search/issues",
      "-f",
      `q=repo:${repository} is:issue is:open`,
    ],
  });
  return result.total_count;
}

function main() {
  const repository = readJson({
    command: "gh",
    arguments_: ["repo", "view", "--json", "nameWithOwner"],
  });
  const branch = readBranch();
  const pullRequest = readPullRequest(branch.name);
  const issues = readJson({
    command: "gh",
    arguments_: [
      "issue",
      "list",
      "--state",
      "open",
      "--limit",
      String(ISSUE_LIMIT),
      "--json",
      "number,title,url,labels,milestone,assignees,updatedAt",
    ],
  });
  const totalOpenIssues = readOpenIssueCount(repository.nameWithOwner);
  process.stdout.write(formatReport({ branch, repository, pullRequest, issues, totalOpenIssues }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`ghpending: ${error.message}\n`);
    process.exitCode = 1;
  }
}
