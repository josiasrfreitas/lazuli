# Contract materials

Updated 19 October 2026. This record supersedes the previous two-book cap, manual next-purchase
reminder, nested acquisition dialog and material gross-total summary. Work is in the
`operacao-pedagogica` worktree; unrelated class-organization and renewal work is concurrent.

## Accepted behavior

- Contracts usually cover twelve months and two academic periods. They may span enrollments.
  The contract listing still concerns tuition and redirects to the existing student finance tab.
- Materials change with the academic stage. Regular students use the class plan and the stage
  destination from class organization. PPT students use their individual stage plan and can
  progress through several stages without changing class.
- An operator can add material at any time inside **Ver contrato → Adicionar material**.
  Acquisition is the second step of the same dialog. Back and Escape return to the invoice.
  No nested acquisition modal, renewal charge or automatic book purchase is introduced.
- A sale accepts one or more distinct stages. Two empty book slots are the initial suggestion;
  operators can remove one or add more. Supporting materials remain outside scope.
- Each sale creates exactly one net school receivable, regardless of book count. Card installments
  are customer payment terms. The school receives the net in one repasse within 24 hours after
  the card sale. An agreed sale can remain unpaid; recording it does not register payment.
- Materials do not inherit tuition interest or punctuality discounts. At contract creation the
  first date matches tuition; later acquisition selects a month on the original tuition due day,
  clamped in short months. That date does not generate recurring material installments.

## Price snapshots

Settings, restricted to SYSTEM_ADMIN, owns the global fee and per-book terms. Estágios has no
financial controls. Defaults are configurable:

| Books | Adult card terms | Card gross | Fee at 10% | School net / cash price |
| ----- | ---------------- | ---------- | ---------- | ----------------------- |
| One   | 6 × R$136        | R$816.00   | R$81.60    | R$734.40                |
| Two   | 12 × R$136       | R$1,632.00 | R$163.20   | R$1,468.80              |
| Three | 18 × R$136       | R$2,448.00 | R$244.80   | R$2,203.20              |

Infantil uses six installments of R$123 per book, giving R$664.20 net per book with the initial
fee. Book count multiplies the configured installment count, retaining the unit amount. Cash
charges the net amount without a card fee. Later Settings changes do not rewrite agreed sales;
the server rejects stale quotes.

`MaterialOrderItem` stores each stage's identity, name, code and position within the sale.
`MaterialOrder` stores the commercial snapshot and extends a contract-linked material order.
The sale owns one net installment. Selection uses active persisted English stages, not a verified
SGF edition inventory; the import is still separate work.

The applied migrations through `20261019150000_material_sale_items` remain immutable.
`20261019160000_unlimited_material_sale_items` removes only the upper bound on item position.
The old nullable `Contract.nextMaterialPurchaseOn` column is retained to avoid rewriting applied
history, but has no active finance API or UI. Existing legacy paid/adjusted installment schedules
are not silently consolidated.

## Planning-derived attention

`readMaterialNeeds` is read-only. It considers current enrollments and their active stage plans.
The notice starts 30 civil days before the planned end and remains while that current plan is
past its end. No manual next-material date or "prepare next material" editor remains.

- PPT predicts the next catalog stage in the same track; it does not advance the student.
- Regular uses the latest non-declined organization destination. Without a destination it says
  **Conferir próximo estágio** instead of asserting a specific purchase. Same-stage continuation
  produces no new-book notice.
- A next-stage book already contracted in a non-cancelled sale suppresses the purchase notice,
  even when the receivable is unpaid. Purchases from earlier contracts also count.
- Missing or mismatched plans do not invent an end date. This is a forecast from the current plan,
  not a persistent collection task after stage transition. Stage movement and renewal remain owned
  by class organization; this slice performs neither.

## Interface

The student summary displays each sale's terms as **N× de R$…**, including **1×** for cash.
Independent sales remain separate. Hover or keyboard focus explains the card repasse and external
installment arrangement. The invoice shows item names, customer amount, card fee/net and actual
settlement status in aligned columns. Paid-and-waived tuition is **Sem saldo**, not **Quitado**.

The desktop dialog has a 47.6rem maximum width, reduced at the user’s request after the wider
version still required vertical scrolling. Only its body scrolls when needed. The second step
puts book choices beside receipt details. Save returns to the invoice and refreshes the summary;
Escape from step two returns keyboard focus to **Adicionar material**.

## Enrollment prerequisite

An ACTIVE student registration and a financial contract do not establish a current enrollment.
Current means entry on/before today in São Paulo, exit absent or strictly after today, with neither
membership nor class deleted. Future and ended enrollments do not unlock new pedagogical activity.

Without current enrollment the profile centers a single icon, title and explanation in the
available panel. It has no action buttons and no evaluations link. A future enrollment names the
class and start date in its message. Existing history remains below; empty appointment and
follow-up workspaces are omitted. This replaces the earlier top banner and organization button,
which the user explicitly rejected. No creation actions mount while enrollment is unresolved.

The server rejects new appointments/reappointments, new occurrence/intervention records and new
intervention follow-ups without current enrollment. Initial recording of an appointment is also
guarded; historical correction/cancellation is not redefined by this change. The general scheduling
form detects the same missing prerequisite before proceeding. No enrollment or renewal workflow
was changed.

## Validation and local examples

Manual checks used the Orca CLI and the authenticated local app. The following were observed:

- The earlier no-enrollment profile offered organization; that composition was rejected and replaced
  by the centered, action-free state described above.
- Future enrollment shows its actual start and preserves enrollment history.
- A direct intervention creation request without enrollment returns BAD_REQUEST with the
  prerequisite explanation.
- PPT plan ending 12 November produces the notice on 19 October; regular example with the next
  book already purchased produces none.
- A three-book sale submitted through the second step creates three items, one receivable of
  R$2,203.20 and no payment. The notice disappears because the next book is now contracted.
- Existing independent card and cash sales show `6× de R$136,00` and `1× de R$734,40` separately.
- The dialog remains single through both steps. Escape returns to the invoice and its add button.
- Desktop invoice and form were inspected; narrow-layout captures are in `tmp/materials-workshop`.

Review examples on `http://operacao-pedagogica.lazuli.localhost:3004`:

- `/alunos/bc3bb0ac-b330-40b5-87e7-01fb7f1a78c9?secao=financeiro`: two-book sale already paid,
  tuition still receivable.
- `/alunos/b957589a-8d4d-4cf0-861c-802103187b4a?secao=financeiro`: initial one-book sale plus a
  later three-book sale, both pending; current PPT plan.
- `/alunos/9a11e926-d7da-4b07-8100-5f904562dea2`: future enrollment; finance has separate cash/card sales.
- `/alunos/12ad3828-2083-4d40-89ce-cec4db3de307`: no enrollment.

Test sources cover one/two/three-book inputs, duplicate stages, net receipts, planning-derived
notices, prepaid suppression and enrollment creation guards. Automated test suites, lint,
typecheck and builds were not run under the user's standing restriction. Formatting and
`git diff --check` are permitted and were run. Browser evidence is not approval of the design or
proof that the unexecuted automated gates pass.
