# Lazuli Frontend — Build Plan (Bootstrap → Done)

**Status:** v1 — dependency-ordered plan for the `@lazuli/web` build.
**Companion:** [ARCHITECTURE.md](./ARCHITECTURE.md) (the constraints every issue below obeys).
**Ordering principle:** work is separated **by blockers, not by time**. No estimates. A task is startable the moment its `blocked by` list is empty. Everything backend it depends on is already **Done** in Linear (tRPC procedures, schema, workers) — the only new dependencies are other frontend tasks.

Each task below becomes one self-contained Linear issue (see the [issue template](#issue-template) — an issue is readable without opening the PRD). Prototype reference: `Lazuli ERP v4.dc.html`.

---

## Phase map (the blocker spine)

```
M0 Bootstrap ─┬─► M1 Design System ─┬─► M2 App Shell ─┬─► M3 Auth surfaces
              │                     │                 ├─► M4 Dashboard / Home
              │                     │                 ├─► M5 Students
              └─► (tRPC + auth      │                 ├─► M6 Classes & Calendar
                   wiring)          │                 ├─► M7 Attendance (the wedge)
                                    │                 └─► M8 Finance
                                    └────────────────────► (each feature pulls the
                                                            DS components it needs)
                          M9 Cross-cutting / Done ◄── all feature milestones
```

**Critical path to the wedge (attendance in a teacher's hand):**
`BOOT-1 → BOOT-2/BOOT-5 → DS-1 → BOOT-6 → SHELL-1 → ATT-1`.
Ship that spine first; every other feature branches off the same shell.

---

## M0 — Bootstrap _(blocks everything)_

| Code       | Task                                                                                                                                                                                                    | Blocked by |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **BOOT-1** | Tailwind + Lazuli **design tokens** preset in `@lazuli/ui` — port colors/typography/spacing/effects/motion from the prototype bundle into CSS vars + Tailwind preset; dark theme; wire into `apps/web`. | —          |
| **BOOT-2** | **shadcn/ui** baseline in `@lazuli/ui` — `components.json`, `cn()` util, Radix deps, generate base primitives against the token preset.                                                                 | BOOT-1     |
| **BOOT-3** | **Storybook 8** in `@lazuli/ui` — loads tokens + Tailwind; CI build target; story-coverage check scaffolding.                                                                                           | BOOT-1     |
| **BOOT-4** | **tRPC client + TanStack Query** provider + server/client boundary in `apps/web` (`lib/trpc.ts`) — the sole Compute entry point.                                                                        | —          |
| **BOOT-5** | **XState conventions** — install `xstate`/`@xstate/react`, `createResourceMachine` factory, feature-folder scaffold, and the **lint rules** (`max-lines: 200`, import boundaries) from ARCHITECTURE §6. | —          |
| **BOOT-6** | **Auth wiring** — Better Auth session provider, protected `(app)` layout, middleware redirect to login for anonymous users.                                                                             | BOOT-4     |

## M1 — Design system components _(Storybook-first, pure; each blocked by BOOT-1,2,3)_

Each task delivers a cluster of related primitives **with stories for every state**. These are the vocabulary every feature composes from.

| Code     | Task (components)                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DS-1** | **Core primitives** — Button (primary/secondary/danger/ghost), StatusPill (5 tones), Avatar, Badge, Icon set, Spinner + Skeleton.                                                            |
| **DS-2** | **Form controls** — TextField, EmailField, Select, Textarea, Checkbox, DateField, FieldError, Form layout; pt-BR validation patterns (zod messages).                                         |
| **DS-3** | **Data display** — DataTable/Grid (sortable header, clickable rows, row selection), FilterChips (with counts), SearchInput, Tabs/SegmentedControl, KpiStat/StatCard, EmptyState, AlertStrip. |
| **DS-4** | **Overlays** — Modal/Dialog, Drawer/SidePanel, Toast/Toaster, DropdownMenu/ContextMenu, CommandPalette (⌘K) shell.                                                                           |
| **DS-5** | **Domain visualizations** — AttendanceHeatmap, MonthProgressBar, AgingBars, PortalWeekDots, MonthCalendarGrid, WeeklyScheduleGrid, WhatsAppButton.                                           |

## M2 — App shell & navigation _(supersedes GRE-16)_

| Code        | Task                                                                                                                                                                                            | Blocked by         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **SHELL-1** | App layout + **role-filtered sidebar** (Home; _Pedagógico_ → Alunos, Turmas; _Financeiro_ → Analytics, Contratos, Parcelas) + top bar (date + ⌘K) + user footer/sign-out; Toaster mounted here. | BOOT-6, DS-1, DS-4 |
| **SHELL-2** | **Command palette** wiring — ⌘K opens palette → `students.search`, results route to profile/class.                                                                                              | DS-4, BOOT-4       |
| **SHELL-3** | **403 / unauthorized** page (pt-BR) + client route guards for forbidden roles.                                                                                                                  | BOOT-6             |

## M3 — Auth surfaces _(supersedes GRE-58; API GRE-15 done)_

| Code       | Task                                                                                                                                                        | Blocked by |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **AUTH-1** | **Login page** — Google SSO + magic-link form. Machine: `idle → submitting → sent → error`; unknown-email → "Acesso não autorizado. Fale com a secretaria." | SHELL-1    |
| **AUTH-2** | **Sign-out** action in header + session-expiry redirect.                                                                                                    | SHELL-1    |

## M4 — Dashboard & home _(supersedes GRE-52 + GRE-62; APIs GRE-64, GRE-63, GRE-41 done)_

| Code       | Task                                                                                                                                                                  | Blocked by          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **DASH-1** | **Admin dashboard** — KPI stat bar (alunos ativos, turmas ativas, aulas hoje, vencido em aberto), aulas de hoje + próximas, cobranças em atraso (top 3–5 + WhatsApp). | SHELL-1, DS-3, DS-5 |
| **DASH-2** | **Portal health card** + day detail — 7-day badges (✅/⚠️/❌/— closed) → per-class detail + "Reenviar".                                                               | SHELL-1, DS-5       |
| **DASH-3** | **Teacher home** — today's classes → deep-link into attendance; next session per class.                                                                               | SHELL-1, DS-3       |

## M5 — Students _(supersedes GRE-60; APIs GRE-20, GRE-21, GRE-23, GRE-30/31/32/35 done)_

| Code      | Task                                                                                                                                                                                                                                                                                                              | Blocked by                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **STU-1** | **Students roster** — table (Aluno · Turma code · Professor · Freq% · Financeiro · menor flag · WhatsApp), status filter chips, page search. Resource machine + filter region.                                                                                                                                    | SHELL-1, DS-3             |
| **STU-2** | **Student quick-view drawer** from a roster row.                                                                                                                                                                                                                                                                  | STU-1, DS-4               |
| **STU-3** | **Student profile page** — header (name, menor + responsável inline, summary strip, state-driven primary action), Geral (contact edit-in-place, guardian, cadastro collapse, anotações expandable), Frequência (summary + semester heatmap), Financeiro (contract detail + installment list). Tab + edit machine. | SHELL-1, DS-2, DS-3, DS-5 |
| **STU-4** | **New-student flow** — quick-create (nome + telefone + nascimento → profile with pendency chips) **and** 3-step wizard (dados → matrícula → pedido, skippable; guardian block slides in if minor). Wizard machine.                                                                                                | STU-3, DS-2, DS-4         |
| **STU-5** | **Enrollment action modals** (on profile & turma) — matricular, transferir, encerrar, avançar estágio, agendar reposição. One modal machine each.                                                                                                                                                                 | STU-3, CLS-3              |

## M6 — Classes & calendar _(APIs GRE-29, GRE-65, GRE-25, GRE-28, GRE-22 done)_

| Code      | Task                                                                                                                                                                                    | Blocked by          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **CLS-1** | **Classes list** — table ⇄ weekly-grid toggle; occupancy display; full code monospace (never truncate); status Ativa/Arquivada; **"chamada não confirmada" alert strip** + row warning. | SHELL-1, DS-3, DS-5 |
| **CLS-2** | **Calendar tab** — month grid showing sessions per day; click future day → "marcar sem aula / fechar dia" modal.                                                                        | SHELL-1, DS-5       |
| **CLS-3** | **Class detail page** — roster + visitors/makeups (below a divider), teacher, sessions list (past/future w/ chamada + portal status), dados; "clonar para próximo período" action.      | SHELL-1, DS-3       |
| **CLS-4** | **Session side panel** — chamada status + portal status + actions: cancel session (reason + optional makeup), reenviar Portal. Machine.                                                 | CLS-3, DS-4         |

## M7 — Attendance (the wedge) _(supersedes GRE-33; APIs GRE-61, GRE-34, GRE-35, GRE-37, GRE-38 done). Mobile-first._

| Code      | Task                                                                                                                                                                                                                                                                             | Blocked by    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **ATT-1** | **Mobile attendance screen** — roster rows (photo, name, 3-day streak dots, **P/F big tap targets**), pre-select PRESENT, "Confirmar chamada". Machine: `loading → marking → confirming → confirmed`; untaken-session flag; same-day teacher edit; admin edits any past session. | SHELL-1, DS-1 |
| **ATT-2** | **Makeup/visitor in roster** — "VISITANTE — turma origem: X" at top; mark showed/no-show at confirm (sets Makeup outcome, does not touch %).                                                                                                                                     | ATT-1         |

## M8 — Finance _(supersedes GRE-49; APIs GRE-42/43/44/45/46/47/63/59 done)_

| Code      | Task                                                                                                                                                                          | Blocked by          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **FIN-1** | **Finance — Analytics tab** — previsto / recebido / vencido cards, aging bars (1–7 / 8–30 / >30), month-progress bar.                                                         | SHELL-1, DS-3, DS-5 |
| **FIN-2** | **Finance — Contracts tab** — contracts list (pagador · beneficiários · N×valor · progresso · status Em dia/Quitado/em atraso) + search/filter.                               | SHELL-1, DS-3       |
| **FIN-3** | **Contract (order) detail page** — KPI cards + installment table (status/valor/vencimento) + projected-interest note (1%/mês, display-only).                                  | FIN-2, DS-3         |
| **FIN-4** | **Finance — Installments (Parcelas) tab** — grouped-overdue view + flat view with multi-select checkboxes; filter chips.                                                      | SHELL-1, DS-3       |
| **FIN-5** | **Register payment + allocation** — payer-scoped: list open installments across the payer's orders, divisible allocations, visible unallocated remainder. Allocation machine. | FIN-4, DS-4         |
| **FIN-6** | **Batch reconcile (Cora)** — multi-select installments → floating action bar (data · método · ref Cora) → one PaymentEntry per payer. Reconcile machine.                      | FIN-4, FIN-5        |
| **FIN-7** | **Waive (abonar) + adjustments** modals — reason required; reflected in derived balances.                                                                                     | FIN-3               |
| **FIN-8** | **Per-student statement (extrato)** — trigger + async artifact polling (enqueued/running/ready/download).                                                                     | STU-3, FIN-3        |

## M9 — Cross-cutting & Done

| Code       | Task                                                                                                                                       | Blocked by |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **DONE-1** | **State-coverage pass** — every resource machine handles loading/empty/error consistently; audit against ARCHITECTURE §7.                  | M4–M8      |
| **DONE-2** | **Responsive + a11y pass** — teacher mobile-first (attendance), admin desktop tables; touch targets ≥44px; keyboard/focus for tables + ⌘K. | M4–M8      |
| **DONE-3** | **e2e smoke + Storybook coverage gate** in CI — one Playwright happy-path per epic; fail build on missing stories.                         | M4–M8      |
| **DONE-4** | **Visual QA vs prototype** — parity sweep against `Lazuli ERP v4.dc.html`; motion/toast polish.                                            | M4–M8      |

---

## Supersede map (old → new)

The 7 coarse UI issues are replaced by the granular set above. Their **backend counterparts stay** (all Done).

| Old (to be removed)                       | Replaced by                 |
| ----------------------------------------- | --------------------------- |
| GRE-16 · Role-based app shell & menu      | SHELL-1, SHELL-2, SHELL-3   |
| GRE-58 · Auth sign-in surfaces            | AUTH-1, AUTH-2              |
| GRE-60 · Student profile + add/edit forms | STU-1 … STU-5               |
| GRE-33 · Mobile attendance screen         | ATT-1, ATT-2                |
| GRE-62 · Portal health card               | DASH-2                      |
| GRE-52 · Admin dashboard + teacher home   | DASH-1, DASH-3              |
| GRE-49 · Receivables dashboard            | FIN-1 … FIN-8               |
| _(new — no prior issue)_                  | BOOT-_, DS-_, CLS-_, DONE-_ |

GRE-57 (design-system triage) is **Done** — its output is [ARCHITECTURE.md](./ARCHITECTURE.md). GRE-67 (restyle PDFs) stays backend.

---

## Issue template

Every issue in the new frontend project uses this shape so it reads standalone — no jumping to the spec:

```md
## What you're building

<1–2 plain sentences. The outcome, not the mechanics.>

## Screen / route

<e.g. /alunos · prototype screen `students` · Lazuli ERP v4.dc.html>

## User story (<S-STU-2 · P0>)

<the story text, quoted inline — do not just link it>

## UI spec (from prototype)

- <concrete layout: columns, chips, actions, empty/alert states>

## State machine (Decide)

- states: <loading | ready{idle,filtering} | empty | error | ...>
- events: <SEARCH_CHANGED, ROW_CLICKED, CONFIRM_PRESSED, ...>
- transitions / guards: <...>

## Components (Render)

- reuse: <Button, DataTable, FilterChips, ...> new: <if any>

## Data / logic (Compute)

- tRPC: <exact procedures, e.g. students.search, students.byId>
- format: <BRL cents, SP timezone, wa.me>

## Acceptance criteria

- [ ] <behavioral, testable — includes loading/empty/error>

## Constraints

- [ ] components ≤200 lines · pure · Storybook stories · logic separated (ARCHITECTURE §1)

## Blocked by / Blocks

<issue refs>
```
