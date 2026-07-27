# Lazuli Frontend — Issue Backlog (source for Linear `[P10] Web App — Frontend`)

This is the authoritative, self-contained backlog for the frontend build. Each issue reads standalone — you should never need to open the PRD to know what to build. It obeys [ARCHITECTURE.md](./ARCHITECTURE.md) and is sequenced by [BUILD-PLAN.md](./BUILD-PLAN.md).

Every backend dependency (tRPC procedures, schema, workers) is already **Done**. Procedure names below are the expected ones — verify exact names in `packages/api/src/root.ts` when implementing.

---

## Linear execution metadata

- **Team:** Green Leaf Labs (`GRE`, id `d1fa47d6-34c4-42ea-a4fb-dca8b2d8ae2f`)
- **Project:** `[P10] Web App — Frontend` · icon `Browser` · description = the "Project description" block below.
- **Milestones:** `M0 Bootstrap`, `M1 Design System`, `M2 App Shell`, `M3 Auth`, `M4 Dashboard`, `M5 Students`, `M6 Classes & Calendar`, `M7 Attendance`, `M8 Finance`, `M9 Cross-cutting`.
- **Labels:** every issue → `frontend`. Issues with **no open blockers** (BOOT-1, BOOT-4, BOOT-5) → also `ready-for-agent`. All others → also `blocked`.
- **Blocker wiring:** create all issues first, capture each code→`GRE-N` id, then add `blocked by` relations from the "Blocked by" lines.
- **Supersede:** cancel GRE-16, 33, 49, 52, 58, 60, 62 (set state **Canceled**, add a comment pointing to the replacements in the map below). Leave their backend counterparts untouched.

**Project description:**

> The Lazuli web app (`@lazuli/web`): pt-BR school-administration ERP for ADMIN + TEACHER. Built as state machines with a strict Render/Decide/Compute split (see `docs/frontend/ARCHITECTURE.md`). shadcn + Tailwind + Storybook, XState v5, tRPC. All backend APIs are Done; this project delivers every screen from bootstrap to done. Plan: `docs/frontend/BUILD-PLAN.md`. Prototype: `Lazuli ERP v4.dc.html`.

**Supersede map:** GRE-16→SHELL-1/2/3 · GRE-58→AUTH-1/2 · GRE-60→STU-1…5 · GRE-33→ATT-1/2 · GRE-62→DASH-2 · GRE-52→DASH-1/3 · GRE-49→FIN-1…8.

---

# M0 — Bootstrap

## BOOT-1 · Design tokens + Tailwind preset in `@lazuli/ui`

**Milestone:** M0 · **Labels:** frontend, ready-for-agent · **Blocked by:** —

**What you're building:** The visual foundation — Lazuli's design tokens as CSS variables and a shared Tailwind preset, consumed by `apps/web`. Nothing renders correctly until this exists.

**UI spec (from prototype `:root`):** Port these token groups from `Lazuli ERP v4.dc.html` / the `_ds` bundle:

- color primitives: `ink, slate, cloud, mist, azure, moss(+light), ruby(+light), gold`
- surfaces: `page, card, sunken, navy, navy-active, overlay`
- status pairs: `success/warning/danger/info` each with `-bg`
- borders: `default, strong, on-navy`; `focus-ring`; shadows `sm/md/lg`
- typography: display serif + tabular-nums sans for numeric data; `tracking-wide` for uppercase labels
- motion keyframes: `lz-in, lz-slide, lz-up, lz-drift, lz-spin, lz-pop`
- **Dark theme only** (`color-scheme: dark`).

**Components/logic:** `packages/ui/src/tokens/*.css`, `packages/ui/src/tailwind-preset.ts`; wire Tailwind into `apps/web` (globals import the preset + tokens).

**Acceptance criteria:**

- [ ] `@lazuli/ui` exports a Tailwind preset; `apps/web` renders with the dark token palette.
- [ ] A Storybook "Tokens" page (or MD) lists every color/space/type token.
- [ ] No raw hex/spacing in app code — only token classes.

**Constraints:** ARCHITECTURE §4. **Blocks:** BOOT-2, BOOT-3, all DS-\*.

## BOOT-2 · shadcn/ui baseline in `@lazuli/ui`

**Milestone:** M0 · **Labels:** frontend, blocked · **Blocked by:** BOOT-1

**What you're building:** Install and wire shadcn/ui inside `@lazuli/ui` so every primitive is generated against Lazuli tokens (not shadcn defaults).

**Spec:** `components.json` targeting `packages/ui`; `cn()` util; Radix deps; generate base primitives (button, input, dialog, dropdown, tabs, etc.) and re-theme them to the token preset. Document the "add a component" workflow in `packages/ui/README.md`.

**Acceptance criteria:**

- [ ] `pnpm dlx shadcn add <x>` lands themed components in `@lazuli/ui`.
- [ ] One primitive (Button) is themed to Lazuli tokens and shown in Storybook.
- [ ] Boundary lint passes (no app imports from ui internals).

**Constraints:** ARCHITECTURE §2, §4. **Blocks:** all DS-\*.

## BOOT-3 · Storybook 8 in `@lazuli/ui`

**Milestone:** M0 · **Labels:** frontend, blocked · **Blocked by:** BOOT-1

**What you're building:** The component workshop — Storybook 8 loading the token preset + Tailwind, with a CI build target and a story-coverage check.

**Acceptance criteria:**

- [ ] `pnpm -F @lazuli/ui storybook` runs; Tailwind + dark tokens applied.
- [ ] Storybook **build** wired as a CI target.
- [ ] A coverage check that flags exported components under `src/components` with no `*.stories.tsx`.

**Constraints:** ARCHITECTURE §6. **Blocks:** all DS-\*.

## BOOT-4 · tRPC client + TanStack Query in `apps/web`

**Milestone:** M0 · **Labels:** frontend, ready-for-agent · **Blocked by:** —

**What you're building:** The Compute boundary — the typed tRPC client + React Query provider that every machine's `logic.ts` calls through. This is the **only** file allowed to import the tRPC client.

**Spec:** `apps/web/src/lib/trpc.ts` (`@trpc/react-query` + TanStack Query), server/client component split for App Router, provider mounted in root layout, error/link config. Consume `@lazuli/api`'s `AppRouter` type.

**Acceptance criteria:**

- [ ] A trivial query (e.g. `dashboard.*` or a health procedure) resolves end-to-end in a page.
- [ ] React Query devtools available in dev.
- [ ] Boundary lint: only `lib/trpc.ts` imports the client.

**Constraints:** ARCHITECTURE §3. **Blocks:** BOOT-6, and all data pages.

## BOOT-5 · XState conventions + lint enforcement

**Milestone:** M0 · **Labels:** frontend, ready-for-agent · **Blocked by:** —

**What you're building:** The Decide-layer scaffolding — XState v5 installed, a shared `createResourceMachine` factory, the feature-folder convention, and the lint rules that enforce the whole architecture.

**Spec:**

- Install `xstate` + `@xstate/react`.
- `apps/web/src/lib/machine/createResourceMachine.ts` — T1 factory: `idle → loading → (loaded | empty) → error`, events `LOAD/REFETCH/RETRY`, generic over data + params.
- Feature-folder template (`features/_template/` with machine/logic/view-model/Page/components).
- ESLint: `max-lines: 200` on `apps/web/src/features/**/*.tsx` + `packages/ui/src/components/**/*.tsx`; import boundaries (components can't import `lib/trpc`/`@lazuli/api`/feature `logic.ts`; `machine.ts` can't import React) — extend `tooling/eslint`.

**Acceptance criteria:**

- [ ] `createResourceMachine` unit-tested headless (Vitest, no React).
- [ ] Lint fails on a >200-line component and on a boundary violation (prove with a fixture).

**Constraints:** ARCHITECTURE §1, §6. **Blocks:** all feature pages.

## BOOT-6 · Auth wiring (session provider + protected layout)

**Milestone:** M0 · **Labels:** frontend, blocked · **Blocked by:** BOOT-4

**What you're building:** Wire Better Auth into the web app so the `(app)` route group is protected and the session/role is available to the shell.

**User story (S-AUTH-2 · P0):** _As a teacher, I want to only see attendance + my classes so that I'm not overwhelmed by finance/admin screens._

**Spec:** Better Auth client + session provider; Next middleware redirecting anonymous users to `/login`; expose `useSession()` (user + role) for role-filtered nav; 30-day session. Backend is GRE-15/GRE-17 (Done) — **do not** duplicate auth logic, only consume session/role.

**Acceptance criteria:**

- [ ] Anonymous hitting `/alunos` → redirected to `/login`.
- [ ] Authenticated session exposes `{ user, role }` to client components.

**Constraints:** ARCHITECTURE §3. **Blocks:** SHELL-1, SHELL-3, AUTH-1.

---

# M1 — Design System components _(each Blocked by: BOOT-1, BOOT-2, BOOT-3; Labels: frontend, blocked)_

> Each DS issue is Storybook-first and pure (no data). Every listed component ships stories for its states (default/hover/disabled/loading/empty/selected + mobile viewport where relevant).

## DS-1 · Core primitives

**Components:** Button (primary/secondary/danger/ghost, sizes), StatusPill (success/warning/danger/info/neutral tones), Avatar, Badge, Icon set, Spinner, Skeleton.
**Acceptance:** each in Storybook with all variants; tokens only; ≤200 lines each; a11y focus states. **Blocks:** SHELL-1, AUTH-1, ATT-1.

## DS-2 · Form controls

**Components:** TextField, EmailField, Select, Textarea, Checkbox, DateField, FieldError, Form layout wrapper.
**Spec:** pt-BR validation messages via zod (reuse `@lazuli/validators`); controlled + uncontrolled; error/disabled states as stories.
**Acceptance:** all states in Storybook; ≤200 lines each. **Blocks:** STU-3, STU-4, AUTH-1.

## DS-3 · Data display

**Components:** DataTable/Grid (uppercase sortable header, hover, clickable rows, row selection/checkboxes), FilterChips (with counts), SearchInput, Tabs/SegmentedControl, KpiStat/StatCard, EmptyState, AlertStrip.
**Spec:** DataTable is presentational — receives rows + column defs + row-click callback; no fetching, no sorting logic beyond what's passed.
**Acceptance:** Storybook incl. empty + loading (skeleton rows) + selected states; ≤200 lines each. **Blocks:** DASH-1/3, STU-1, CLS-1/3, FIN-1/2/3/4.

## DS-4 · Overlays

**Components:** Modal/Dialog, Drawer/SidePanel (right), Toast/Toaster, DropdownMenu/ContextMenu (⋯), CommandPalette (⌘K) shell.
**Spec:** overlay + blur backdrop, `shadow-lg`, focus-trap + Esc; CommandPalette is a shell (results injected by caller).
**Acceptance:** Storybook incl. open/close, keyboard nav; ≤200 lines each. **Blocks:** SHELL-1/2, STU-2/4/5, CLS-4, FIN-5/7.

## DS-5 · Domain visualizations

**Components:** AttendanceHeatmap (per-session present/absent/future cells), MonthProgressBar (with "today" marker), AgingBars (1–7 / 8–30 / >30), PortalWeekDots (7-day ✅/⚠️/❌/—), MonthCalendarGrid, WeeklyScheduleGrid (seg–sáb time cards), WhatsAppButton (`wa.me/55…` deep link).
**Acceptance:** Storybook with representative data; ≤200 lines each. **Blocks:** DASH-1/2, STU-3, CLS-1/2, FIN-1.

---

# M2 — App Shell

## SHELL-1 · App layout + role-filtered sidebar + top bar

**Milestone:** M2 · **Labels:** frontend, blocked · **Blocked by:** BOOT-6, DS-1, DS-4

**What you're building:** The persistent app frame every screen renders inside: sidebar nav (role-filtered), top bar, user footer/sign-out, mounted Toaster.

**User story (S-AUTH-2 · P0):** sidebar items filtered by role (TEACHER sees attendance + classes only; ADMIN sees all).

**UI spec (prototype):** fixed 230px `surface-navy` sidebar; logo "lazuli / Administração Escolar"; nav sections — **(top)** Home; **Pedagógico** → Alunos, Turmas e calendário; **Financeiro** → Analytics, Contratos, Parcelas (the 3 finance items route to Finance with a preselected tab). Top bar 56px: date · spacer · ⌘K search button. Footer: user name + "Administrador" + logout.

**State machine:** light — nav is derived from `useSession().role`; active-route highlight from the router. Toaster provider mounted here.

**Components:** sidebar/nav (new, ≤200), TopBar (new), reuse Button/Avatar/DropdownMenu/Toaster.

**Data/logic:** `useSession()` (role) from BOOT-6. No fetching.

**Acceptance:**

- [ ] TEACHER role hides Financeiro + admin items; ADMIN sees all.
- [ ] Active route highlighted; sign-out works; Toaster reachable app-wide.

**Constraints:** ARCHITECTURE §1. **Blocks:** everything in M3–M8. **Supersedes:** part of GRE-16.

## SHELL-2 · Command palette (⌘K) wiring

**Milestone:** M2 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-4

**What you're building:** Global ⌘K search that finds a student/class fast and routes to it.

**User story (S-STU-2 · P0):** _find any student in under 2 keystrokes per match._ Searches name, phone, email, current class code; results show name, current class, status badge, phone.

**State machine:** `closed → open{ idle → searching → results | empty }`; debounce; ↑/↓/↵ selection.

**Data/logic:** `tRPC students.search` (GRE-21) in `logic.ts`, invoked by the machine.

**Acceptance:** ⌘K opens; typing yields results; ↵ routes to profile/class; empty state shown. **Blocks:** —. **Supersedes:** part of GRE-16.

## SHELL-3 · 403 / unauthorized page + route guards

**Milestone:** M2 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, BOOT-6

**What you're building:** pt-BR 403 page and client guards so a forbidden role hitting a route sees a clean refusal, not a broken screen.

**User story (S-AUTH-2 · P0):** direct URL to a forbidden route → 403 in Portuguese.

**Acceptance:** TEACHER navigating to `/financeiro` → pt-BR 403; guard reads role from session; unknown-staff message handled. **Supersedes:** part of GRE-16.

---

# M3 — Auth surfaces

## AUTH-1 · Login page (Google SSO + magic link)

**Milestone:** M3 · **Labels:** frontend, blocked · **Blocked by:** BOOT-6, DS-1, DS-2

**What you're building:** The pre-auth login screen. Standalone (no app shell).

**User story (S-AUTH-1 · P0):** _sign in with school Google account._ Google OAuth (pre-provisioned emails only); magic-link via Resend as fallback; unknown email → "Acesso não autorizado. Fale com a secretaria."; 30-day session.

**UI spec (prototype `login`):** "Bem-vindo de volta." · Google button · email field + "Enviar link". Sent state: success card + "Usar outro e-mail".

**State machine:** `idle → submitting → sent | error(invalidEmail | unauthorized)`; resend from `sent`.

**Components:** reuse Button, EmailField, Card. **Data/logic:** Better Auth client (Google + magic link) via `logic.ts`.

**Acceptance:**

- [ ] Google flow starts; magic-link shows "Enviando link…" → sent card.
- [ ] Invalid email → inline error; unauthorized → the pt-BR message.

**Supersedes:** part of GRE-58.

## AUTH-2 · Sign-out + session-expiry redirect

**Milestone:** M3 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1

**What you're building:** Header sign-out action and a redirect to `/login` when the session expires.
**Acceptance:** sign-out clears session → `/login`; expired session mid-use → redirect. **Supersedes:** part of GRE-58.

---

# M4 — Dashboard & Home

## DASH-1 · Admin dashboard

**Milestone:** M4 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-3, DS-5

**What you're building:** The ADMIN landing page — a calm briefing of "how is the school doing?" and "what's happening today?".

**User story (S-DASH-1 · P0):** single landing page; a week at a glance.

**UI spec (prototype `dash` + grill decisions):**

- KPI stat bar (operational, one finance number max): **Alunos ativos · Turmas ativas · Aulas hoje · Vencido em aberto**.
- **Aulas de hoje** + **Próximas aulas** cards.
- **Cobranças em atraso** — top 3–5 payers with WhatsApp quick-action.
- Portal health card is DASH-2 (compose it here).
- _Not here:_ untaken-attendance alerts (those live on Turmas, CLS-1).

**State machine:** T1 resource machine (loading/loaded/empty/error) per data region.

**Data/logic:** `tRPC dashboard.adminMetrics` (GRE-64), `finance.overdueList` (GRE-63). Format BRL + SP dates.

**Acceptance:** cards populate from real queries; loading skeletons; overdue WhatsApp deep-links open the payer chat. **Supersedes:** part of GRE-52.

## DASH-2 · Portal health card + day detail

**Milestone:** M4 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-5

**What you're building:** The card that makes the admin trust the nightly Portal automation.

**User story (S-Portal-4 · P0):** last-7-days per-day badge (✅ submitted / ⚠️ partial / ❌ failed / — closed) + last-run status line; click a day → per-class detail.

**State machine:** resource machine + `detailOpen` region; resend action → `resending → done | failed`.

**Data/logic:** `tRPC portal.health` (GRE-41); resend via `portal.resend` (GRE-40, backend backlog — guard if unavailable).

**Acceptance:** 7 day-badges render from `portal.health`; day click opens per-class detail; "Reenviar" enqueues + shows status. **Supersedes:** GRE-62.

## DASH-3 · Teacher home

**Milestone:** M4 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-3

**What you're building:** The TEACHER landing page — today's classes, each linking straight to attendance.

**User story (S-DASH-3 · P0):** today's classes (linked to attendance) + next session date per class.

**Data/logic:** `tRPC dashboard.teacherHome` (GRE-64).

**Acceptance:** teacher sees only their classes today; tap → ATT-1 for that session; empty state when no class today. **Supersedes:** part of GRE-52.

---

# M5 — Students

## STU-1 · Students roster

**Milestone:** M5 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-3

**What you're building:** The `/alunos` table — lookup + triage in one.

**User story (S-STU-2 · P0)** (list view of search results).

**UI spec (grill-locked columns):** **Aluno · Turma (code) · Professor · Frequência % · Financeiro (badge Em dia / valor em atraso) · menor flag · WhatsApp action.** Status → **filter chip** (Todos/Ativos/Trancados/Desistentes with counts), not a column. Freq% turns red < 70%. Page search box (kept alongside global ⌘K). Row click → drawer (STU-2).

**State machine:** T1 resource machine + `filter` region (status chip + text query drive a re-query/derived filter).

**Components:** reuse DataTable, FilterChips, SearchInput, StatusPill, WhatsAppButton.

**Data/logic:** `tRPC students.search`/`students.list` (GRE-21); freq% + financeiro come from the aggregate.

**Acceptance:** columns exactly as locked; chips filter with counts; <70% freq red; WhatsApp deep-link; empty + loading states. **Supersedes:** part of GRE-60.

## STU-2 · Student quick-view drawer

**Milestone:** M5 · **Labels:** frontend, blocked · **Blocked by:** STU-1, DS-4

**What you're building:** A right-side drawer for a fast glance at a student without leaving the roster (deep edit still goes to the profile page).

**Grill decision:** "Drawer for quick view, page for deep edit."

**Data/logic:** `tRPC students.byId` (GRE-20) — a light projection.

**Acceptance:** row click opens drawer with summary (turma, freq, financeiro, contato, primary action); "Abrir perfil" → STU-3. **Supersedes:** part of GRE-60.

## STU-3 · Student profile page

**Milestone:** M5 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-2, DS-3, DS-5

**What you're building:** The one page with everything about a student, so staff don't switch screens during a phone call.

**User story (S-STU-3 · P0):** contact (incl. document, address, **Responsável/Guardian**), current/past classes, attendance summary (semester), open order + installment status, payment history, notes, `wa.me` link; edit-in-place for contact + notes.

**UI spec (grill decisions):**

- **Header:** one-line name; menor-de-idade indicator with responsável name inline; summary strip (freq% · financeiro · turma); state-driven **primary action** — em atraso → "Cobrar via WhatsApp" (gold); em dia → "WhatsApp"; reposição/editar in a ⋯ menu.
- **Tabs (2–3 max, dense — no empty tabs):** **Geral** (default; contact edit-in-place, guardian block, "Cadastro completo" collapse for CPF/endereço/nascimento, **Anotações** expandable with "!" highlight when a note exists), **Frequência** (summary + semester heatmap — show WHICH classes were missed), **Financeiro** (ALL contract details visually: installments with status/value; "Ver contrato" → order detail).

**State machine (T2):** `loading → ready` with parallel regions: `tab (geral|frequencia|financeiro)`, `contactEdit (read ↔ editing → saving)`, `notes (collapsed ↔ expanded ↔ editing)`.

**Components:** reuse DataTable, AttendanceHeatmap, StatusPill, TextField/Textarea (edit-in-place), Card. **Data/logic:** `tRPC students.byId` aggregate (GRE-20), `students.updateContact`, `students.updateNotes`.

**Acceptance:** header + 3 dense tabs render; contact/notes edit-in-place save; heatmap marks missed sessions; installments listed with derived status; state-driven primary action. **Supersedes:** part of GRE-60.

## STU-4 · New-student flow (quick-create + wizard)

**Milestone:** M5 · **Labels:** frontend, blocked · **Blocked by:** STU-3, DS-2, DS-4

**What you're building:** Two ways to add a student, per the grill: fast quick-create, and a guided 3-step wizard.

**User story (S-STU-4 · P0):** required `fullName`+`status`; optional phone/email/birthDate/document/address; **minor → Guardian required** (structured: fullName + relationship + phone/email; may reuse address).

**UI spec:**

- **Quick-create:** nome + telefone + nascimento → lands on profile with pendency chips ("matricular" / "criar pedido").
- **3-step wizard:** Step 1 dados (birthDate typed → responsável fields **slide in** if minor) → Step 2 matrícula (skippable) → Step 3 pedido (skippable; payer default: adult→self, minor→responsável, swappable). Non-blocking: profile shows "sem pedido ativo" chip until resolved.

**State machine (T2 wizard):** `mode (quick | wizard)`; wizard `step1 → step2 → step3` with `skip` transitions + `minor` guard toggling the guardian sub-form; exit points: "Criar aluno", "Pular e criar", "Criar aluno e contrato".

**Data/logic:** `tRPC students.create` (GRE-20); enrollment + order creation reuse STU-5 / FIN flows (`enrollment.enroll` GRE-30, `finance.createOrder` GRE-43).

**Acceptance:** quick-create lands on profile with pendency chips; wizard steps skippable; guardian block appears iff minor; payer defaults correct. **Supersedes:** part of GRE-60.

## STU-5 · Enrollment action modals

**Milestone:** M5 · **Labels:** frontend, blocked · **Blocked by:** STU-3, CLS-3, DS-4

**What you're building:** The matrícula lifecycle actions, as modals reachable from the profile and the turma screen.

**User stories:** S-ENR-1 (enroll, capacity override + reason), S-ENR-2 (transfer), S-ENR-3 (drop/pause), S-ENR-4 (advance stage — "fim da trilha" when none), S-ATT-3 (schedule makeup, target class + date ≥ today+1).

**State machine:** one small modal machine each: `idle → open → submitting → done | error`; enroll has a `capacity` guard → warn+override-with-reason.

**Data/logic:** `tRPC enrollment.enroll` (GRE-30), `enrollment.transfer`/`drop` (GRE-32), `enrollment.advanceStage` (GRE-31), `enrollment.scheduleMakeup` (GRE-35).

**Acceptance:** each action opens a modal, validates, calls the procedure, toasts result; advance disabled at end-of-track; makeup enforces date ≥ today+1. **Supersedes:** part of GRE-60.

---

# M6 — Classes & Calendar

## CLS-1 · Classes list (table ⇄ weekly grid)

**Milestone:** M6 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-3, DS-5

**What you're building:** The `/turmas` list with a table/weekly-grid toggle and the loud "chamada não confirmada" alert.

**User story (S-CLS-1 · P0)** (class catalog view).

**UI spec (grill decisions):** toggle **table ⇄ grade semanal**; occupancy as text+bar (Lotada is part of ocupação, not a status); **status = Ativa/Arquivada** only; **full code always visible, monospace, second line — never truncate**; professor as plain text (no teacher pages in MVP). **Alert strip above the table:** "N chamadas não confirmadas ontem" + warning icon on the row (this is the ONLY place untaken attendance surfaces).

**State machine:** T1 resource machine + `view (table | grid)` region.

**Components:** reuse DataTable, WeeklyScheduleGrid, AlertStrip, StatusPill. **Data/logic:** `tRPC classes.list` (GRE-29); untaken-session count from attendance facts (GRE-34/61).

**Acceptance:** toggle works; code monospace/untruncated; Ativa/Arquivada filter; alert strip + row warning when unconfirmed chamadas exist. **Supersedes:** new (no prior UI issue).

## CLS-2 · Calendar tab (month view + close day)

**Milestone:** M6 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-5

**What you're building:** A month calendar that shows sessions per day and lets an admin close a day.

**User story (S-CAL-1 · P0):** month view; click a day → mark closed with reason (feriado/recesso/evento); bulk import federal holidays. **Grill:** calendar must also SHOW aulas/sessões per day, not only closed days.

**State machine:** month navigation + `closeDay` modal machine (`idle → open → submitting → done`).

**Data/logic:** `tRPC calendar.closedDays` + `calendar.markClosed` + `calendar.importHolidays` (GRE-28); sessions per day from class sessions (GRE-65).

**Acceptance:** month grid shows sessions + closed days; future-day click → close modal with reason; holiday bulk-import action. **Supersedes:** new.

## CLS-3 · Class detail page

**Milestone:** M6 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-3

**What you're building:** The turma deep-ops page: who's in it, its sessions, and period actions.

**User story (S-CLS-1 / S-ENR-\* · P0).**

**UI spec (grill decision — in order):** the **students** (roster) · the **teacher** · the **classes done and to be done** (sessions, visually, past/future with chamada + portal status) · **makeups/visitantes** (below a divider, apart from main roster) · **general data**. Action: **"clonar para próximo período"** (stage-advancement for REGULAR — defaults next stage, editable). Matrícula actions (transfer/end/advance) launch STU-5 modals from here.

**State machine:** T1 resource machine; session-row click → opens CLS-4 side panel.

**Data/logic:** `tRPC classes.byId` (GRE-29), `classes.clone` (GRE-29), roster/sessions aggregate.

**Acceptance:** roster + divider'd visitors + session timeline render; clone action creates successor + carries students; session click opens side panel. **Supersedes:** new. **Blocks:** STU-5, CLS-4.

## CLS-4 · Session side panel (chamada + portal + actions)

**Milestone:** M6 · **Labels:** frontend, blocked · **Blocked by:** CLS-3, DS-4

**What you're building:** The per-session side panel with attendance status, Portal status, and session actions.

**User story (S-CAL-2 · P0):** cancel a session (reason required) + optional makeup; **S-Portal-3:** reenviar Portal.

**State machine:** `viewing → { cancel: idle→confirming→done, resend: idle→enqueued→running→success|failed }`.

**Data/logic:** `tRPC classes.cancelSession` (GRE-25), `portal.resend` (GRE-40, backend backlog — guard), `attendance.sessionRoster` (GRE-61) for chamada status.

**Acceptance:** panel shows chamada + portal status; cancel requires reason, strikes through session (never deletes); reenviar polls status. **Supersedes:** new.

---

# M7 — Attendance (the wedge)

## ATT-1 · Mobile attendance screen

**Milestone:** M7 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-1

**What you're building:** THE wedge — the mobile-first screen a teacher uses to take chamada during/after class. This is the product's core loop; build it beautifully and fast.

**User story (S-ATT-1 · P0):** tap each student's status fast.

**UI spec:** mobile-first row = photo (if any) + name + 3-day attendance streak dots + **PRESENT/ABSENT** big tap targets (≥44px). **Pre-select PRESENT** so the teacher only taps absentees. Nothing persists until **"Confirmar chamada"**. All-present = just tap Confirm.

**State machine (T2):** `loading → marking (dirty toggles held in context) → confirming → confirmed | error`; guards for edit windows — **teacher** may edit only when `session.date == today` (America/Sao_Paulo); **ADMIN** may edit any past session (S-ATT-4/5). Untaken-session flag surfaces if end-time passed with no confirm.

**Components:** attendance row (new, ≤200), reuse Button; big tap targets. **Data/logic:** `tRPC attendance.sessionRoster` + `attendance.confirmSession` (GRE-61); admin/past edits (GRE-37), teacher same-day (GRE-38).

**Acceptance:** pre-selected present; tapping marks absent; Confirmar commits once (untouched→PRESENT, toggled→ABSENT, stamps `attendanceConfirmedAt`); teacher locked after midnight, admin not; untaken flag shown. **Supersedes:** GRE-33.

## ATT-2 · Makeups / visitors in roster

**Milestone:** M7 · **Labels:** frontend, blocked · **Blocked by:** ATT-1

**What you're building:** Show makeup/visiting students in the roster and capture their outcome — without touching attendance %.

**User story (S-ATT-2 · P0):** visitors render at top with "VISITANTE — turma origem: X"; at confirm, mark showed → sets Makeup outcome (ATTENDED/NO_SHOW). Makeup does **not** affect % (origin or target).

**Data/logic:** `tRPC attendance.sessionRoster` (visitor rows), `enrollment.scheduleMakeup` outcome (GRE-35).

**Acceptance:** visitors at top with tag; showed/no-show captured at confirm; % unaffected. **Supersedes:** part of GRE-33.

---

# M8 — Finance

## FIN-1 · Finance — Analytics tab

**Milestone:** M8 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-3, DS-5

**What you're building:** The receivables analytics view (routed from the "Analytics" sidebar item).

**User story (S-FIN-6 / S-DASH-2 · P0):** overview of open + overdue.

**UI spec:** cards **Previsto · Recebido · Vencido** (this month); **AgingBars** (1–7 / 8–30 / >30 dias); **MonthProgressBar** with today marker. Note (grill): mid-month "68% do previsto" is a neutral fact — don't paint it success-green.

**Data/logic:** `tRPC finance.receivablesSnapshot` (GRE-63). BRL from cents.

**Acceptance:** three cards + aging + month progress from real snapshot; neutral (not green) mid-month coloring. **Supersedes:** part of GRE-49.

## FIN-2 · Finance — Contracts tab

**Milestone:** M8 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-3

**What you're building:** The Pedidos/Contratos list (the workspace the current design lacks).

**User story (S-FIN-1 · P0)** (orders list).

**UI spec:** table **Pagador · Beneficiários · N×valor · Progresso · Status** (Em dia / Quitado / "R$X em atraso"); search + status select; "Novo contrato" entry point; row → contract detail.

**Data/logic:** `tRPC finance.orders.list` (GRE-42/43). Keyed by **Pagador** (payer is the spine).

**Acceptance:** contracts listed by payer with beneficiaries + progress + derived status; search/filter; Novo contrato opens creation. **Supersedes:** part of GRE-49.

## FIN-3 · Contract (order) detail page

**Milestone:** M8 · **Labels:** frontend, blocked · **Blocked by:** FIN-2, DS-3

**What you're building:** One contract, fully: KPIs + installment ledger + interest projection.

**User story (S-FIN-2 · P0):** each installment's status.

**UI spec:** KPI cards + full **parcela table** (status pill Upcoming/DueThisMonth/Overdue/Paid/Waived · valor · vencimento · remaining); projected-interest note (1%/mês, display-only). Beneficiary link → profile.

**Data/logic:** `tRPC finance.orders.byId` with **derived** status/balances/interest (GRE-45) — do NOT re-derive client-side.

**Acceptance:** installments show derived status + remaining; interest is a display-only projection; links resolve. **Supersedes:** part of GRE-49. **Blocks:** FIN-7, FIN-8.

## FIN-4 · Finance — Installments (Parcelas) tab

**Milestone:** M8 · **Labels:** frontend, blocked · **Blocked by:** SHELL-1, DS-3

**What you're building:** The parcelas workspace: a grouped-overdue view and a flat multi-select view (the entry point for reconcile).

**UI spec:** grouped "vencidas" view + flat view with **checkboxes**; filter chips; selecting rows reveals the reconcile bar (FIN-6).

**State machine:** T1 resource machine + `selection` region (multi-select → count + total).

**Data/logic:** `tRPC finance.overdueList` / installments query (GRE-63/45).

**Acceptance:** both views; multi-select shows count+total and arms FIN-6. **Supersedes:** part of GRE-49. **Blocks:** FIN-5, FIN-6.

## FIN-5 · Register payment + allocation

**Milestone:** M8 · **Labels:** frontend, blocked · **Blocked by:** FIN-4, DS-4

**What you're building:** The payer-scoped payment entry + divisible allocation flow (fixing the prototype's auto-to-one-parcela shortcut).

**User story (S-FIN-3 · P0):** a PaymentEntry belongs to a **Payer**; allocate across open installments (divisible, may span the payer's orders); unallocated remainder stays visible.

**State machine (T2):** `enterPayment (payer, amount, method, date) → allocate (list open installments, oldest pre-filled, editable) → review (Σ ≤ amount; remainder shown) → submitting → done`.

**Data/logic:** `tRPC finance.registerPayment` + allocations (GRE-44). Invariants enforced server-side; mirror them in the UI (Σ allocations ≤ entry; ≤ currentExpected per installment).

**Acceptance:** entry starts from payer; open installments across payer's orders listed; divisible/partial allocations; visible unallocated remainder. **Supersedes:** part of GRE-49.

## FIN-6 · Batch reconcile (Cora)

**Milestone:** M8 · **Labels:** frontend, blocked · **Blocked by:** FIN-4, FIN-5

**What you're building:** The specced daily workflow: check Cora → multi-select paids → one PaymentEntry per payer.

**User story (S-FIN-3 · P0, batch reconcile):** multi-select installments → group by payer → one PaymentEntry per payer + one full allocation per installment (default remaining), with settlement date + method + optional `externalReference` (Cora id).

**UI spec:** floating action bar on selection (data · método · ref Cora · Conciliar/Limpar).

**State machine (T2):** `armed(selection) → conciliar (grouping by payer) → submitting → done | error`.

**Data/logic:** `tRPC finance.batchReconcile` (GRE-46).

**Acceptance:** multi-select arms the bar; Conciliar creates one entry per payer with allocations; date/method/ref captured. **Supersedes:** part of GRE-49.

## FIN-7 · Waive (abonar) + adjustments

**Milestone:** M8 · **Labels:** frontend, blocked · **Blocked by:** FIN-3, DS-4

**What you're building:** Installment ⋯ actions: abonar (waive remaining) + discount/correction adjustments — reason required.

**User stories:** S-FIN-5 (waive; sets `waivedAt`+reason; forgives only remaining), S-FIN-8 (post-generation DISCOUNT adjustment).

**Data/logic:** `tRPC finance.waive` / `finance.adjust` (GRE-47).

**Acceptance:** ⋯ on installment → abonar/desconto/correção with mandatory reason + confirm; derived balances update. **Supersedes:** part of GRE-49.

## FIN-8 · Per-student statement (extrato)

**Milestone:** M8 · **Labels:** frontend, blocked · **Blocked by:** STU-3, FIN-3

**What you're building:** Generate and download a student's full charge+payment statement (async artifact).

**User story (S-FIN-7 · P0):** async `report-generate` → PDF in GCS; includes all orders/installments/payments+allocations.

**State machine:** `idle → requested → polling(running) → ready(download) | failed`.

**Data/logic:** `tRPC reports.statement` (GRE-59/53); poll artifact status.

**Acceptance:** trigger from profile Financeiro / contract; polls; download when ready; failure surfaced. **Supersedes:** part of GRE-49.

---

# M9 — Cross-cutting & Done

## DONE-1 · State-coverage pass

**Milestone:** M9 · **Labels:** frontend, blocked · **Blocked by:** DASH-1, STU-4, CLS-4, ATT-2, FIN-6
Audit every resource machine for consistent loading/empty/error per ARCHITECTURE §7; fix gaps. **Acceptance:** no screen with an unhandled empty/error; checklist attached.

## DONE-2 · Responsive + a11y pass

**Milestone:** M9 · **Labels:** frontend, blocked · **Blocked by:** DASH-1, STU-4, CLS-4, ATT-2, FIN-6
Teacher mobile-first (attendance) + admin desktop tables; touch targets ≥44px; keyboard/focus for tables + ⌘K. **Acceptance:** attendance usable one-handed on a phone; tables keyboard-navigable; a11y addon clean.

## DONE-3 · e2e smoke + Storybook coverage gate

**Milestone:** M9 · **Labels:** frontend, blocked · **Blocked by:** DASH-1, STU-4, CLS-4, ATT-2, FIN-6
One Playwright happy-path per epic (harness stubbed at `apps/web` `test:e2e`); CI fails on missing stories. **Acceptance:** e2e green in CI; coverage gate active.

## DONE-4 · Visual QA vs prototype

**Milestone:** M9 · **Labels:** frontend, blocked · **Blocked by:** DASH-1, STU-4, CLS-4, ATT-2, FIN-6
Parity sweep vs `Lazuli ERP v4.dc.html`; motion/toast polish. **Acceptance:** each screen matches the prototype's layout/tokens; discrepancies logged or fixed.
