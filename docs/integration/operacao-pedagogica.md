# Operation integration audit

Source snapshot: `056338910a1a183ee70d02fe7ff48308d496b7c1`. Main at inventory creation: `8c2e28c57fcf2ee261b8cf3af917fa354c70dd84`. Common base: `16f770907b19ffaa65b5b1e4da12204bed842934`.

The remaining scope belongs to exactly three PRs: pedagogical operations; entry/commercial/contracts; class and semester organization, activity log and final seed. There are no line limits. Security uses gpt-6.1-sol with medium effort after an active PR; functional QA is absent.

## Evidence states

Route enumeration is complete for the tracked page files in this source snapshot. Route variants and dependency coverage are **not yet audited**. Block assignments below are candidates, to be verified against real imports, actions and work items. Existing merged features are not being claimed again as newly delivered.

For each route, inspect layouts, components and conditional paths; record roles, path/query inputs, data states, tabs/filters, dialogs, actions, redirects and API/persistence/job dependencies in `operacao-pedagogica-routes.json`. Keep implementation and behavior evidence separate. Each intentional divergence needs its reason, authorizing requirement and final-head verification. Lint or review success alone does not establish behavioral equivalence.

## Routes

| Route                               | Candidate block  | Source page                                                        | Behavior audit |
| ----------------------------------- | ---------------- | ------------------------------------------------------------------ | -------------- |
| `/acompanhamento/intervencoes/[id]` | 1                | `apps/web/src/app/(app)/acompanhamento/intervencoes/[id]/page.tsx` | Pending        |
| `/acompanhamento/ocorrencias/[id]`  | 1                | `apps/web/src/app/(app)/acompanhamento/ocorrencias/[id]/page.tsx`  | Pending        |
| `/acompanhamento`                   | 1                | `apps/web/src/app/(app)/acompanhamento/page.tsx`                   | Pending        |
| `/ajustes`                          | 3                | `apps/web/src/app/(app)/ajustes/page.tsx`                          | Pending        |
| `/alunos/[id]`                      | 1                | `apps/web/src/app/(app)/alunos/[id]/page.tsx`                      | Pending        |
| `/alunos`                           | 1                | `apps/web/src/app/(app)/alunos/page.tsx`                           | Pending        |
| `/atendimentos/[id]`                | 1                | `apps/web/src/app/(app)/atendimentos/[id]/page.tsx`                | Pending        |
| `/atendimentos`                     | 1                | `apps/web/src/app/(app)/atendimentos/page.tsx`                     | Pending        |
| `/atividades`                       | 3                | `apps/web/src/app/(app)/atividades/page.tsx`                       | Pending        |
| `/aulas`                            | 1                | `apps/web/src/app/(app)/aulas/page.tsx`                            | Pending        |
| `/avaliacoes`                       | 1                | `apps/web/src/app/(app)/avaliacoes/page.tsx`                       | Pending        |
| `/configuracoes/presenca`           | 1                | `apps/web/src/app/(app)/configuracoes/presenca/page.tsx`           | Pending        |
| `/contratos`                        | 2                | `apps/web/src/app/(app)/contratos/page.tsx`                        | Pending        |
| `/estagios`                         | 1                | `apps/web/src/app/(app)/estagios/page.tsx`                         | Pending        |
| `/financeiro`                       | 2                | `apps/web/src/app/(app)/financeiro/page.tsx`                       | Pending        |
| `/interessados/[id]`                | 2                | `apps/web/src/app/(app)/interessados/[id]/page.tsx`                | Pending        |
| `/interessados`                     | 2                | `apps/web/src/app/(app)/interessados/page.tsx`                     | Pending        |
| `/materiais`                        | 2                | `apps/web/src/app/(app)/materiais/page.tsx`                        | Pending        |
| `/organizacao`                      | 3                | `apps/web/src/app/(app)/organizacao/page.tsx`                      | Pending        |
| `/`                                 | 1                | `apps/web/src/app/(app)/page.tsx`                                  | Pending        |
| `/planejamento`                     | 1                | `apps/web/src/app/(app)/planejamento/page.tsx`                     | Pending        |
| `/professor/acompanhamento`         | 1                | `apps/web/src/app/(app)/professor/acompanhamento/page.tsx`         | Pending        |
| `/professor/agenda/[id]/chamada`    | 1                | `apps/web/src/app/(app)/professor/agenda/[id]/chamada/page.tsx`    | Pending        |
| `/professor/agenda`                 | 1                | `apps/web/src/app/(app)/professor/agenda/page.tsx`                 | Pending        |
| `/professor/alunos/[id]`            | 1                | `apps/web/src/app/(app)/professor/alunos/[id]/page.tsx`            | Pending        |
| `/professor/alunos`                 | 1                | `apps/web/src/app/(app)/professor/alunos/page.tsx`                 | Pending        |
| `/professor/atendimentos`           | 1                | `apps/web/src/app/(app)/professor/atendimentos/page.tsx`           | Pending        |
| `/professor/chamada/previa`         | 1                | `apps/web/src/app/(app)/professor/chamada/previa/page.tsx`         | Pending        |
| `/professor/experimentais`          | 1                | `apps/web/src/app/(app)/professor/experimentais/page.tsx`          | Pending        |
| `/professor`                        | 1                | `apps/web/src/app/(app)/professor/page.tsx`                        | Pending        |
| `/professor/pendencias`             | 1                | `apps/web/src/app/(app)/professor/pendencias/page.tsx`             | Pending        |
| `/professor/turmas/[id]`            | 1                | `apps/web/src/app/(app)/professor/turmas/[id]/page.tsx`            | Pending        |
| `/professor/turmas`                 | 1                | `apps/web/src/app/(app)/professor/turmas/page.tsx`                 | Pending        |
| `/professores/[id]`                 | 1                | `apps/web/src/app/(app)/professores/[id]/page.tsx`                 | Pending        |
| `/professores`                      | 1                | `apps/web/src/app/(app)/professores/page.tsx`                      | Pending        |
| `/proximo-semestre`                 | 3                | `apps/web/src/app/(app)/proximo-semestre/page.tsx`                 | Pending        |
| `/recebiveis`                       | 2                | `apps/web/src/app/(app)/recebiveis/page.tsx`                       | Pending        |
| `/turmas/[id]`                      | 1                | `apps/web/src/app/(app)/turmas/[id]/page.tsx`                      | Pending        |
| `/turmas`                           | 1                | `apps/web/src/app/(app)/turmas/page.tsx`                           | Pending        |
| `/workshop/acompanhamento`          | Decision pending | `apps/web/src/app/(app)/workshop/acompanhamento/page.tsx`          | Pending        |
| `/workshop/materiais`               | Decision pending | `apps/web/src/app/(app)/workshop/materiais/page.tsx`               | Pending        |
| `/403`                              | 1                | `apps/web/src/app/403/page.tsx`                                    | Pending        |
| `/login`                            | 1                | `apps/web/src/app/login/page.tsx`                                  | Pending        |
| `/perfil`                           | 1                | `apps/web/src/app/perfil/page.tsx`                                 | Pending        |
| `/presenca`                         | 1                | `apps/web/src/app/presenca/page.tsx`                               | Pending        |
| `/presenca/previa`                  | 1                | `apps/web/src/app/presenca/previa/page.tsx`                        | Pending        |
| `/presenca/previa/projecao`         | 1                | `apps/web/src/app/presenca/previa/projecao/page.tsx`               | Pending        |
| `/presenca/projecao`                | 1                | `apps/web/src/app/presenca/projecao/page.tsx`                      | Pending        |

## Dependency and branch leads

The JSON indexes link to JSONL records (one file/module per line), keeping the reviewable diff compact.
`operacao-pedagogica-route-graph.json` records the static import closure, inherited route boundaries,
source files, conditional expressions and tRPC calls. It was built from the pinned source while its
checkout was clean. The first pass found 587 reachable files and 6,387 conditional leads. These are
syntactic leads for manual review, not 6,387 tested product states. Computed imports, runtime data
combinations and unreachable branches require explicit review. Standard-library and third-party
imports remain in file metadata; API and persistence boundaries are listed for separate inspection.

## Catalog fidelity checkpoint

All 48 page modules and the authenticated/teacher layouts were read at the source SHA. Imported
feature variants remain pending except where individually recorded. `/estagios` has its source
variants enumerated, with runtime verification on the complete pedagogical block still pending.
The source's F1 default selection was restored during this comparison.

The catalog's 14 supplied PDF transcriptions produce identical import documents before and after
lint refactoring. Seventy differential domain cases (valid graphs and individual invalid mutations)
produce identical acceptance/error outcomes. The source validator's unknown-assessment-unit check
was restored before downstream activity validation after this comparison exposed a changed error.
Independent integration checks also passed 19 cases covering the catalog, existing planning and
existing class records, using a fresh migrated Postgres database removed afterwards.

Full typecheck passed at this checkpoint. The last full lint found only the newly imported seed
adapter's structure; it was refactored and the focused script/domain lints passed. Full lint and
build of the complete first block, transport, browser implementation checks, security and PullFrog
remain required. No PR for this block exists yet. A prior build attempt failed on readonly table
props, corrected afterwards; it is not recorded as a passing build.

## Outside routes

Workers, imports, schema, permissions, seed, shared UI and operational configuration also require explicit destinations. Workshops and preview routes remain listed until a reviewed decision assigns or excludes them; they are not implicitly dropped or counted as product completion.

## Completion gate

Before each PR is complete, every assigned route variant must have implementation and behavior evidence on its final head. Before the full goal is complete, every source delta file and work-item requirement must be reconciled with the observed merged main, with justified exclusions and no unassigned scope. The current inventory is an audit starting point, not a completion claim.
