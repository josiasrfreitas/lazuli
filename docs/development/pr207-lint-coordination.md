# PR #207 — duas metades na mesma worktree

> **BLOCO ATIVO: 5.** Restam **31 erros Web** em cinco arquivos. O bloco 6 da
> API (100 erros) está apenas reservado em [pr207-lint-progress.md](pr207-lint-progress.md).
> Antes de editar, inclusive após compactação, cada agente lê este arquivo,
> o [handoff](pr207-lint-handoff.md), o progresso e **as duas fichas**. O gate
> do bloco 5 é lint direcionado zero, tipos/testes pertinentes, lint completo
> e comparação de fingerprints. Nenhuma metade inicia o bloco 6 antes do gate.

- Worktree única: `/Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica`.
- Baseline de código: `c631cf3`; Web 31 + API 230 = **261 erros**.
- Protocolo: [shared-lint-worktree](../../.codex/skills/shared-lint-worktree/SKILL.md).

| Metade      | Arquivos próprios                                                                                                                                                           | Erros no baseline | Ficha                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------: | ------------------------------------------ |
| `leads`     | `apps/web/src/features/admissions/lead-capture-dialog.tsx`; `apps/web/src/features/shared/task-form.tsx`                                                                    |                 7 | [leads](pr207-lint-agent-leads.md)         |
| `placement` | `apps/web/src/features/admissions/placement-assessment.tsx`; `apps/web/src/features/admissions/placement-schedule.tsx`; `apps/web/src/features/admissions/visit-dialog.tsx` |                24 | [placement](pr207-lint-agent-placement.md) |

Cada agente cuida e commita apenas a sua metade, com caminhos explícitos. Para
alterar testes/dependências fora da tabela, os dois acertam a posse e atualizam
este arquivo primeiro. O último a terminar executa o gate do bloco completo;
se houver regressão, cada agente corrige seus próprios arquivos.
