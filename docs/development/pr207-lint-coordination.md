# PR #207 — um bloco por agente na mesma worktree

> **BLOCO ATIVO:** `api-block7`, 100 erros iniciais em 30 arquivos da API,
> **50 restantes** após zerar `admissions`, `class-records` e `appointments`. Inventário no
> [progresso](pr207-lint-progress.md). O agente do bloco 6 também fechou o
> bloco 5 Web após o rate-limit do outro agente. O Web completo tem 0 erros;
> a API tinha 130 no baseline, sendo 30 fora do bloco 7. O dono pediu continuar até o lint
> da worktree ficar verde.
> Antes de editar, inclusive após compactação,
> cada agente lê este arquivo, o [handoff](pr207-lint-handoff.md), o
> [progresso](pr207-lint-progress.md) e **as duas fichas**. Cada agente fecha
> seu próprio bloco; o último a terminar confere o lint global combinado.

- Worktree única: `/Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica`.
- Baseline de código: `c631cf3`; Web 31 + API 230 = **261 erros**.
- Protocolo: [shared-lint-worktree](../../.codex/skills/shared-lint-worktree/SKILL.md).

| Agente                                         | Bloco e arquivos próprios                                                                                                                                                                                                    | Erros do bloco | Ficha                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------: | --------------------------------------- |
| `web-block5` (assumido pelo agente do bloco 6) | Os cinco arquivos Web listados no [handoff](pr207-lint-handoff.md), mais as extrações próprias `admissions/placement-visit-details.tsx`, `admissions/placement-schedule-view.tsx` e `admissions/trial-visit-dialog-view.tsx` |     0 no bloco | [Web 5](pr207-lint-agent-web-block5.md) |
| `api-block6` (fechado)                         | Os 24 arquivos da API listados em “Bloco 6” no [progresso](pr207-lint-progress.md)                                                                                                                                           |     0 no bloco | [API 6](pr207-lint-agent-api-block6.md) |
| `api-block7` (ativo)                           | Os 30 arquivos de `src/admissions`, `appointments`, `class-records`, `finance` e `teaching-programs` listados em “Bloco 7” no [progresso](pr207-lint-progress.md)                                                            |    50 no bloco | [API 7](pr207-lint-agent-api-block7.md) |

O agente que assumiu o bloco 5 edita e commita somente seu inventário Web,
com caminhos explícitos. `trial-visit-dialog-view.tsx` foi reservado para
separar a apresentação do estado e das ações do diálogo de experimental.
Para corrigir os três erros de classes dinâmicas em `shared/task-form.tsx`,
também ficam reservados estes consumidores, cujas props de estilo passam a
variantes nomeadas: `appointments/schedule-dialog.tsx`,
`pedagogical-follow-up/occurrence-form.tsx`,
`students/profile/contract-termination-view.tsx` e
`semester-organization/placement-form.tsx`.
Antes de acrescentar outras extrações ou testes, registrar os caminhos aqui.
O gate do bloco 5 e o lint da raiz foram executados. O saldo combinado é de
130 erros, todos na API e fora do bloco 6.
