# PR #207 — inventário de lint

> **BLOCO 10 FECHADO LOCALMENTE — CI ESTÁTICO:** os dez arquivos Web que
> falharam no `format:check` foram corrigidos. A formatação dos 1.586 arquivos
> versionados/novos passou; lint global 16/16 com 0 erros e os mesmos 932
> avisos Web, typecheck Web, testes Web 295/295 e limite de componentes
> passaram. Próxima ação: commitar, subir e acompanhar o novo head no PR. Log
> original do job:
> `/tmp/lazuli-pr207-static-job.log`.

### Bloco 10 — formatação Web, 10 arquivos congelados

| Arquivo relativo à raiz                                               |
| --------------------------------------------------------------------- |
| `apps/web/src/features/activity/activity-format.ts`                   |
| `apps/web/src/features/appointments/form-fields.tsx`                  |
| `apps/web/src/features/classes/class-grade-average.tsx`               |
| `apps/web/src/features/command-palette/command-palette.tsx`           |
| `apps/web/src/features/students/follow-up-workshop/layouts.tsx`       |
| `apps/web/src/features/students/follow-up-workshop/record-views.tsx`  |
| `apps/web/src/features/students/new-student/intake-dialog-chrome.tsx` |
| `apps/web/src/features/students/profile/enrollment-grade-average.tsx` |
| `apps/web/src/features/students/profile/student-finance.tsx`          |
| `apps/web/src/features/students/profile/student-pedagogy.tsx`         |

> **BLOCO 9 FECHADO E PUBLICADO — GATE DE PUSH:**
> `apps/web/src/features/installments/installments-page.tsx` caiu de 655 para
> 642 linhas (limite 650) com o predicado movido para
> `apps/web/src/features/installments/filters.ts`. Lint global 16/16, 0 erros;
> typecheck Web, 295/295 testes Web e checagem de tamanho passaram. O hook de
> pre-push passou e o commit `54c7613` entrou no PR #207. Ficha:
> [Web 9](pr207-lint-agent-web-block9.md).

> **BLOCO 8 FECHADO:** 31 erros iniciais em 21 arquivos; medição final:
> **0 erros na API completa** e 0 no script direcionado. A API tem 15 avisos
> não bloqueantes e nenhum novo fingerprint de erro frente ao baseline. Os
> testes afetados passaram (88 API unitários, 295 Web, 314 integração, 63
> transporte). `pnpm typecheck` passou (13/13 tarefas) e `pnpm lint` da raiz
> passou (16/16 tarefas, 0 erros).
> Os 30 erros da API foram medidos em
> `/tmp/lazuli-pr207-api-full-block7.json` e 1 erro em
> `scripts/imports/teaching-program.ts` registrado no lint da raiz após o
> bloco 7. O Web completo passou com 0 erros. Logs globais:
> `/tmp/lazuli-pr207-root-after-block7.log` e
> `/tmp/lazuli-pr207-root-final.log`.

### Bloco 8 — API e script de importação, 31 erros congelados

| Arquivo relativo à raiz                                            | Erros no baseline |
| ------------------------------------------------------------------ | ----------------: |
| `packages/api/src/activity/read.ts`                                |                 2 |
| `packages/api/src/activity/record.ts`                              |                 1 |
| `packages/api/src/activity/student-financial-scope.ts`             |                 1 |
| `packages/api/src/assessments/data.ts`                             |                 1 |
| `packages/api/src/assessments/read.ts`                             |                 1 |
| `packages/api/src/assessments/rules.ts`                            |                 2 |
| `packages/api/src/attendance/makeup-schedule.ts`                   |                 1 |
| `packages/api/src/command-search/read.ts`                          |                 3 |
| `packages/api/src/occurrences/sessions.ts`                         |                 3 |
| `packages/api/src/search.ts`                                       |                 2 |
| `packages/api/src/teachers/agenda.ts`                              |                 2 |
| `packages/api/src/teachers/departure.ts`                           |                 1 |
| `packages/api/test/appointments/appointments.integration.test.ts`  |                 1 |
| `packages/api/test/assessments/assessment.integration.test.ts`     |                 1 |
| `packages/api/test/attendance/makeup-schedule.integration.test.ts` |                 1 |
| `packages/api/test/finance/contract-materials.integration.test.ts` |                 2 |
| `packages/api/test/finance/settings.transport.test.ts`             |                 1 |
| `packages/api/test/occurrences/follow-up.integration.test.ts`      |                 2 |
| `packages/api/test/support/appointment-fixtures.ts`                |                 1 |
| `packages/api/test/trpc/router.unit.test.ts`                       |                 1 |
| `scripts/imports/teaching-program.ts`                              |                 1 |

O lint da raiz após o bloco 7 parou no script de importação de programas de
ensino. O argumento de `JSON.parse` deixou de satisfazer a assinatura tipada
de `importTeachingProgram` após a refatoração do bloco 7. Esse caminho está
reservado no bloco 8 como dependência direta; a API completa foi medida
separadamente com 30 erros e nenhum novo fingerprint.

> **BLOCO 7 CONGELADO:** 100 erros em 30 arquivos de `packages/api/src` nas
> áreas `admissions`, `appointments`, `class-records`, `finance` e
> `teaching-programs`. Medição atual: **0 erros no bloco**. Lint completo da API:
> **30 erros fora do bloco**, sem novos fingerprints frente aos 130 anteriores;
> o lint Web completo tem 0 erros. Baseline:
> `/tmp/lazuli-pr207-api-full-block6.json`. Gate: zero erros no bloco,
> typecheck e testes pertinentes, lint API completo sem novos fingerprints por
> arquivo/regra/mensagem e `pnpm lint` da raiz. Depois, congelar e zerar os
> erros restantes até a worktree ficar verde.

Comando direcionado:

```sh
pnpm -F @lazuli/api exec eslint src/admissions src/appointments src/class-records src/finance src/teaching-programs -f json > /tmp/lazuli-pr207-api-block7-current.json
```

### Bloco 7 — API, 100 erros congelados

| Arquivo relativo a `packages/api`              | Erros no baseline |
| ---------------------------------------------- | ----------------: |
| `src/admissions/candidates.ts`                 |                 1 |
| `src/admissions/capture.ts`                    |                 3 |
| `src/admissions/guardian.ts`                   |                 2 |
| `src/admissions/placement.ts`                  |                 6 |
| `src/admissions/visit-calendar.ts`             |                 2 |
| `src/appointments/absences.ts`                 |                 4 |
| `src/appointments/availability.ts`             |                 2 |
| `src/appointments/commitments.ts`              |                 1 |
| `src/appointments/coverage.ts`                 |                 2 |
| `src/appointments/legacy.ts`                   |                 1 |
| `src/appointments/read.ts`                     |                 7 |
| `src/appointments/record.ts`                   |                 4 |
| `src/appointments/schedule.ts`                 |                 2 |
| `src/appointments/scheduling.ts`               |                 6 |
| `src/class-records/experimental-sessions.ts`   |                 1 |
| `src/class-records/guests.ts`                  |                 2 |
| `src/class-records/progress.ts`                |                 2 |
| `src/class-records/read.ts`                    |                 2 |
| `src/finance/internal/contract-detail.ts`      |                 4 |
| `src/finance/internal/contract-materials.ts`   |                 4 |
| `src/finance/internal/contract-termination.ts` |                 7 |
| `src/finance/internal/contracts-select.ts`     |                 2 |
| `src/finance/internal/contracts.ts`            |                 3 |
| `src/finance/internal/material-needs.ts`       |                 3 |
| `src/finance/internal/renewal.ts`              |                 3 |
| `src/finance/internal/settings.ts`             |                 1 |
| `src/finance/internal/student-summary.ts`      |                 2 |
| `src/finance/treatments/index.ts`              |                 8 |
| `src/teaching-programs/import.ts`              |                 5 |
| `src/teaching-programs/read.ts`                |                 8 |

O lint da raiz após os blocos 5 e 6 reportou 130 erros na API e nenhum em
outros pacotes concluídos. O Turbo interrompeu o Web, que passou no lint
completo separado com 0 erros. O bloco 7 abrange exatamente 100 dos 130
erros restantes; os demais 30 serão selecionados após seu gate global.

O lint completo da API após o bloco 7 mediu 30 erros, todos fora do bloco;
nenhum fingerprint novo por arquivo/regra/mensagem. Snapshot:
`/tmp/lazuli-pr207-api-full-block7.json`. O lint direcionado das cinco áreas
passou com 0 erros e 1 aviso. `pnpm test:affected --staged` passou: API unitária
88/88, Web unitária 295/295, API integração 314/314 e transporte 63/63.

O bloco 1 foi fechado com 0 erros em `features/students`. `pnpm lint` da raiz concluiu:
somente Web e API falharam; os demais checks de lint passaram. Web e API totalizam 604 erros,
contra 745 do inventário anterior. A comparação por arquivo/regra/mensagem achou 13 novos
fingerprints fora de alunos em appointments, assessments e contracts; comparando só arquivo/regra,
são 8 ocorrências novas e 5 mensagens de complexidade alteradas. O diff mostra alterações do
`--fix` global nesses seis arquivos, inclusive substituições de comparação de datas em string
por `Math.max` e seletores DOM de tipo genérico. Todas as ocorrências estão no bloco 2. O fluxo local segue
[`big-lint-resolver`](../../.codex/skills/big-lint-resolver/SKILL.md).

O typecheck do Web passou após as correções de tipo do bloco 2. A área de análise financeira,
`appointments/shared.tsx`, `assessments/progress-chart.tsx`, `assessment-summary.tsx`,
`assessments-page.tsx` e `class-chart.tsx` estão sem erros no lint direcionado.
Também foram zerados os erros de `appointments/appointment-dialog-context.tsx`, `form-fields.tsx`,
`schedule-calendar-toolbar.tsx`, `student-carousel.tsx` e `student-section.tsx`.
`assessment-files/placement-attachment-dialog.tsx` e `assessments/assessment-workspace.tsx`
também estão sem erros; o typecheck do Web passou após essas alterações.
`assessments/class-performance.tsx`, `assessments/confirmation-dialog.tsx` e
`contracts/new-contract-state.ts` foram zerados na rodada seguinte; o typecheck permanece verde.
`contracts/contract-payment-section.tsx` também foi zerado, com typecheck verde.
`assessments/use-assessment-form.ts` foi zerado, com typecheck verde após adaptar as chamadas no
diálogo de avaliação.
`assessments/results-table.tsx` também foi zerado e o typecheck do Web passou.
`appointments/student-appointment-dialog.tsx` foi zerado com typecheck verde.
`appointments/appointment-calendar.tsx` e `appointments/detail.tsx` foram zerados com typecheck verde.
`appointments/coverage-fields.tsx` foi dividido com `coverage-list.tsx`; ambos passam no lint e no typecheck.
`assessment-files/attachments.tsx` também passou no lint e no typecheck após a divisão da lista.
`contracts/contract-material-section.tsx` foi dividido em controles de estágios, preço e pagamento;
o arquivo passou no lint e o typecheck do Web permanece verde. O lint direcionado dos cinco
diretórios confirmou 28 erros restantes, nos arquivos `class-meeting-step` (6), `record-form` (2),
`schedule-dialog` (9), `queue-provider` (6), `assessment-entry-dialog` (3) e
`add-contract-material` (2).
`contracts/add-contract-material.tsx` foi dividido em estado, envio, campos e ações; seu lint
passou e o typecheck do Web continua verde. O lint dos cinco diretórios confirmou 26 erros
restantes nos cinco arquivos de appointments, assessment-files e assessments.
`appointments/record-form.tsx` foi separado em estado, envio e campos; lint e typecheck do Web
passaram. O lint dos cinco diretórios confirmou 24 erros restantes em quatro arquivos.
`appointments/class-meeting-step.tsx` foi separado em relógio, disponibilidade, validação,
calendário e campos de seleção; passou no lint e no typecheck. O lint dos cinco diretórios
confirmou 18 erros restantes em `schedule-dialog` (9), `queue-provider` (6) e
`assessment-entry-dialog` (3).
`assessment-files/queue-provider.tsx` foi separado em hidratação, sincronização, execução da fila
e controles visuais; seu lint e o typecheck do Web passaram. O lint dos cinco diretórios confirmou
12 erros restantes em `schedule-dialog` (9) e `assessment-entry-dialog` (3).
`assessments/assessment-entry-dialog.tsx` foi separado em estado, envio de provas e campos do
diálogo; lint e typecheck do Web passaram. O lint dos cinco diretórios confirmou 9 erros,
todos em `appointments/schedule-dialog.tsx`.
`appointments/schedule-dialog.tsx` foi dividido com `schedule-dialog-model.ts` em estado,
validação, envio e campos das duas etapas. O lint direcionado dos **67 arquivos** nos cinco
diretórios passou com **0 erros** e 173 avisos; o typecheck do Web passou. Falta executar os
testes relevantes e `pnpm lint` da raiz, comparar o resultado global por fingerprint com o
snapshot anterior e só então fechar o bloco 2 e selecionar o próximo.
O teste unitário completo do Web passou: **295 testes, 0 falhas** (`pnpm -F @lazuli/web test`).
`git diff --check` passou. `pnpm lint` da raiz falhou na API pelos **230 erros conhecidos**;
a execução do Web foi interrompida pelo Turbo. O lint Web completo foi executado diretamente:
**374 → 274 erros**, **923 → 902 avisos**. Comparação por arquivo/regra/mensagem:
**100 erros resolvidos, 0 novos fingerprints**. A API não teve arquivos alterados neste lote e
permaneceu em 230 erros; total global conhecido **604 → 504**. O bloco 2 está fechado.

Retrato global após o bloco 2, ainda com correções locais não publicadas no head `8ff644e`.
Comandos: `pnpm lint` e `pnpm -F @lazuli/web exec eslint . -f json`.
JSON Web em `/tmp/lazuli-pr207-web-full-after-block2.json`; snapshot anterior em
`/tmp/lazuli-pr207-web-full-after-students.json`. O quadro abaixo representa esse retrato.

| Escopo | Erros publicados | Erros locais | Avisos locais |
| ------ | ---------------: | -----------: | ------------: |
| Web    |              581 |          274 |           902 |
| API    |              230 |          230 |            15 |
| Total  |              811 |          504 |           917 |

O lote local de preparação/calendário eliminou 22 erros. Os sete arquivos tocados passam no lint direcionado com zero erros; os quatro avisos de classes em `generation-notice.tsx` permanecem.

## Blocos

| Bloco | Área                                                                           |                 Erros no início | Estado                                                           |
| ----- | ------------------------------------------------------------------------------ | ------------------------------: | ---------------------------------------------------------------- |
| 0     | Preparação e calendário de aulas                                               | 22 removidos do total publicado | Checks locais direcionados passaram; ainda não publicado         |
| 1     | Web: `features/students`                                                       |                             105 | 0 restantes; 105 removidos localmente; ainda não publicado       |
| 2     | Web: appointments, assessment-files, assessments, contracts, finance-analytics |                             100 | Fechado: 0 direcionados, 100 removidos globalmente, 0 regressões |
| 3     | Web: organização de turmas, turmas, semestre e planejamento de estágios        |                              98 | Fechado: 0 direcionados, 98 removidos globalmente, 0 regressões  |
| 4     | Web: registros, área do professor, acompanhamento, presença e catálogo         |                              93 | Fechado: 0 direcionados, 93 removidos globalmente, 0 regressões  |
| 5     | Web: admissão, entrada, navegação e erros residuais                            |                              83 | Fechado: 0 erros Web completos e 0 novos fingerprints            |
| 6     | API: semestre, alunos, turmas e área do professor                              |                             100 | Fechado em `a3d2d17`; 0 no bloco, 130 na API fora dele           |
| 7     | API: admissão, agendamentos, registros, financeiro e programas                 |                             100 | Em curso: 50 no bloco, 30 fora dele                              |

No bloco 3, `classes/form-controls.tsx`, `class-overview.tsx` e
`class-stage-progress.tsx` passaram no lint direcionado. O lint dos quatro diretórios
confirmou **93 erros em 32 arquivos** (antes: 98 em 35); as 5 ocorrências removidas eram
dessas três telas. O estado intermediário está em `/tmp/lazuli-pr207-block3-current.json`.
Os dez erros restantes de `features/classes` também foram removidos: o lint do diretório
passou com zero erros e o typecheck do Web passou. O lint dos quatro diretórios confirmou
**83 erros restantes**: 43 em `class-organization`, 27 em `semester-organization` e 13 em
`stage-planning`. O JSON atualizado está em `/tmp/lazuli-pr207-block3-current.json`.
Em `stage-planning`, `planning-loading`, `planning-page`, `progress-summary`, `record-list` e
`shared` passaram no lint; o typecheck do Web também passou. O lint dos quatro diretórios
confirmou **77 erros restantes**: 43 em `class-organization`, 27 em `semester-organization` e
7 em `stage-planning`. O JSON atualizado está em `/tmp/lazuli-pr207-block3-current.json`.
`stage-planning` foi zerado nos 16 arquivos do diretório, incluindo a divisão do estado,
filtros, tabela e diálogos de `workspace.tsx`; o typecheck do Web passou. O lint dos quatro
diretórios confirmou **70 erros restantes**: 43 em `class-organization` e 27 em
`semester-organization`. O JSON atualizado está em `/tmp/lazuli-pr207-block3-current.json`.
Em `semester-organization`, `action-dialogs`, `shared` e `slot-fields` passaram no lint
direcionado e o typecheck do Web passou. O lint dos quatro diretórios confirmou **65 erros**:
43 em `class-organization` e 22 em `semester-organization`. O JSON atualizado está em
`/tmp/lazuli-pr207-block3-current.json`.
`semester-organization/student-pool` foi dividido em filtros, tabela e células; seus dois
arquivos passam no lint e o typecheck do Web passou. A medição dos quatro diretórios aponta
**62 erros restantes**: 43 em `class-organization` e 19 em `semester-organization`.
`semester-organization/availability-form` e o novo estado do formulário passaram no lint
direcionado e o typecheck do Web passou. A medição dos quatro diretórios aponta **60 erros**:
43 em `class-organization` e 17 em `semester-organization`.
`semester-organization/placement-form` foi separado em estado e campos; seus três arquivos
passam no lint direcionado e o typecheck do Web passou. A medição dos quatro diretórios aponta
**57 erros**: 43 em `class-organization` e 14 em `semester-organization`.
`semester-organization/roster.tsx` passou no lint direcionado e o typecheck do Web passou.
A medição dos quatro diretórios aponta **54 erros**: 43 em `class-organization` e 11 em
`semester-organization`.
`semester-organization/plan-form.tsx` foi dividido em estado, campos e criação de semestre;
os quatro arquivos passam no lint direcionado e o typecheck do Web passou. A medição dos
quatro diretórios aponta **50 erros**: 43 em `class-organization` e 7 em
`semester-organization/page.tsx`. O total global projetado é **456** (Web 226 + API 230),
mas depende do lint completo e da comparação de regressões no gate do bloco.
`semester-organization/page.tsx` foi dividido em estado, visão, diálogos, resumo, detalhe e
cartões. Os sete arquivos novos/alterados passam no lint direcionado e o typecheck do Web passou.
O lint dos quatro diretórios confirmou **43 erros**, todos em `class-organization`; o total
global projetado é **449** (Web 219 + API 230), ainda sujeito ao gate completo do bloco.
`class-organization/agenda.tsx` e `weekly-schedule.tsx` foram separados em contagem de pendências,
controles móveis, filtros, grade e cartões. Ambos passam no lint direcionado e o typecheck do Web
passou. O lint dos quatro diretórios confirmou **38 erros**, todos em `class-organization`;
o total global projetado é **444** (Web 214 + API 230), sujeito ao gate completo.
`class-organization/calendar.tsx` foi dividido em meses/dias e painel de exceções; os três
arquivos passam no lint direcionado e no typecheck do Web. O lint dos quatro diretórios confirmou
**37 erros**; o total global projetado é **443** (Web 213 + API 230), sujeito ao gate completo.
`class-organization/continuity.tsx` foi dividido em estado, campos e ações do diálogo; o lint
direcionado dos dois arquivos e o typecheck do Web passaram. A medição dos quatro diretórios
confirmou **34 erros**; o total global projetado é **440** (Web 210 + API 230), sujeito ao gate.
`class-organization/queue-details.tsx` passou no lint direcionado após separar fatos,
pendências, sugestões e proposta de turma; o typecheck do Web passou. A medição dos quatro
diretórios confirmou **30 erros**; o total global projetado é **436** (Web 206 + API 230),
sujeito ao gate completo.
`class-organization/renewal.tsx` foi separado em estado, datas, prévia e campos. O lint
direcionado dos dois arquivos e o typecheck do Web passaram. A medição dos quatro diretórios
confirmou **29 erros**; o total global projetado é **435** (Web 205 + API 230), sujeito ao gate.
`class-organization/calendar-forms.tsx` foi separado em formulários de fechamento, período e
feriados, mantendo validação, feedback e importação. Os quatro arquivos passam no lint
direcionado e o typecheck do Web passou. A medição dos quatro diretórios confirmou **26 erros**;
o total global projetado é **432** (Web 202 + API 230), sujeito ao gate completo.
`class-organization/composition.tsx` foi separado em modelo, cabeçalho, lista e rodapé. Os
três arquivos passam no lint direcionado e o typecheck do Web passou. A medição dos quatro
diretórios confirmou **23 erros** em `dialogs`, `page`, `queue` e `review`; o total global
projetado é **429** (Web 199 + API 230), sujeito ao gate completo.
`class-organization/queue.tsx` foi separado em agrupamento e apresentação dos itens. Os três
arquivos passam no lint direcionado e o typecheck do Web passou. A medição dos quatro diretórios
confirmou **16 erros** em `dialogs`, `page` e `review`; o total global projetado é **422**
(Web 192 + API 230), sujeito ao gate completo.
`class-organization/dialogs.tsx` foi separado em roteamento de diálogos, busca de aluno e
transferência/não continuidade. Os arquivos passam no lint direcionado e o typecheck do Web
passou. A medição dos quatro diretórios confirmou **11 erros** em `page` e `review`; o total
global projetado é **417** (Web 187 + API 230), sujeito ao gate completo.

### Bloco 2 congelado — 100 erros em 34 arquivos

| Arquivo relativo a `apps/web`                                   | Erros no snapshot |
| --------------------------------------------------------------- | ----------------: |
| `src/features/appointments/appointment-calendar.tsx`            |                 4 |
| `src/features/appointments/appointment-dialog-context.tsx`      |                 2 |
| `src/features/appointments/class-meeting-step.tsx`              |                 6 |
| `src/features/appointments/coverage-fields.tsx`                 |                 3 |
| `src/features/appointments/detail.tsx`                          |                 5 |
| `src/features/appointments/form-fields.tsx`                     |                 1 |
| `src/features/appointments/record-form.tsx`                     |                 3 |
| `src/features/appointments/schedule-calendar-toolbar.tsx`       |                 1 |
| `src/features/appointments/schedule-dialog.tsx`                 |                11 |
| `src/features/appointments/shared.tsx`                          |                 1 |
| `src/features/appointments/student-appointment-dialog.tsx`      |                 7 |
| `src/features/appointments/student-carousel.tsx`                |                 1 |
| `src/features/appointments/student-section.tsx`                 |                 1 |
| `src/features/assessment-files/attachments.tsx`                 |                 3 |
| `src/features/assessment-files/placement-attachment-dialog.tsx` |                 2 |
| `src/features/assessment-files/queue-provider.tsx`              |                 6 |
| `src/features/assessments/assessment-entry-dialog.tsx`          |                 3 |
| `src/features/assessments/assessment-summary.tsx`               |                 1 |
| `src/features/assessments/assessment-workspace.tsx`             |                 1 |
| `src/features/assessments/assessments-page.tsx`                 |                 2 |
| `src/features/assessments/class-chart.tsx`                      |                 1 |
| `src/features/assessments/class-performance.tsx`                |                 1 |
| `src/features/assessments/confirmation-dialog.tsx`              |                 2 |
| `src/features/assessments/progress-chart.tsx`                   |                 3 |
| `src/features/assessments/results-table.tsx`                    |                 5 |
| `src/features/assessments/use-assessment-form.ts`               |                 3 |
| `src/features/contracts/add-contract-material.tsx`              |                 6 |
| `src/features/contracts/contract-material-section.tsx`          |                 4 |
| `src/features/contracts/contract-payment-section.tsx`           |                 2 |
| `src/features/contracts/new-contract-state.ts`                  |                 4 |
| `src/features/finance-analytics/chart-shared.tsx`               |                 1 |
| `src/features/finance-analytics/contract-closings.tsx`          |                 1 |
| `src/features/finance-analytics/distribution-charts.tsx`        |                 2 |
| `src/features/finance-analytics/finance-analytics-page.tsx`     |                 1 |

Após cada bloco, rode lint somente na área, tipos e testes afetados. Antes de publicar, rode o lint completo e registre o novo total. Se o total aumentar, investigue a regressão antes de prosseguir. Não altere regras ou gates para zerar a contagem.

## Erros por regra

| Regra                                              | Erros |
| -------------------------------------------------- | ----: |
| `max-lines-per-function`                           |   255 |
| `complexity`                                       |   141 |
| `unicorn/no-nested-ternary`                        |   122 |
| `@typescript-eslint/explicit-function-return-type` |    74 |
| `sonarjs/cognitive-complexity`                     |    34 |
| `shadcn/require-static-classes`                    |    25 |
| `max-statements`                                   |    22 |
| `@typescript-eslint/no-restricted-types`           |    13 |
| `max-nested-callbacks`                             |    10 |
| `unicorn/prefer-query-selector`                    |     9 |
| `max-params`                                       |     5 |
| `@typescript-eslint/no-misused-promises`           |     4 |
| `unicorn/prefer-math-min-max`                      |     4 |
| `sonarjs/no-duplicate-string`                      |     4 |
| `unicorn/consistent-function-scoping`              |     4 |
| `eqeqeq`                                           |     4 |
| `id-length`                                        |     2 |
| `@typescript-eslint/no-unnecessary-type-assertion` |     2 |
| `unicorn/no-array-for-each`                        |     1 |
| `shadcn/no-inline-styles`                          |     1 |
| `unicorn/escape-case`                              |     1 |
| `@typescript-eslint/no-unsafe-assignment`          |     1 |
| `unicorn/prefer-add-event-listener`                |     1 |
| `@typescript-eslint/no-unsafe-argument`            |     1 |
| `unicorn/prefer-ternary`                           |     1 |
| `unicorn/new-for-builtins`                         |     1 |
| `import-x/no-restricted-paths`                     |     1 |
| `@typescript-eslint/require-await`                 |     1 |
| `no-restricted-syntax`                             |     1 |

## Arquivos com erros

| Arquivo                                                                     | Erros |
| --------------------------------------------------------------------------- | ----: |
| `apps/web/src/app/(app)/professor/layout.tsx`                               |     1 |
| `apps/web/src/app/login/login-card.tsx`                                     |     2 |
| `apps/web/src/app/login/login-entrance.tsx`                                 |     1 |
| `apps/web/src/components/app-shell/account-menu.tsx`                        |     5 |
| `apps/web/src/components/app-shell/admin-mobile-notice.tsx`                 |     1 |
| `apps/web/src/components/app-shell/mobile-navigation.tsx`                   |     1 |
| `apps/web/src/features/activity/activity-format.ts`                         |     1 |
| `apps/web/src/features/admissions/admissions-page.tsx`                      |     1 |
| `apps/web/src/features/admissions/candidate-allocation.tsx`                 |     1 |
| `apps/web/src/features/admissions/candidate-page.tsx`                       |     3 |
| `apps/web/src/features/admissions/candidate-visits.tsx`                     |     6 |
| `apps/web/src/features/admissions/enroll-dialog.tsx`                        |     3 |
| `apps/web/src/features/admissions/intake-fields.tsx`                        |     1 |
| `apps/web/src/features/admissions/lead-capture-dialog.tsx`                  |     7 |
| `apps/web/src/features/admissions/lead-context.tsx`                         |     2 |
| `apps/web/src/features/admissions/lead-form.tsx`                            |     2 |
| `apps/web/src/features/admissions/matching-classes.tsx`                     |     1 |
| `apps/web/src/features/admissions/pending-allocation.tsx`                   |     1 |
| `apps/web/src/features/admissions/placement-assessment.tsx`                 |    12 |
| `apps/web/src/features/admissions/placement-schedule.tsx`                   |     9 |
| `apps/web/src/features/admissions/use-candidate-form.ts`                    |     4 |
| `apps/web/src/features/admissions/visit-dialog.tsx`                         |     9 |
| `apps/web/src/features/appointments/appointment-calendar.tsx`               |     7 |
| `apps/web/src/features/appointments/appointment-dialog-context.tsx`         |     2 |
| `apps/web/src/features/appointments/class-meeting-step.tsx`                 |     8 |
| `apps/web/src/features/appointments/coverage-fields.tsx`                    |     3 |
| `apps/web/src/features/appointments/detail.tsx`                             |     6 |
| `apps/web/src/features/appointments/form-fields.tsx`                        |     2 |
| `apps/web/src/features/appointments/record-form.tsx`                        |     4 |
| `apps/web/src/features/appointments/schedule-calendar-toolbar.tsx`          |     1 |
| `apps/web/src/features/appointments/schedule-dialog.tsx`                    |    16 |
| `apps/web/src/features/appointments/shared.tsx`                             |     1 |
| `apps/web/src/features/appointments/student-appointment-dialog.tsx`         |     7 |
| `apps/web/src/features/appointments/student-carousel.tsx`                   |     1 |
| `apps/web/src/features/appointments/student-section.tsx`                    |     1 |
| `apps/web/src/features/assessment-files/attachments.tsx`                    |     4 |
| `apps/web/src/features/assessment-files/placement-attachment-dialog.tsx`    |     2 |
| `apps/web/src/features/assessment-files/queue-provider.tsx`                 |     7 |
| `apps/web/src/features/assessments/assessment-entry-dialog.tsx`             |     3 |
| `apps/web/src/features/assessments/assessment-summary.tsx`                  |     3 |
| `apps/web/src/features/assessments/assessment-workspace.tsx`                |     1 |
| `apps/web/src/features/assessments/assessments-page.tsx`                    |     2 |
| `apps/web/src/features/assessments/class-chart.tsx`                         |     1 |
| `apps/web/src/features/assessments/class-performance.tsx`                   |     1 |
| `apps/web/src/features/assessments/confirmation-dialog.tsx`                 |     4 |
| `apps/web/src/features/assessments/progress-chart.tsx`                      |     4 |
| `apps/web/src/features/assessments/results-table.tsx`                       |     7 |
| `apps/web/src/features/assessments/use-assessment-form.ts`                  |     3 |
| `apps/web/src/features/class-organization/agenda.tsx`                       |     1 |
| `apps/web/src/features/class-organization/calendar-forms.tsx`               |     3 |
| `apps/web/src/features/class-organization/calendar.tsx`                     |     1 |
| `apps/web/src/features/class-organization/composition.tsx`                  |     4 |
| `apps/web/src/features/class-organization/continuity.tsx`                   |     4 |
| `apps/web/src/features/class-organization/dialogs.tsx`                      |     5 |
| `apps/web/src/features/class-organization/page.tsx`                         |    10 |
| `apps/web/src/features/class-organization/queue-details.tsx`                |     7 |
| `apps/web/src/features/class-organization/queue.tsx`                        |     7 |
| `apps/web/src/features/class-organization/renewal.tsx`                      |     1 |
| `apps/web/src/features/class-organization/review.tsx`                       |     5 |
| `apps/web/src/features/class-organization/weekly-schedule.tsx`              |     4 |
| `apps/web/src/features/class-records/agenda.tsx`                            |     2 |
| `apps/web/src/features/class-records/calendar-event-filters.tsx`            |     1 |
| `apps/web/src/features/class-records/calendar-experimental-dialog.tsx`      |     3 |
| `apps/web/src/features/class-records/calendar-linked-lesson.tsx`            |     2 |
| `apps/web/src/features/class-records/calendar-teacher-filter.tsx`           |     1 |
| `apps/web/src/features/class-records/calendar-week.tsx`                     |     1 |
| `apps/web/src/features/class-records/calendar.tsx`                          |     5 |
| `apps/web/src/features/class-records/class-record-dialog.tsx`               |     5 |
| `apps/web/src/features/class-records/experimental-lead-details.tsx`         |     2 |
| `apps/web/src/features/class-records/lesson-card-content.tsx`               |     4 |
| `apps/web/src/features/class-records/lesson-details.tsx`                    |     2 |
| `apps/web/src/features/class-records/record-attendance.tsx`                 |     4 |
| `apps/web/src/features/class-records/teacher-agenda-header.tsx`             |     1 |
| `apps/web/src/features/class-records/weekly-calendar.tsx`                   |     2 |
| `apps/web/src/features/class-records/weekly-lesson-content.tsx`             |     5 |
| `apps/web/src/features/classes/class-grade-average.tsx`                     |     1 |
| `apps/web/src/features/classes/class-lessons-dialog.tsx`                    |     5 |
| `apps/web/src/features/classes/class-lessons.tsx`                           |     5 |
| `apps/web/src/features/classes/class-overview.tsx`                          |     2 |
| `apps/web/src/features/classes/class-page.tsx`                              |     2 |
| `apps/web/src/features/classes/class-stage-progress.tsx`                    |     2 |
| `apps/web/src/features/classes/form-controls.tsx`                           |     2 |
| `apps/web/src/features/command-palette/catalog.ts`                          |     2 |
| `apps/web/src/features/command-palette/command-palette.tsx`                 |     3 |
| `apps/web/src/features/command-palette/logic.ts`                            |     1 |
| `apps/web/src/features/contracts/add-contract-material.tsx`                 |     3 |
| `apps/web/src/features/contracts/contract-material-section.tsx`             |     7 |
| `apps/web/src/features/contracts/contract-payment-section.tsx`              |     3 |
| `apps/web/src/features/contracts/new-contract-state.ts`                     |     4 |
| `apps/web/src/features/finance-analytics/chart-shared.tsx`                  |     1 |
| `apps/web/src/features/finance-analytics/contract-closings.tsx`             |     1 |
| `apps/web/src/features/finance-analytics/distribution-charts.tsx`           |     2 |
| `apps/web/src/features/finance-analytics/finance-analytics-page.tsx`        |     1 |
| `apps/web/src/features/installments/installments-page.tsx`                  |     3 |
| `apps/web/src/features/installments/payment/payment-dialog.tsx`             |     1 |
| `apps/web/src/features/installments/payment/payment-summary.tsx`            |     3 |
| `apps/web/src/features/pedagogical-follow-up/action-forms.tsx`              |     2 |
| `apps/web/src/features/pedagogical-follow-up/desk-occurrence.tsx`           |     1 |
| `apps/web/src/features/pedagogical-follow-up/intervention-fields.tsx`       |     1 |
| `apps/web/src/features/pedagogical-follow-up/intervention-occurrences.tsx`  |     1 |
| `apps/web/src/features/pedagogical-follow-up/link-form.tsx`                 |     4 |
| `apps/web/src/features/pedagogical-follow-up/occurrence-form.tsx`           |     6 |
| `apps/web/src/features/pedagogical-follow-up/student-desk-empty.tsx`        |     2 |
| `apps/web/src/features/pedagogical-follow-up/student-desk-rail.tsx`         |     1 |
| `apps/web/src/features/pedagogical-follow-up/student-follow-up.tsx`         |     2 |
| `apps/web/src/features/pedagogical-follow-up/student-intervention-form.tsx` |     2 |
| `apps/web/src/features/semester-organization/action-dialogs.tsx`            |     2 |
| `apps/web/src/features/semester-organization/availability-form.tsx`         |     3 |
| `apps/web/src/features/semester-organization/page.tsx`                      |     9 |
| `apps/web/src/features/semester-organization/placement-form.tsx`            |     5 |
| `apps/web/src/features/semester-organization/plan-form.tsx`                 |     5 |
| `apps/web/src/features/semester-organization/roster.tsx`                    |     4 |
| `apps/web/src/features/semester-organization/shared.tsx`                    |     4 |
| `apps/web/src/features/semester-organization/slot-fields.tsx`               |     2 |
| `apps/web/src/features/semester-organization/student-pool.tsx`              |     3 |
| `apps/web/src/features/settings/settings-model.ts`                          |     3 |
| `apps/web/src/features/settings/settings-panel.tsx`                         |     1 |
| `apps/web/src/features/shared/pending-registration-dialog.tsx`              |     1 |
| `apps/web/src/features/shared/task-form.tsx`                                |     3 |
| `apps/web/src/features/shared/time-field.tsx`                               |     1 |
| `apps/web/src/features/stage-catalog/catalog-list.tsx`                      |     1 |
| `apps/web/src/features/stage-catalog/detail.tsx`                            |     3 |
| `apps/web/src/features/stage-catalog/program-map.tsx`                       |     1 |
| `apps/web/src/features/stage-catalog/stages-page.tsx`                       |     4 |
| `apps/web/src/features/stage-planning/planning-loading.tsx`                 |     1 |
| `apps/web/src/features/stage-planning/planning-page.tsx`                    |     2 |
| `apps/web/src/features/stage-planning/progress-summary.tsx`                 |     1 |
| `apps/web/src/features/stage-planning/record-list.tsx`                      |     1 |
| `apps/web/src/features/stage-planning/shared.tsx`                           |     1 |
| `apps/web/src/features/stage-planning/student-planning.tsx`                 |     2 |
| `apps/web/src/features/stage-planning/teacher-context.tsx`                  |     2 |
| `apps/web/src/features/stage-planning/workspace.tsx`                        |     4 |
| `apps/web/src/features/student-attendance/attendance-review.tsx`            |     6 |
| `apps/web/src/features/student-attendance/student-preview.tsx`              |     1 |
| `apps/web/src/features/student-attendance/teacher-page.tsx`                 |     1 |
| `apps/web/src/features/student-attendance/teacher-preview.tsx`              |     3 |
| `apps/web/src/features/students/new-student/intake-classes.tsx`             |     6 |
| `apps/web/src/features/students/new-student/intake-dialog-chrome.tsx`       |     2 |
| `apps/web/src/features/students/new-student/intake-pedagogy.tsx`            |     2 |
| `apps/web/src/features/students/new-student/new-student-dialog.tsx`         |    13 |
| `apps/web/src/features/students/new-student/pedagogy-step.tsx`              |     2 |
| `apps/web/src/features/students/new-student/student-allocation-dialog.tsx`  |     2 |
| `apps/web/src/features/students/profile/attendance-history-dialog.tsx`      |     6 |
| `apps/web/src/features/students/profile/contract-invoice.tsx`               |     7 |
| `apps/web/src/features/students/profile/contract-termination-dialog.tsx`    |     7 |
| `apps/web/src/features/students/profile/finance-overview.tsx`               |    10 |
| `apps/web/src/features/students/profile/student-assessments-dialog.tsx`     |     2 |
| `apps/web/src/features/students/profile/student-page.tsx`                   |     2 |
| `apps/web/src/features/teacher-workspace/appointments.tsx`                  |     1 |
| `apps/web/src/features/teacher-workspace/classes.tsx`                       |     3 |
| `apps/web/src/features/teacher-workspace/directory.tsx`                     |     1 |
| `apps/web/src/features/teacher-workspace/follow-up.tsx`                     |     2 |
| `apps/web/src/features/teacher-workspace/home-sections.tsx`                 |     1 |
| `apps/web/src/features/teacher-workspace/home.tsx`                          |     4 |
| `apps/web/src/features/teacher-workspace/shared.tsx`                        |     1 |
| `apps/web/src/features/teacher-workspace/students.tsx`                      |     2 |
| `apps/web/src/features/teacher-workspace/visits.tsx`                        |     9 |
| `apps/web/src/features/teachers/departure-impact.tsx`                       |     1 |
| `apps/web/src/features/teachers/teacher-week.tsx`                           |     2 |
| `apps/web/src/features/teachers/week-grid.tsx`                              |     1 |
| `apps/web/src/lib/use-search-draft.ts`                                      |     1 |
| `apps/web/src/proxy.ts`                                                     |     1 |
| `apps/web/test/features/lead-form-contract.unit.test.ts`                    |     1 |
| `packages/api/src/activity/read.ts`                                         |     2 |
| `packages/api/src/activity/record.ts`                                       |     1 |
| `packages/api/src/activity/student-financial-scope.ts`                      |     1 |
| `packages/api/src/admissions/candidates.ts`                                 |     1 |
| `packages/api/src/admissions/capture.ts`                                    |     3 |
| `packages/api/src/admissions/guardian.ts`                                   |     2 |
| `packages/api/src/admissions/placement.ts`                                  |     6 |
| `packages/api/src/admissions/visit-calendar.ts`                             |     2 |
| `packages/api/src/appointments/absences.ts`                                 |     4 |
| `packages/api/src/appointments/availability.ts`                             |     2 |
| `packages/api/src/appointments/commitments.ts`                              |     1 |
| `packages/api/src/appointments/coverage.ts`                                 |     2 |
| `packages/api/src/appointments/legacy.ts`                                   |     1 |
| `packages/api/src/appointments/read.ts`                                     |     7 |
| `packages/api/src/appointments/record.ts`                                   |     4 |
| `packages/api/src/appointments/schedule.ts`                                 |     2 |
| `packages/api/src/appointments/scheduling.ts`                               |     6 |
| `packages/api/src/assessments/data.ts`                                      |     1 |
| `packages/api/src/assessments/read.ts`                                      |     1 |
| `packages/api/src/assessments/rules.ts`                                     |     2 |
| `packages/api/src/attendance/makeup-schedule.ts`                            |     1 |
| `packages/api/src/class-records/experimental-sessions.ts`                   |     1 |
| `packages/api/src/class-records/guests.ts`                                  |     2 |
| `packages/api/src/class-records/progress.ts`                                |     2 |
| `packages/api/src/class-records/read.ts`                                    |     2 |
| `packages/api/src/classes/read.ts`                                          |     2 |
| `packages/api/src/command-search/read.ts`                                   |     3 |
| `packages/api/src/enrollment/scheduled.ts`                                  |     1 |
| `packages/api/src/finance/internal/contract-detail.ts`                      |     4 |
| `packages/api/src/finance/internal/contract-materials.ts`                   |     4 |
| `packages/api/src/finance/internal/contract-termination.ts`                 |     7 |
| `packages/api/src/finance/internal/contracts-select.ts`                     |     2 |
| `packages/api/src/finance/internal/contracts.ts`                            |     3 |
| `packages/api/src/finance/internal/material-needs.ts`                       |     3 |
| `packages/api/src/finance/internal/renewal.ts`                              |     3 |
| `packages/api/src/finance/internal/settings.ts`                             |     1 |
| `packages/api/src/finance/internal/student-summary.ts`                      |     2 |
| `packages/api/src/finance/treatments/index.ts`                              |     8 |
| `packages/api/src/occurrences/sessions.ts`                                  |     3 |
| `packages/api/src/search.ts`                                                |     2 |
| `packages/api/src/semester-organization/commands.ts`                        |     7 |
| `packages/api/src/semester-organization/data.ts`                            |     1 |
| `packages/api/src/semester-organization/intake.ts`                          |     2 |
| `packages/api/src/semester-organization/lifecycle.ts`                       |     3 |
| `packages/api/src/semester-organization/prepare.ts`                         |     4 |
| `packages/api/src/semester-organization/publish.ts`                         |     7 |
| `packages/api/src/semester-organization/queries.ts`                         |    14 |
| `packages/api/src/semester-organization/router.ts`                          |     1 |
| `packages/api/src/semester-organization/student-intake.ts`                  |     4 |
| `packages/api/src/semester-organization/students.ts`                        |     3 |
| `packages/api/src/semester-organization/write.ts`                           |     9 |
| `packages/api/src/session-generation/router.ts`                             |     1 |
| `packages/api/src/stage-planning/program-activity.ts`                       |     1 |
| `packages/api/src/student-attendance/review.ts`                             |     2 |
| `packages/api/src/students/attendance-history.ts`                           |     5 |
| `packages/api/src/students/intake.ts`                                       |    12 |
| `packages/api/src/students/pending-actions.ts`                              |     3 |
| `packages/api/src/teacher-workspace/home-planning.ts`                       |     2 |
| `packages/api/src/teacher-workspace/read.ts`                                |     6 |
| `packages/api/src/teacher-workspace/router.ts`                              |     1 |
| `packages/api/src/teacher-workspace/visits.ts`                              |     3 |
| `packages/api/src/teachers/agenda.ts`                                       |     2 |
| `packages/api/src/teachers/departure.ts`                                    |     1 |
| `packages/api/src/teaching-programs/import.ts`                              |     5 |
| `packages/api/src/teaching-programs/read.ts`                                |     8 |
| `packages/api/test/appointments/appointments.integration.test.ts`           |     1 |
| `packages/api/test/assessments/assessment.integration.test.ts`              |     1 |
| `packages/api/test/attendance/makeup-schedule.integration.test.ts`          |     1 |
| `packages/api/test/finance/contract-materials.integration.test.ts`          |     2 |
| `packages/api/test/finance/settings.transport.test.ts`                      |     1 |
| `packages/api/test/occurrences/follow-up.integration.test.ts`               |     2 |
| `packages/api/test/semester-organization/organization.integration.test.ts`  |     6 |
| `packages/api/test/support/appointment-fixtures.ts`                         |     1 |
| `packages/api/test/trpc/router.unit.test.ts`                                |     1 |

### Bloco 3 congelado — 98 erros em 35 arquivos

| Arquivo relativo a `apps/web`                              | Erros no snapshot |
| ---------------------------------------------------------- | ----------------: |
| `src/features/class-organization/agenda.tsx`               |                 1 |
| `src/features/class-organization/calendar-forms.tsx`       |                 3 |
| `src/features/class-organization/calendar.tsx`             |                 1 |
| `src/features/class-organization/composition.tsx`          |                 3 |
| `src/features/class-organization/continuity.tsx`           |                 3 |
| `src/features/class-organization/dialogs.tsx`              |                 5 |
| `src/features/class-organization/page.tsx`                 |                 7 |
| `src/features/class-organization/queue-details.tsx`        |                 4 |
| `src/features/class-organization/queue.tsx`                |                 7 |
| `src/features/class-organization/renewal.tsx`              |                 1 |
| `src/features/class-organization/review.tsx`               |                 4 |
| `src/features/class-organization/weekly-schedule.tsx`      |                 4 |
| `src/features/classes/class-lessons-dialog.tsx`            |                 4 |
| `src/features/classes/class-lessons.tsx`                   |                 4 |
| `src/features/classes/class-overview.tsx`                  |                 1 |
| `src/features/classes/class-page.tsx`                      |                 2 |
| `src/features/classes/class-stage-progress.tsx`            |                 2 |
| `src/features/classes/form-controls.tsx`                   |                 2 |
| `src/features/semester-organization/action-dialogs.tsx`    |                 2 |
| `src/features/semester-organization/availability-form.tsx` |                 2 |
| `src/features/semester-organization/page.tsx`              |                 7 |
| `src/features/semester-organization/placement-form.tsx`    |                 3 |
| `src/features/semester-organization/plan-form.tsx`         |                 4 |
| `src/features/semester-organization/roster.tsx`            |                 3 |
| `src/features/semester-organization/shared.tsx`            |                 1 |
| `src/features/semester-organization/slot-fields.tsx`       |                 2 |
| `src/features/semester-organization/student-pool.tsx`      |                 3 |
| `src/features/stage-planning/planning-loading.tsx`         |                 1 |
| `src/features/stage-planning/planning-page.tsx`            |                 2 |
| `src/features/stage-planning/progress-summary.tsx`         |                 1 |
| `src/features/stage-planning/record-list.tsx`              |                 1 |
| `src/features/stage-planning/shared.tsx`                   |                 1 |
| `src/features/stage-planning/student-planning.tsx`         |                 2 |
| `src/features/stage-planning/teacher-context.tsx`          |                 2 |
| `src/features/stage-planning/workspace.tsx`                |                 3 |

O lote agrupa organização de turmas, turmas, semestre e planejamento de estágios.
Origem: `/tmp/lazuli-pr207-web-full-after-block2.json`; selecione o bloco seguinte somente
depois de zerar estes diretórios e comparar um novo lint global.

A revisão de alocações e a página principal de organização foram divididas em estado,
controles, corpo e células da tabela, preservando as ações existentes. O lint direcionado
completo dos quatro diretórios passou com **0 erros** em 22/10/2026. Próximo gate:
Web typecheck, testes relevantes, `git diff --check`, `pnpm lint` da raiz e comparação
por fingerprint com `/tmp/lazuli-pr207-web-full-after-block2.json`.

Gate final do bloco 3: `pnpm -F @lazuli/web typecheck` passou;
`pnpm -F @lazuli/web test` passou com 295/295; `git diff --check` passou.
`pnpm lint` da raiz só falhou na API: 230 erros e 15 avisos. O Web completo
foi medido diretamente: **176 erros, 902 avisos**, contra 274 erros e 902 avisos
do snapshot anterior. A comparação multiconjunto por arquivo/regra/mensagem
confirmou **98 removidos e nenhum novo**; total conhecido **406 erros**.
JSON em `/tmp/lazuli-pr207-web-full-after-block3.json`.

## Bloco 4 — escopo congelado

A seleção agrupa rotas de ensino e acompanhamento do professor e as dependências de
presença/catálogo. Inventário por arquivo do snapshot após o bloco 3:

- `class-records/agenda.tsx`: 2
- `class-records/calendar-event-filters.tsx`: 1
- `class-records/calendar-experimental-dialog.tsx`: 2
- `class-records/calendar-linked-lesson.tsx`: 1
- `class-records/calendar-teacher-filter.tsx`: 1
- `class-records/calendar-week.tsx`: 1
- `class-records/calendar.tsx`: 3
- `class-records/class-record-dialog.tsx`: 4
- `class-records/experimental-lead-details.tsx`: 2
- `class-records/lesson-card-content.tsx`: 2
- `class-records/lesson-details.tsx`: 2
- `class-records/record-attendance.tsx`: 3
- `class-records/teacher-agenda-header.tsx`: 1
- `class-records/weekly-calendar.tsx`: 2
- `class-records/weekly-lesson-content.tsx`: 3
- `pedagogical-follow-up/action-forms.tsx`: 2
- `pedagogical-follow-up/desk-occurrence.tsx`: 1
- `pedagogical-follow-up/intervention-fields.tsx`: 1
- `pedagogical-follow-up/intervention-occurrences.tsx`: 1
- `pedagogical-follow-up/link-form.tsx`: 3
- `pedagogical-follow-up/occurrence-form.tsx`: 5
- `pedagogical-follow-up/student-desk-empty.tsx`: 2
- `pedagogical-follow-up/student-desk-rail.tsx`: 1
- `pedagogical-follow-up/student-follow-up.tsx`: 2
- `pedagogical-follow-up/student-intervention-form.tsx`: 2
- `stage-catalog/catalog-list.tsx`: 1
- `stage-catalog/detail.tsx`: 3
- `stage-catalog/program-map.tsx`: 1
- `stage-catalog/stages-page.tsx`: 3
- `student-attendance/attendance-review.tsx`: 4
- `student-attendance/student-preview.tsx`: 1
- `student-attendance/teacher-page.tsx`: 1
- `student-attendance/teacher-preview.tsx`: 3
- `teacher-workspace/appointments.tsx`: 1
- `teacher-workspace/classes.tsx`: 3
- `teacher-workspace/directory.tsx`: 1
- `teacher-workspace/follow-up.tsx`: 2
- `teacher-workspace/home-sections.tsx`: 1
- `teacher-workspace/home.tsx`: 3
- `teacher-workspace/shared.tsx`: 1
- `teacher-workspace/students.tsx`: 2
- `teacher-workspace/visits.tsx`: 8
- `teachers/departure-impact.tsx`: 1
- `teachers/teacher-week.tsx`: 2
- `teachers/week-grid.tsx`: 1

**Total: 93 erros.** Nenhum arquivo fora desses seis diretórios faz parte do lote.

Bloco 4: `teacher-workspace/shared.tsx`, `directory.tsx` e `home-sections.tsx`
passaram no lint direcionado e no typecheck. O lint dos seis diretórios mediu
**90 erros restantes**; JSON em `/tmp/lazuli-pr207-block4-current.json`.

`teacher-workspace/appointments.tsx`, `follow-up.tsx` e
`teachers/departure-impact.tsx` também zeraram no lint direcionado; o typecheck
continuou verde. Lint dos seis diretórios: **86 erros restantes** no bloco 4,
medidos em `/tmp/lazuli-pr207-block4-current.json`.

`stage-catalog/catalog-list.tsx`, `program-map.tsx`, `stages-page.tsx` e
`detail.tsx`, mais `teachers/teacher-week.tsx`, passaram no lint e no typecheck.
O lint dos seis diretórios mediu **76 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`student-attendance/student-preview.tsx`, `teacher-page.tsx` e
`class-records/calendar-event-filters.tsx` passaram no lint direcionado;
typecheck do Web verde. Lint dos seis diretórios: **73 erros restantes**,
medidos em `/tmp/lazuli-pr207-block4-current.json`.

`class-records/calendar-teacher-filter.tsx` e `calendar-linked-lesson.tsx`
passaram no lint direcionado e no typecheck. Lint dos seis diretórios:
**71 erros restantes** em `/tmp/lazuli-pr207-block4-current.json`.

`teacher-workspace/classes.tsx` foi separado em abas, lista de aulas e lista de alunos;
os dois arquivos passam no lint direcionado e no typecheck. O lint completo dos seis
diretórios mediu **61 erros restantes**. Além dos três erros dessa tela, a medição
absorveu sete correções já presentes no workspace em `class-records/weekly-calendar.tsx`,
`weekly-lesson-content.tsx` e `lesson-card-content.tsx`; não atribuir essas sete à edição
de turmas. JSON atualizado em `/tmp/lazuli-pr207-block4-current.json`.

`teacher-workspace/students.tsx` foi separado em abas, lista de presenças, planejamento
e avaliações. Os dois arquivos passam no lint direcionado e no typecheck. O lint dos seis
diretórios mediu **59 erros restantes** em `/tmp/lazuli-pr207-block4-current.json`.

`teachers/week-grid.tsx` foi dividido em grade desktop, linhas/células e lista móvel;
passou no lint direcionado e no typecheck do Web. O lint dos seis diretórios mediu
**58 erros restantes** em `/tmp/lazuli-pr207-block4-current.json`.

`teacher-workspace/home.tsx` foi dividido em colunas, estados de carregamento e itens
do resumo; passou no lint direcionado e no typecheck do Web. O lint dos seis diretórios
mediu **55 erros restantes** em `/tmp/lazuli-pr207-block4-current.json`.

`teacher-workspace/visits.tsx` foi dividido em lista, comparecimento e fluxo de
nivelamento; o download de provas reutiliza o helper existente que preserva a revogação
da URL temporária. Os dois arquivos passam no lint direcionado e no typecheck do Web.
O lint dos seis diretórios mediu **47 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`class-records/lesson-details.tsx`, `calendar-week.tsx` e
`teacher-agenda-header.tsx` foram divididos em componentes menores; cada arquivo
passa no lint direcionado e o typecheck do Web está verde. O lint dos seis
diretórios mediu **43 erros restantes** em `/tmp/lazuli-pr207-block4-current.json`.

`pedagogical-follow-up/action-forms.tsx`, `desk-occurrence.tsx`,
`intervention-fields.tsx` e `student-desk-rail.tsx` foram divididos em funções
menores, preservando os formulários e ações. O lint direcionado e o typecheck do
Web passaram. A medição dos seis diretórios confirmou **38 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`pedagogical-follow-up/student-desk-empty.tsx` e `student-follow-up.tsx`
foram separados em seleção, estados vazios e detalhe; lint direcionado e
typecheck do Web passaram. O lint dos seis diretórios confirmou **34 erros
restantes** em `/tmp/lazuli-pr207-block4-current.json`.

`pedagogical-follow-up/intervention-occurrences.tsx` foi dividido com
`intervention-occurrence-results.tsx` em busca, lista e item, mantendo a seleção
e a rolagem para o vínculo inicial. Lint direcionado e typecheck do Web passaram;
o lint dos seis diretórios mediu **33 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`class-records/record-attendance.tsx` foi dividido em cabeçalho, resumo,
filtros, lista e estado vazio. O lint direcionado e o typecheck do Web passaram;
o lint dos seis diretórios confirmou **30 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`class-records/experimental-lead-details.tsx` foi dividido em perfil, contato
e links de telefone/e-mail; lint direcionado e typecheck do Web passaram. O lint
dos seis diretórios confirmou **28 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`class-records/class-record-dialog.tsx` foi dividido em painel, corpo, ações
e contexto da aula. Lint direcionado e typecheck do Web passaram; o lint dos
seis diretórios confirmou **24 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`student-attendance/teacher-preview.tsx` foi separado em estado da chamada,
compartilhamento e apresentação. A comunicação entre abas usa
`addEventListener` com evento tipado. Lint direcionado e typecheck do Web
passaram; o lint dos seis diretórios confirmou **21 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`class-records/agenda.tsx` foi dividido em parâmetros da rota, consultas e
apresentação do calendário. Lint direcionado e typecheck do Web passaram; o
lint dos seis diretórios confirmou **19 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`student-attendance/attendance-review.tsx` foi dividido em preparação das
linhas, formulário, lista, estados e confirmação; a saída e as ações foram
preservadas. Lint direcionado e typecheck do Web passaram. O lint dos seis
diretórios confirmou **15 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`pedagogical-follow-up/student-intervention-form.tsx` foi dividido em estado,
envio, seleção de ocorrências e campos da tratativa. Lint direcionado e
typecheck do Web passaram; o lint dos seis diretórios confirmou **13 erros
restantes** em `/tmp/lazuli-pr207-block4-current.json`.

`pedagogical-follow-up/link-form.tsx` foi dividido em consulta/filtros,
mutações, busca, resultados e seleção; lint direcionado e typecheck do Web
passaram. O lint dos seis diretórios confirmou **10 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`.

`pedagogical-follow-up/occurrence-form.tsx` foi dividido em modelo, calendário
e campos. Os quatro arquivos passam no lint direcionado e no typecheck do Web.
O lint dos seis diretórios mediu **5 erros restantes** em
`/tmp/lazuli-pr207-block4-current.json`: 2 em `calendar-experimental-dialog.tsx`
e 3 em `calendar.tsx`.

`class-records/calendar-experimental-dialog.tsx` foi dividido em diálogo,
fatos, notas e ações, mantendo edição do lead e comparecimento. Lint direcionado
e typecheck do Web passaram; o lint dos seis diretórios mediu **3 erros
restantes**, todos em `class-records/calendar.tsx`, no mesmo JSON.

`class-records/calendar.tsx` foi dividido em estado, filtros, controles,
calendário e diálogos. O lint direcionado dos **149 arquivos** nos seis
diretórios passou com **0 erros** e 192 avisos; typecheck do Web verde. Faltam
testes relevantes, inspeção do diff, `pnpm lint` da raiz e comparação global
com o snapshot após o bloco 3 para fechar este lote.

Gate do bloco 4 concluído: `pnpm -F @lazuli/web test` passou com **295 testes,
0 falhas**; o typecheck do Web e `git diff --check` passaram. O lint direcionado
continua em **0 erros** após a revisão final. `pnpm lint` da raiz falhou nos
**230 erros conhecidos da API** e interrompeu o Web via Turbo; o lint Web completo
foi executado diretamente em `/tmp/lazuli-pr207-web-full-after-block4.json`.
Web: **176 → 83 erros** e **902 → 903 avisos**. Comparação multiconjunto por
arquivo/regra/mensagem: **93 erros removidos, 0 novos**. API sem arquivos
alterados no bloco: **230 erros**. Total conhecido: **406 → 313**. Bloco 4
fechado. O diff das extrações finais de calendário e ocorrência foi revisado;
as correções permanecem locais, sem publicação.

## Bloco 5 — escopo congelado

Os **83 erros restantes do Web** formam o lote final do Web. O inventário abaixo
vem do mesmo lint completo que fechou o bloco 4. Inclui as telas de admissão,
entrada e navegação e as pequenas sobras do Web. Erros da API ficam fora deste
lote. Não usar `--fix`.

| Arquivo relativo a `apps/web`                           | Erros no snapshot |
| ------------------------------------------------------- | ----------------: |
| `src/app/(app)/professor/layout.tsx`                    |                 1 |
| `src/app/login/login-card.tsx`                          |                 2 |
| `src/app/login/login-entrance.tsx`                      |                 1 |
| `src/components/app-shell/account-menu.tsx`             |                 5 |
| `src/components/app-shell/admin-mobile-notice.tsx`      |                 1 |
| `src/components/app-shell/mobile-navigation.tsx`        |                 1 |
| `src/features/admissions/admissions-page.tsx`           |                 1 |
| `src/features/admissions/candidate-allocation.tsx`      |                 1 |
| `src/features/admissions/candidate-page.tsx`            |                 2 |
| `src/features/admissions/candidate-visits.tsx`          |                 5 |
| `src/features/admissions/enroll-dialog.tsx`             |                 2 |
| `src/features/admissions/intake-fields.tsx`             |                 1 |
| `src/features/admissions/lead-capture-dialog.tsx`       |                 4 |
| `src/features/admissions/lead-context.tsx`              |                 2 |
| `src/features/admissions/lead-form.tsx`                 |                 2 |
| `src/features/admissions/matching-classes.tsx`          |                 1 |
| `src/features/admissions/pending-allocation.tsx`        |                 1 |
| `src/features/admissions/placement-assessment.tsx`      |                11 |
| `src/features/admissions/placement-schedule.tsx`        |                 7 |
| `src/features/admissions/use-candidate-form.ts`         |                 4 |
| `src/features/admissions/visit-dialog.tsx`              |                 6 |
| `src/features/command-palette/catalog.ts`               |                 2 |
| `src/features/command-palette/command-palette.tsx`      |                 2 |
| `src/features/command-palette/logic.ts`                 |                 1 |
| `src/features/installments/installments-page.tsx`       |                 3 |
| `src/features/installments/payment/payment-dialog.tsx`  |                 1 |
| `src/features/installments/payment/payment-summary.tsx` |                 2 |
| `src/features/settings/settings-model.ts`               |                 2 |
| `src/features/settings/settings-panel.tsx`              |                 1 |
| `src/features/shared/pending-registration-dialog.tsx`   |                 1 |
| `src/features/shared/task-form.tsx`                     |                 3 |
| `src/features/shared/time-field.tsx`                    |                 1 |
| `src/lib/use-search-draft.ts`                           |                 1 |
| `src/proxy.ts`                                          |                 1 |
| `test/features/lead-form-contract.unit.test.ts`         |                 1 |

Primeira rodada do bloco 5: `professor/layout.tsx`, `admin-mobile-notice.tsx` e
`mobile-navigation.tsx` passaram no lint direcionado; o typecheck do Web passou.
O lint de toda a área congelada mediu **80 erros restantes** e 149 avisos em
`/tmp/lazuli-pr207-block5-current.json`. O total global projetado é **310**
(Web 80 + API 230), sujeito ao gate completo do bloco.

`command-palette/catalog.ts` foi separado em comandos de aluno e ícones de
páginas; `logic.ts` e `proxy.ts` agora têm tipos de retorno explícitos. Os três
arquivos passam no lint direcionado, o typecheck do Web está verde e a medição
de toda a área confirmou **76 erros restantes** (149 avisos) no mesmo JSON.
O total global projetado é **306** (Web 76 + API 230), ainda sujeito ao gate.

`login-card.tsx` e `login-entrance.tsx` foram divididos em estado, formulário e
efeito de entrada. `account-menu.tsx` foi dividido em gatilho, painel, perfis e
saída; as classes dos componentes compartilhados agora são estáticas, com os
seletores de estado preservados no CSS do menu. Lint dos três arquivos e
typecheck do Web passaram. O lint direcionado da área completa mediu **68 erros
restantes** (149 avisos) em `/tmp/lazuli-pr207-block5-current.json`. Total
global projetado: **298** (Web 68 + API 230), sujeito ao gate.

`settings-model.ts` foi separado em carregamento financeiro/material e validações
de parcela, percentual e valor; `settings-panel.tsx`, o diálogo de pendências e
o campo de horário foram divididos sem mudar os resultados. Os quatro arquivos
passam no lint direcionado e o typecheck do Web passou. O lint de toda a área
mediu **63 erros restantes** (149 avisos) no mesmo JSON. Total global projetado:
**293** (Web 63 + API 230), sujeito ao gate.

`installments/payment/payment-dialog.tsx` e `payment-summary.tsx` foram
divididos em mensagem, totais e apresentação do resumo. Lint direcionado e
typecheck do Web passaram. A área completa mediu **60 erros restantes**
(149 avisos) no mesmo JSON; total global projetado **290** (Web 60 + API 230),
sujeito ao gate.

`installments/installments-page.tsx` foi separado em filtros, seleção, visualização
e diálogos. O lint direcionado dos arquivos de recebíveis e o typecheck do Web
passaram. A suíte Web completa passou com **295 testes, 0 falhas**. O lint de
toda a área congelada mediu **57 erros restantes** (149 avisos) no mesmo JSON;
total global projetado **287** (Web 57 + API 230), sujeito ao gate.

`admissions/admissions-page.tsx`, `intake-fields.tsx`, `matching-classes.tsx`,
`candidate-allocation.tsx` e `enroll-dialog.tsx` passaram no lint direcionado e
no typecheck do Web. A medição da área completa confirmou **51 erros restantes**
em `/tmp/lazuli-pr207-block5-current.json`; total global projetado **281**
(Web 51 + API 230), sujeito ao gate.

`lib/use-search-draft.ts`, o contrato de formulário de lead, `admissions/lead-form.tsx`
e `pending-allocation.tsx` passaram no lint direcionado; o typecheck do Web e
os dois testes focados de contato de lead passaram. A medição do lote completo
confirmou **46 erros restantes** (149 avisos) no mesmo JSON. Total global
projetado **276** (Web 46 + API 230), sujeito ao gate.

`admissions/use-candidate-form.ts`, `candidate-dialog.tsx`, `candidate-page.tsx`
e `candidate-visits.tsx` passaram no lint direcionado e no typecheck do Web.
A medição da área completa confirmou **35 erros restantes** em
`/tmp/lazuli-pr207-block5-current.json`; total global projetado **265**
(Web 35 + API 230), sujeito ao gate. Restam 30 erros em admissão e 5 em
`command-palette`/`shared`.

`admissions/lead-context.tsx` e `command-palette/command-palette.tsx` passaram
no lint direcionado e no typecheck do Web. A área congelada mediu **31 erros
restantes** em `/tmp/lazuli-pr207-block5-current.json`; total global projetado
**261** (Web 31 + API 230), sujeito ao gate. Os cinco arquivos restantes são
quatro diálogos de admissão (28 erros) e `shared/task-form.tsx` (3 erros).

Na pausa, `pnpm lint` da raiz confirmou **230 erros na API** e interrompeu o Web
antes do fim. O lint Web completo foi executado à parte após a formatação:
**31 erros**, todos nos cinco arquivos pendentes acima. Comparado por
arquivo/regra/mensagem com `/tmp/lazuli-pr207-web-full-after-block4.json`,
o snapshot `/tmp/lazuli-pr207-web-full-pause-final.json` mostra **52 erros
resolvidos e 0 novos fingerprints**. Total global medido: **261 erros**
(Web 31 + API 230). O typecheck do Web passou. A suíte Web da pausa passou
com **295 testes, 0 falhas**; log em `/tmp/lazuli-pr207-web-test-pause.log`.
O hook de pré-commit executou Prettier e reintroduziu 21 erros de ternários;
os parênteses exigidos pelo ESLint foram restaurados na emenda do mesmo
commit. Ver o conflito e a instrução de retomada no handoff.

## Bloco 6 — ativo em paralelo, ainda sem correções

O dono autorizou o segundo agente a trabalhar neste bloco em paralelo ao
bloco 5. Estes **100 erros da API** foram selecionados do snapshot
`/tmp/lazuli-pr207-api-full-after-students.json`;
nenhum arquivo da API foi alterado desde esse snapshot, e o lint da raiz
confirmou os mesmos 230 erros. Cada agente fecha seu próprio bloco; o último
a terminar confere o lint global combinado.

| Arquivo relativo a `packages/api`                             | Erros no snapshot |
| ------------------------------------------------------------- | ----------------: |
| `src/classes/read.ts`                                         |                 2 |
| `src/enrollment/scheduled.ts`                                 |                 1 |
| `src/semester-organization/commands.ts`                       |                 7 |
| `src/semester-organization/data.ts`                           |                 1 |
| `src/semester-organization/intake.ts`                         |                 2 |
| `src/semester-organization/lifecycle.ts`                      |                 3 |
| `src/semester-organization/prepare.ts`                        |                 4 |
| `src/semester-organization/publish.ts`                        |                 7 |
| `src/semester-organization/queries.ts`                        |                14 |
| `src/semester-organization/router.ts`                         |                 1 |
| `src/semester-organization/student-intake.ts`                 |                 4 |
| `src/semester-organization/students.ts`                       |                 3 |
| `src/semester-organization/write.ts`                          |                 9 |
| `src/session-generation/router.ts`                            |                 1 |
| `src/stage-planning/program-activity.ts`                      |                 1 |
| `src/student-attendance/review.ts`                            |                 2 |
| `src/students/attendance-history.ts`                          |                 5 |
| `src/students/intake.ts`                                      |                12 |
| `src/students/pending-actions.ts`                             |                 3 |
| `src/teacher-workspace/home-planning.ts`                      |                 2 |
| `src/teacher-workspace/read.ts`                               |                 6 |
| `src/teacher-workspace/router.ts`                             |                 1 |
| `src/teacher-workspace/visits.ts`                             |                 3 |
| `test/semester-organization/organization.integration.test.ts` |                 6 |

Comando direcionado: `pnpm -F @lazuli/api exec eslint src/classes src/enrollment src/semester-organization src/session-generation src/stage-planning src/student-attendance src/students src/teacher-workspace test/semester-organization/organization.integration.test.ts -f json > /tmp/lazuli-pr207-block6-current.json`.
