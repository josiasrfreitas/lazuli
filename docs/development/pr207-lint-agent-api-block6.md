# PR #207 — ficha `api-block6`

> **FOCO:** bloco 6 API, **100 erros** selecionados dos 230 da API no baseline
> `c631cf3`. Os **24 arquivos próprios** e o comando direcionado estão em
> “Bloco 6 — reservado” no [progresso](pr207-lint-progress.md). Próxima ação:
> corrigir os 24 arquivos; lint exato após Prettier: **0 erros** em
> `/tmp/lazuli-pr207-block6-owned.json`; typecheck API passou. Próxima ação:
> lint API completo confirmou **130 erros restantes, 100 resolvidos e 0 novos
> fingerprints** contra o baseline de 230. Unit API passou 88/88. Próxima
> **BLOCO 6 PRONTO PARA COMMIT:** lint dos 24 arquivos **0 erros**, API
> completa **130 erros antigos, 0 novos fingerprints** (100 removidos).
> Typecheck, 88 testes unitários, 314 integrações e qualidade do teste passaram.
> Próxima ação: commit dos 24 arquivos próprios e desta ficha; depois, o bloco
> 5 Web pendente e o lint combinado da raiz.

- Estado: em edição pelo agente `api-block6`; coordenação, handoff, progresso, ambas as fichas,
  `AGENTS.md`, `shared-lint-worktree`, `big-lint-resolver` e Git lidos antes da edição.
- Arquivos próprios: os 24 caminhos de `packages/api` enumerados em “Bloco 6 — ativo em
  paralelo” no progresso; esta ficha é o único documento próprio.
- Último resultado: 0 erros e 2 avisos nos 24 arquivos próprios; API completo
  230 no baseline. Redução medida de 100 erros. Typecheck API passou antes
  das últimas correções e será repetido após a formatação.
- Alterados neste bloco: `enrollment/scheduled.ts`, `session-generation/router.ts`,
  `stage-planning/program-activity.ts`, `student-attendance/review.ts`,
  `semester-organization/data.ts`, `semester-organization/router.ts`,
  `semester-organization/lifecycle.ts`, `classes/read.ts`,
  `semester-organization/commands.ts`, `semester-organization/intake.ts`,
  `semester-organization/write.ts`,
  `semester-organization/queries.ts`,
  `students/attendance-history.ts`, `students/pending-actions.ts`,
  `semester-organization/student-intake.ts`,
  `semester-organization/prepare.ts`, `semester-organization/publish.ts`,
  `semester-organization/students.ts`,
  `students/intake.ts`,
  `teacher-workspace/read.ts` e `test/semester-organization/organization.integration.test.ts`,
  `teacher-workspace/home-planning.ts`, `teacher-workspace/router.ts` e
  `teacher-workspace/visits.ts`. As últimas extrações ainda não foram medidas.
- Check/commit em execução: commit do bloco 6. Suíte completa `@lazuli/api
test:integration` passou 314/314 e o banco temporário foi removido. A
  integração do semestre passou 5/5. O runner
  `test:affected --staged` criou e removeu seu banco temporário, mas rodou API
  e Web simultaneamente; a fase unitária falhou por timeouts sob carga, antes
  de chegar à integração. A suíte API isolada havia passado 88/88. Após
  Prettier, seis funções foram
  extraídas e `readClassPlans` foi movida para `data.ts`; lint dos 24 arquivos
  voltou a zero, typecheck e 88 testes unitários passaram. Lint API completo:
  130 erros conhecidos fora do bloco, 0 novos fingerprints, 15 avisos.
- Revisão final: `git diff --check` e `git diff --cached --check` passaram;
  Prettier dos arquivos próprios foi aplicado, o lint direcionado permaneceu
  verde e o gate `test:quality:changed --staged` deu 0 erros e 0 avisos.
- Gate próprio: lint direcionado dos 24 arquivos zero, typecheck/testes
  pertinentes, lint API completo e comparação por fingerprint com
  `/tmp/lazuli-pr207-api-full-after-students.json`.
- Próximo registro: resultado do lint direcionado e erros restantes por arquivo.
