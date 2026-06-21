# Lazuli — Phase 2 user stories

Full specifications for modules **deferred from the MVP**. These are retained for design continuity but are **not built in week 1**. The MVP scope lives in [PRD.md](./PRD.md); the deferral decisions live in [decisions.md](./decisions.md).

Companion: [Docs index](../README.md) · [PRD](./PRD.md) · [Decisions](./decisions.md) · [Changelog](./CHANGELOG.md)

---

## Expenses & vendor contracts

> **DEFERRED TO PHASE 2 ([D-0020](./decisions.md#d-0020-defer-expenses)).** Expense tracking — and therefore the cash-position card and any true P&L view — is out of MVP. The owner's expense-control concern is acknowledged and pre-committed as a Phase 2 headline.

### S-EXP-1 · Submit an expense `Phase 2`
**As a** finance staff member, **I want** to record an expense **so that** the school has a P&L view, not just receivables.

- Fields: `date`, `category` (rent / salaries / utilities / supplies / marketing / other), `amountCents`, `vendor`, `note`, optional `receiptUrl` (GCS upload).
- Recurring expense template: monthly auto-create with editable amount.

### S-EXP-2 · Expense list & filter `Phase 2`
**As an** admin, **I want** to filter expenses by category and month **so that** I see where money goes.

- Table with month picker + category multi-select.
- Sum row at the bottom.

### S-EXP-3 · Cash position card `Phase 2`
**As an** admin, **I want** to see this month's "received minus paid" **so that** I have a one-glance financial pulse.

- Card on management dashboard: received YTD/this month minus expenses YTD/this month.
- Not a true P&L (no accrual, no depreciation). Cash basis only.

### S-EXP-4 · Vendor contracts `P2`
*Deferred unless prioritized. Vendor/employment contracts are a separate concept from the finance module's `Order` (student enrollment).*

---

## Leads / CRM

> **DEFERRED TO PHASE 2 ([D-0019](./decisions.md#d-0019-defer-leads--crm)).** The lead/CRM pipeline is out of MVP. Consequence: the `LEAD`/`TRIAL` student statuses are removed (see [PRD S-STU-4](./PRD.md#4-students)), and the lead → student conversion flow is Phase 2.

### S-LEAD-1 · Add a lead `Phase 2`
**As a** secretary, **I want** to capture a prospect's info **so that** I follow up later.

- Fields: `name`, `phone`, `email`, `source`, `interest` (e.g. "Stage 3 adulto"), `notes`.
- Default `status: NEW`.

### S-LEAD-2 · Kanban board `Phase 2`
**As a** secretary, **I want** to drag leads through stages **so that** I see the pipeline at a glance.

- Columns: `NEW → CONTACTED → TRIAL SCHEDULED → TRIAL DONE → ENROLLED | LOST`.
- Lost leads collapse to a footer count per column.
- Per card: name, phone, follow-up date (red if overdue), source tag.

### S-LEAD-3 · Schedule next follow-up `Phase 2`
**As a** secretary, **I want** to set a "follow up by" date **so that** I'm reminded on the dashboard.

- Per-lead `followUpAt` date.
- When built: dashboard card lists leads with `followUpAt <= today`.

### S-LEAD-4 · Lead activity log `Phase 2`
**As a** secretary, **I want** to log every interaction **so that** I don't forget what we discussed.

- Append-only list: `timestamp`, `channel` (WhatsApp/call/walk-in/email), free-text note.

### S-LEAD-5 · WhatsApp click-to-chat from lead `Phase 2`
**As a** secretary, **I want** one click to open WhatsApp **so that** I don't copy-paste numbers.

- Button on lead card opens `https://wa.me/55<digits>` in new tab.
- Same pattern on student profile ([PRD S-STU-3](./PRD.md#4-students)).

### S-LEAD-6 · Convert lead to student `Phase 2`
**As a** secretary, **I want** one-click conversion **so that** enrollment is fast after a successful trial.

- "Converter em aluno" button on a `TRIAL DONE` lead.
- Pre-fills student form with lead data; on save, sets lead status `ENROLLED` and links `convertedStudentId`.
- Continues into enrollment flow ([PRD S-ENR-1](./PRD.md#6-enrollment)).

---

## Notifications — WhatsApp & configurable rules

> **DEFERRED TO PHASE 2 ([D-0018](./decisions.md#d-0018-notifications-mvp--transactional-email-only)).** MVP ships transactional email only (see [PRD S-NOT-2](./PRD.md#12-notifications-email-in-mvp-whatsapp-phase-2)). WhatsApp via self-hosted Evolution API and the configurable rules engine are Phase 2.

### S-NOT-1 · WhatsApp send via Evolution API `Phase 2`
**As the** system, **I want** to send WhatsApp messages **so that** staff don't manually copy-paste reminders.

- Hatchet workflow `notification-send` calls Evolution API (self-hosted on GCP).
- Triggers, channels, and templates configured by communication rules (S-NOT-3).
- Logs delivery status; retry on transient failure.

### S-NOT-3 · Communication rules (configurable) `Phase 2`
**As an** admin, **I want** to define when notifications fire **so that** comms are predictable.

- Rule = trigger (e.g. installment overdue D+3) + channel (WhatsApp / email / both) + template.
- Rule editor UI and DB-seeded configurable rules ship in Phase 2 (replaces hardcoded S-NOT-2 triggers).
- **Phase 2 default rules** (proposed — adjusted to **not duplicate Cora's existing dunning emails** at D-15 / D0 / D+5 / D+10 / D+15; see [D-0014](./decisions.md#d-0014-cora-coexistence)):
  1. Installment overdue **D+2** → WhatsApp **draft for staff to send** (matches Coordinator A's "first business day after due"); slots between Cora's D0 and D+5 emails.
  2. Installment overdue **D+30** → our email to responsible (after Cora's D+15 email has been ignored).
  3. Portal failure → email to admin distribution.
