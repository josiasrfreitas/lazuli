#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: ship-it ISSUE_NUMBER [--model MODEL] [--effort EFFORT]

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
if ! created=$(orca worktree show --worktree "issue:$issue" --json 2>/dev/null); then
  if ! created=$(orca worktree create --name "issue-$issue" --issue "$issue" --no-parent --setup run --json); then
    created=$(orca worktree show --worktree "issue:$issue" --json) || {
      echo "Orca could not create or find the worktree for issue #$issue" >&2
      exit 1
    }
  fi
fi
worktree_id=$(python3 -c 'import json,sys; data=json.load(sys.stdin); assert data.get("ok"), data.get("error"); print(data["result"]["worktree"]["id"])' <<<"$created")
worktree_path=$(python3 -c 'import json,sys; data=json.load(sys.stdin); assert data.get("ok"), data.get("error"); print(data["result"]["worktree"]["path"])' <<<"$created")
[[ -d "$worktree_path" ]] || { echo 'Orca did not create the worktree' >&2; exit 1; }
existing_terminals=$(orca terminal list --worktree "id:$worktree_id" --json)
existing_agent=$(python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok"), d.get("error"); print(next((t["handle"] for t in d["result"]["terminals"] if t.get("agentIdentity")=="codex" and t.get("connected")), ""))' <<<"$existing_terminals")
if [[ -n "$existing_agent" ]]; then
  printf 'Codex session already exists for issue #%s\nWorktree: %s\nTerminal: %s\n' "$issue" "$worktree_path" "$existing_agent"
  exit 0
fi

codex_command="codex --model $model -c model_reasoning_effort=\\\"$effort\\\" --dangerously-bypass-approvals-and-sandbox"
terminal_json=$(orca terminal create --worktree "id:$worktree_id" --title "ship-it #$issue" --command "$codex_command" --focus --json)
terminal_handle=$(python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok"), d.get("error"); r=d["result"]; print(r.get("terminal",{}).get("handle") or r.get("startupTerminal",{}).get("handle") or r.get("handle") or r.get("terminalHandle") or "")' <<<"$terminal_json")
[[ -n "$terminal_handle" ]] || { echo 'Orca did not return a terminal handle' >&2; exit 1; }

wait_for_codex() {
  local response
  response=$(orca terminal wait --terminal "$terminal_handle" --for tui-idle --timeout-ms "$1" --json) || true
  python3 -c 'import json,sys; d=json.load(sys.stdin); e=d.get("error",{}); assert d.get("ok") or e.get("code")=="timeout", e; r=d.get("result",{}); print(str(r.get("wait",r).get("satisfied",False)).lower())' <<<"$response"
}
is_ready=$(wait_for_codex 5000)
if [[ "$is_ready" != true ]]; then
  screen=$(orca terminal read --terminal "$terminal_handle" --json)
  is_ready=$(python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok"), d.get("error"); t=d["result"]["terminal"]; print(str(any("Ask Codex to do anything" in line for line in t.get("tail",[]))).lower())' <<<"$screen")
  if [[ "$is_ready" != true ]]; then
    is_ready=$(wait_for_codex 120000)
  fi
fi
[[ "$is_ready" == true ]] || { echo "Codex TUI did not become ready: $terminal_handle" >&2; exit 1; }

prompt="Read GitHub issue $repo_name#$issue and the repository instructions. Work through the following sequence in THIS SAME SESSION, without starting or delegating to another Codex session:

1. Write a structured plan at .design/issues/$issue/PLAN.md with scope, decisions/dependencies, files, test contract, validation, and visual evidence approach.
2. Recheck the plan against the issue and repository instructions. Invoke and follow \$ship-with-tests. Implement the complete issue, run proportional checks, inspect the complete diff, and run git diff --check. Include the plan file in the PR.
3. Commit and push the work. Invoke and follow \$pr to open the PR using its template. Include before/after evidence. For a UI change, capture real desktop and narrow-viewport screenshots and link committed evidence in the PR. Do not claim visual evidence from placeholders.
4. In this same session, invoke and follow \$babysit-pr to monitor and fix the PR until checks are stably green and delivered review feedback is handled. Never merge. Report the PR URL, final SHA, CI outcome, and any unresolved review item."
receipt=$(orca terminal send --terminal "$terminal_handle" --text "$prompt" --enter --wait-submit 10 --json)
accepted=$(python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok"), d.get("error"); r=d["result"]; print(str(r.get("send",{}).get("accepted",False)).lower())' <<<"$receipt")
[[ "$accepted" == true ]] || { echo "Orca did not accept the Codex prompt: $terminal_handle" >&2; exit 1; }
printf 'Codex interactive session started for issue #%s\nWorktree: %s\nTerminal: %s\n' "$issue" "$worktree_path" "$terminal_handle"
