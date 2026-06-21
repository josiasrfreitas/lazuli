# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo (one school, monolith + BFF). It does not use the default `CONTEXT.md` / `docs/adr/` convention — the equivalent sources are listed below.

## Before exploring, read these

- **`docs/MVP/decisions.md`** — plays the ADR role. Read the decisions that touch the area you're about to work in. If your output contradicts one, surface it explicitly (see "Flag conflicts" below).
- **`docs/MVP/PRD.md`** — product scope, user stories, acceptance criteria. The source of product behavior.
- **`docs/README.md`** — reading order, TLDR, scope snapshot, open questions.
- **`docs/discovery/`** — questionnaire data, process maps, and discovery artifacts. The evidence behind decisions.

There is no `CONTEXT.md` glossary yet. If one is added later (e.g. by `/domain-modeling`), read it first for the project's ubiquitous language. Until then, draw domain vocabulary from `docs/MVP/PRD.md` and `docs/MVP/decisions.md`.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill creates a glossary lazily when terms actually get resolved.

## File structure

```
/
├── AGENTS.md
└── docs/
    ├── README.md          ← reading order, scope snapshot
    ├── MVP/
    │   ├── PRD.md         ← product behavior
    │   └── decisions.md   ← architecture/stack/workflow decisions (ADR role)
    ├── sprints/           ← local markdown sprint tracker
    └── discovery/         ← evidence: questionnaires, process maps
```

## Use the docs' vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/MVP/PRD.md` / `docs/MVP/decisions.md`. Don't drift to synonyms those docs explicitly avoid.

If the concept you need isn't in the docs yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag decision conflicts

If your output contradicts an existing decision in `docs/MVP/decisions.md`, surface it explicitly rather than silently overriding:

> _Contradicts the "Better Auth over NextAuth" decision — but worth reopening because…_
