# PR #207 — um bloco por agente na mesma worktree

> **BLOCOS ATIVOS EM PARALELO:** bloco 5, Web, **31 erros**; bloco 6, API,
> **100 erros selecionados** dos 230 da API. O dono autorizou esta exceção à
> sequência normal dos lotes. Antes de editar, inclusive após compactação,
> cada agente lê este arquivo, o [handoff](pr207-lint-handoff.md), o
> [progresso](pr207-lint-progress.md) e **as duas fichas**. Cada agente fecha
> seu próprio bloco; o último a terminar confere o lint global combinado.

- Worktree única: `/Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica`.
- Baseline de código: `c631cf3`; Web 31 + API 230 = **261 erros**.
- Protocolo: [shared-lint-worktree](../../.codex/skills/shared-lint-worktree/SKILL.md).

| Agente                        | Bloco e arquivos próprios                                                                      | Erros do bloco | Ficha                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | -------------: | --------------------------------------- |
| `web-block5` (este agente)    | Os cinco arquivos Web ainda com erro, listados no [handoff](pr207-lint-handoff.md)             |             31 | [Web 5](pr207-lint-agent-web-block5.md) |
| `api-block6` (segundo agente) | Os 24 arquivos da API listados em “Bloco 6 — reservado” no [progresso](pr207-lint-progress.md) |            100 | [API 6](pr207-lint-agent-api-block6.md) |

Cada agente edita e commita somente os arquivos do próprio bloco, com caminhos
explícitos. Para alterar testes/dependências fora desses inventários, os dois
acertam a posse e atualizam este arquivo antes da edição. O bloco 6 pode
começar agora; não precisa esperar o gate do bloco 5. Após ambos os gates, o
último a terminar roda o lint da raiz e registra o saldo combinado.
