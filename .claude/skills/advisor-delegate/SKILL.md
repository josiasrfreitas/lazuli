---
name: advisor-delegate
description: Delegate a Linear issue (or well-scoped task) to a background Opus subagent that plans and implements it, while you act as its advisor — answering design questions at checkpoints and relaying human-validation gates to the user. Use when the user says "delegate", "advisor workflow", or asks you to hand an issue to a subagent and supervise it.
---

# Advisor-Delegate Workflow

You are the **advisor/orchestrator**, not the implementer. The subagent does the work; you gather the kickoff context, make design rulings at its checkpoints, and bring the human in only for things only they can validate (inbox checks, external accounts, product judgment).

## Phase 1 — Minimal kickoff context (you, inline)

Gather just enough to write a good kickoff — do NOT build a full spec:

1. The issue: try to read it (Linear MCP/URL). If unreachable, infer scope from repo evidence (`docs/MVP/decisions.md` D-XXXX entries, `docs/MVP/TECHNICAL_SPEC.md`) and say so explicitly in the kickoff so the subagent knows scope is inferred.
2. Existing touchpoints: grep for prior art — interfaces already defined, private duplicates of the capability, stubs tagged with other issue IDs (those are OUT of scope; name them).
3. Environment: what's already in `.env.example` / `docker-compose.yml` / package catalogs that the task needs.

Time-box this to a handful of reads/greps. Details the subagent can cheaply verify itself don't belong in the kickoff.

## Phase 2 — Spawn the implementer

Spawn with the Agent tool: `subagent_type: "general-purpose"`, `model: "opus"`, `run_in_background: true`. Save the returned agentId — all follow-ups go through `SendMessage` to it (a fresh Agent call would lose its context).

The kickoff prompt must contain, in this order:

1. **Advisor protocol** — verbatim intent: "Every time you hit a design decision, ambiguity, or problem you can't resolve from repo evidence, STOP and end your turn with the decision, the options, and your recommendation. Do not silently pick a direction on contested points. Also stop at each named validation checkpoint." Require it to present a short plan + design questions BEFORE large-scale implementation.
2. **Context you gathered** — decisions/spec citations, existing code touchpoints, out-of-scope stubs by issue ID, env conventions. Mark anything inferred (e.g. unreadable issue body) as inferred.
3. **Likely shape** — your best guess at the design, framed as "validate, don't assume blindly", with contested points explicitly flagged as "ping me before committing".
4. **Human-validation checkpoints** — anything requiring real-world side effects (sending a real email, hitting a paid API, deploying) is a named mandatory checkpoint: do the minimal probe (one attempt + at most one documented fallback), then STOP and report so the human can confirm. Never let the subagent self-certify these.
5. **Workflow requirements** — feature branch off main (never commit to main), repo conventions, pre-commit hooks must pass, and the testing policy: paste `docs/agents/testing.md`'s tier rules (or the doc verbatim) and require the Linear test block in the final report.

## Phase 3 — Advisory loop

Each task-notification from the subagent is a checkpoint. For each one:

- **Design questions**: rule on them yourself when repo evidence decides it. Approve with guardrails — name concrete edge cases you can see (e.g. "empty-string env var must count as absent; add a unit test for it"). Prefer "approved, minimally, with constraints X/Y" over open-ended approval.
- **Human-only validations**: use `AskUserQuestion` to ask the user (e.g. "did the test email arrive?"), then relay the answer via `SendMessage` with the next-step instructions (wrap-up list: re-run the relevant test tier, delete scratch probe scripts, produce the Linear test block, list residual risks).
- After every exchange, summarize to the user what was asked and what you ruled — they can't see the subagent's messages.

## Phase 4 — Close-out

Relay the subagent's final summary: branch + commits (note if unpushed), what was built, validation evidence, the Linear test block, and residual risks/follow-ups (call out any external config still pending, e.g. DNS/domain verification). Offer — don't perform unasked — push/PR.

## Guardrails

- One subagent per issue; continue it via SendMessage, never respawn.
- If the subagent goes quiet past a reasonable wait, message it for status rather than duplicating its work — never edit files it owns.
- If it asks something you'd only be guessing at, escalate to the human instead of guessing; you're the advisor, not the oracle.
- Real-world side effects (emails, external APIs) are single-probe + human confirmation, always.
