#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: scripts/ship-it.sh ISSUE_NUMBER [--model MODEL] [--effort EFFORT]

Plan and implement a GitHub issue in an Orca worktree, open a PR with evidence,
then babysit its CI and review feedback. Defaults: gpt-6-sol, low.
HELP
}

issue=${1:-}
if [[ "$issue" == --help || "$issue" == -h ]]; then usage; exit 0; fi
[[ "$issue" =~ ^[1-9][0-9]*$ ]] || { usage >&2; exit 2; }
shift
model=gpt-6-sol
effort=low
while (($#)); do
  case "$1" in
    --model|--effort)
      (($# >= 2)) || { echo "Missing value for $1" >&2; exit 2; }
      if [[ "$1" == --model ]]; then model=$2; else effort=$2; fi
      shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
[[ "$model" =~ ^[a-zA-Z0-9._-]+$ ]] || { echo 'Invalid model' >&2; exit 2; }
[[ "$effort" =~ ^(low|medium|high|xhigh|max|ultra)$ ]] || { echo 'Invalid effort' >&2; exit 2; }
for command in git gh orca codex python3; do
  command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 1; }
done

repo=$(git rev-parse --show-toplevel)
main_path=
while IFS= read -r line; do
  case "$line" in
    'worktree '*) candidate=${line#worktree } ;;
    'branch refs/heads/main') main_path=$candidate; break ;;
  esac
done < <(git -C "$repo" worktree list --porcelain)
[[ -n "$main_path" ]] || { echo 'No local main worktree found' >&2; exit 1; }
[[ -z "$(git -C "$main_path" status --porcelain)" ]] || { echo "Main worktree is dirty: $main_path" >&2; exit 1; }

# Orca has no git pull command; update its main checkout before asking it for a worktree.
git -C "$main_path" fetch origin main
git -C "$main_path" merge --ff-only origin/main
[[ "$(git -C "$main_path" rev-parse HEAD)" == "$(git -C "$main_path" rev-parse origin/main)" ]] || {
  echo 'Main is not current with origin/main' >&2; exit 1;
}
cd "$main_path"
repo_name=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh issue view "$issue" --repo "$repo_name" --json number --jq .number >/dev/null
orca status --json >/dev/null
created=$(orca worktree create --name "issue-$issue" --issue "$issue" --no-parent --setup run --json)
worktree_path=$(python3 -c 'import json,sys; data=json.load(sys.stdin); assert data.get("ok"), data.get("error"); print(data["result"]["worktree"]["path"])' <<<"$created")
[[ -d "$worktree_path" ]] || { echo 'Orca did not create the worktree' >&2; exit 1; }
plan="$worktree_path/.design/issues/$issue/PLAN.md"
mkdir -p "$(dirname "$plan")"

codex_run() {
  codex exec --model "$model" -c "model_reasoning_effort=\"$effort\"" -C "$worktree_path" "$@"
}

printf 'Planning issue #%s in %s\n' "$issue" "$worktree_path"
codex_run --output-last-message "$plan" "Read GitHub issue $repo_name#$issue and the repository instructions. Produce a structured implementation plan with scope, decisions/dependencies, files, test contract, validation, and visual evidence approach. Start your final answer with exactly STATUS: READY when implementation can proceed, or STATUS: BLOCKED when a requirement or accepted decision must be resolved first. The final answer is saved as .design/issues/$issue/PLAN.md. Do not make any other edits or open a PR in this phase. Explain any blocker in the plan."
[[ -s "$plan" ]] || { echo 'Codex did not produce a plan' >&2; exit 1; }
[[ "$(head -n 1 "$plan")" == "STATUS: READY" ]] || { echo "Plan is blocked or missing READY status: $plan" >&2; exit 1; }

printf 'Implementing issue #%s\n' "$issue"
{
  printf 'Implement GitHub issue %s#%s using this plan. Recheck it against the issue and repository instructions. Include the plan file in the PR. Run proportional checks, inspect the complete diff, and run git diff --check. Create a PR using the installed pr skill template. Include before/after evidence; for a UI change capture actual screenshots at desktop and narrow widths and link committed evidence in the PR. Do not claim visual evidence from placeholders. Commit and push the completed work. Do not merge.\n\nPLAN:\n' "$repo_name" "$issue"
  cat "$plan"
} | codex_run -

pr_url=$(gh -R "$repo_name" pr view "$(git -C "$worktree_path" branch --show-current)" --json url --jq .url)
[[ "$pr_url" == https://github.com/* ]] || { echo 'No PR found for worktree branch' >&2; exit 1; }
printf 'Babysitting %s\n' "$pr_url"
codex_run "Use the installed babysit-pr skill to monitor and fix $pr_url until checks are stably green and delivered review feedback is handled. Never merge. Report final SHA, CI outcome, and any unresolved review item."
gh pr checks "$pr_url"
printf 'Finished: %s\n' "$pr_url"
