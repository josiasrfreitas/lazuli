# PR #207 — ficha `web-block5`

> **FECHADO:** o lint direcionado do bloco 5 e seus quatro
> consumidores tem **0 erros**, 184 avisos em 139 arquivos. O lint Web
> completo tem **0 erros**, 932 avisos. Comparado ao snapshot anterior,
> foram removidos 31 erros, sem novos fingerprints por arquivo/regra/mensagem.
> O typecheck Web e os 295 testes unitários passaram. O lint da raiz confirmou
> 130 erros na API fora do bloco 6 e interrompeu a etapa Web do Turbo.

- O agente do bloco 6 assumiu este bloco após o rate-limit do agente Web.
  Os commits anteriores do bloco são `e37ab94` (lead) e `49e387c`
  (nivelamento).
- Inventário próprio: os cinco arquivos do [handoff](pr207-lint-handoff.md),
  as extrações `admissions/placement-visit-details.tsx`,
  `admissions/placement-schedule-view.tsx` e
  `admissions/trial-visit-dialog-view.tsx`, mais quatro consumidores de
  `shared/task-form.tsx` registrados na [coordenação](pr207-lint-coordination.md).
- `placement-schedule.tsx` e `visit-dialog.tsx` foram divididos entre estado,
  validação, ações e apresentação. `task-form.tsx` passou a usar variantes
  estáticas para o tamanho e a disposição do diálogo, com os consumidores
  adaptados.
- Lint direcionado: `/tmp/lazuli-pr207-block5-current.json`. Lint Web
  completo: `/tmp/lazuli-pr207-web-full-block5.json`; baseline:
  `/tmp/lazuli-pr207-web-full-pause-final.json`.
- `git diff --check` passou. O teste unitário Web terminou com 295/295
  (`/tmp/lazuli-pr207-block5-web-tests.log`).
