# PR #207 — ficha `web-block9`

> **FECHADO LOCALMENTE:** gate de push, violação de tamanho resolvida e 0
> erros de lint. Inventário congelado:
> `apps/web/src/features/installments/installments-page.tsx` (655 → **642**
> linhas; máximo 650) e `apps/web/src/features/installments/filters.ts`.
> Lint direcionado: 0 erros, 8 avisos; typecheck Web e 295/295 testes Web
> passaram; `pnpm test:component-lines` passou. Lint da raiz: 16/16 tarefas,
> 0 erros, Web com os mesmos 932 avisos do baseline. Próxima ação: commit,
> gate de pre-push e push.

- O bloco 8 e o lint global estão fechados em `7981b9d` com 0 erros. A branch
  está 19 commits à frente do remoto; a tentativa de push foi barrada apenas
  pelo limite de 650 linhas no componente de recebíveis. A worktree estava
  limpa antes deste bloco.
- A coordenação, o progresso, o handoff, as fichas API 6/API 8 e Web 5,
  `AGENTS.md`, `docs/frontend/README.md` e `docs/testing/README.md` foram
  consultados. Não há outro agente ativo.
- `hasInstallmentFilters` foi movido, sem alteração de lógica, para o módulo
  `filters.ts`, que já concentra a normalização dos filtros. Prettier passou
  nos arquivos alterados; `git diff --check` passou. O componente ficou com
  642 linhas.
- Lint dos dois arquivos: 0 erros, 8 avisos
  (`/tmp/lazuli-pr207-block9-targeted.json`). Typecheck Web passou; teste Web
  passou com 295/295 (`/tmp/lazuli-pr207-block9-web-test.log`).
  `pnpm test:component-lines` passou.
- `pnpm lint` da raiz passou com 16/16 tarefas e 0 erros. O Web manteve 932
  avisos não bloqueantes, sem novos erros. Log:
  `/tmp/lazuli-pr207-root-after-block9.log`.
