# PR #207 — ficha `web-block10`

> **FECHADO LOCALMENTE:** 10 falhas de `format:check` no CI estático, 0 erros de lint no
> mesmo job. Inventário congelado no [progresso](pr207-lint-progress.md):
> dez arquivos Web e esta ficha. Os dez foram refatorados para remover os
> ternários aninhados incompatíveis com Prettier. Lint direcionado: **0 erros**,
> 12 avisos; formatação de 1.586 arquivos versionados/novos passou. Typecheck
> Web, testes Web 295/295 e limite de componentes passaram. O primeiro lint
> global final passou com 16/16 tarefas, 0 erros e os mesmos 932 avisos Web do
> baseline. Próxima ação: commit e push; depois continuar `$babysit-pr`.

- PR #207 no head `54c7613`; job estático
  `https://github.com/josiasrfreitas/lazuli/actions/runs/39852260418/job/120081256890`.
  O único passo com falha no log é `pnpm format:check`, que listou os dez
  arquivos congelados. O lint do job reportou 0 erros.
- Bloco 9 e hook de pre-push passaram; push de 20 commits entrou no PR.
- O handoff alerta para possível conflito entre Prettier e
  `unicorn/no-nested-ternary`. Comparar os diffs e preservar ambas as regras.
- Os diffs do Prettier confirmaram apenas a remoção dos parênteses de dez
  ternários aninhados. Cada caso foi convertido em condição explícita ou
  lookup, preservando texto e estados. Prettier dos arquivos e
  `git diff --check` passaram. O primeiro lint direcionado apontou 2 erros
  introduzidos pela refatoração (`max-params` e `max-lines-per-function`),
  corrigidos antes do próximo gate. Snapshot:
  `/tmp/lazuli-pr207-block10-targeted.json`.
- Lint direcionado final: 0 erros, 12 avisos
  (`/tmp/lazuli-pr207-block10-targeted-final.json`). O `pnpm format:check`
  local encontra apenas dois JSONs ignorados pelo Git em `.impeccable/live`;
  ambos estão ausentes do checkout do CI. A checagem equivalente sobre 1.586
  arquivos versionados/novos passou (`/tmp/lazuli-pr207-block10-tracked-format.log`).
  Typecheck Web e testes Web 295/295 passaram, assim como
  `pnpm test:component-lines` e `git diff --check`.
- Primeiro `pnpm lint` após a correção: 16/16 tarefas, 0 erros; Web 933 avisos
  contra 932 no baseline. O aviso novo era `security/detect-object-injection`
  no acesso a `STEP_INDEX[step]`. O acesso foi substituído por `stepIndex` com
  três retornos explícitos; lint do arquivo: 0 erros, 3 avisos anteriores.
- Lint global final passou com 16/16 tarefas, 0 erros e Web com 932 avisos,
  igual ao baseline. Log: `/tmp/lazuli-pr207-root-after-block10-final.log`.
