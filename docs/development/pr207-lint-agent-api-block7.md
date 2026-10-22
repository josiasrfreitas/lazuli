# PR #207 — ficha `api-block7`

> **FOCO:** 100 erros iniciais em 30 arquivos próprios de
> `packages/api/src/admissions`, `appointments`, `class-records`, `finance` e
> `teaching-programs`, congelados no [progresso](pr207-lint-progress.md).
> **BLOCO FECHADO:** 0 erros no bloco; lint completo da API mediu 30 erros fora
> dele, sem novos fingerprints frente ao baseline de 130.
> `pnpm test:affected --staged` passou com banco temporário: API unitária 88/88,
> Web unitária 295/295, API integração 314/314 e transporte 63/63. Próxima
> ação: bloco 8 com os 30 erros da API e 1 erro no script de importação
> detectado pelo lint da raiz. Baseline:
> `/tmp/lazuli-pr207-api-full-block6.json`.

Comando direcionado:

```sh
pnpm -F @lazuli/api exec eslint src/admissions src/appointments src/class-records src/finance src/teaching-programs -f json > /tmp/lazuli-pr207-api-block7-current.json
```

- Worktree limpa no início, HEAD `0fa72c3`. Coordenação, handoff, progresso,
  fichas dos blocos 5 e 6, `AGENTS.md` e skills de lint lidos antes da edição.
- O bloco foi escolhido do último lint da raiz: 130 erros na API, com
  distribuição exata de 100 nos 30 arquivos do inventário e 30 fora dele.
- Não há outro agente ativo nesta worktree. Reservas adicionais de dependências
  ou testes devem ser registradas na coordenação antes da edição.
- Alterados `candidates.ts`, `capture.ts`, `guardian.ts`: validação de alterações
  do lead e normalização dos campos foram separadas em helpers; a checagem do
  responsável preserva os caminhos de aluno existente e novo. Lint dos três
  arquivos passou; o tipo opcional do helper foi ajustado após typecheck.
- Alterados `placement.ts` e `visit-calendar.ts`: separação de consultas,
  validação de conflitos e persistência dos anexos. Lint de `src/admissions`
  passou com 0 erros e typecheck API passou após Prettier. Lint do bloco inteiro
  mediu 86 erros restantes, sem novos erros nos arquivos tocados; 1 aviso na
  área completa.
- A suíte unitária API passou com 88/88 testes
  (`/tmp/lazuli-pr207-api-block7-unit-admissions.log`). `git diff --check`
  passou. A integração específica de admissão fica para o gate do bloco, com
  banco temporário isolado.
- Alterados `class-records/experimental-sessions.ts`, `guests.ts`,
  `progress.ts` e `read.ts`: retornos explícitos, consultas de convidados e
  montagem do detalhe separados sem alterar critérios de visibilidade.
  Lint do diretório passou com 0 erros e typecheck API passou. O bloco caiu
  de 86 para 79 erros, sem novos erros nesses arquivos.
- Em `appointments`, `absences.ts`, `commitments.ts`, `legacy.ts`,
  `schedule.ts` e `coverage.ts` passaram no lint e no typecheck. O lint do
  diretório mediu 19 erros restantes em `availability.ts` (2), `read.ts` (7),
  `record.ts` (4) e `scheduling.ts` (6). O bloco inteiro tem 69 erros
  projetados, ainda sujeito à nova medição completa.
- `appointments/availability.ts`, `read.ts`, `record.ts` e `scheduling.ts`
  foram divididos em consultas, validações, persistência e projeções. O lint
  completo de `src/appointments` passou com 0 erros, o typecheck API passou
  e a medição do bloco inteiro caiu para 50 erros: 13 em `teaching-programs`
  e 37 em `finance`.
- A suíte unitária API passou novamente com 88/88 após `appointments`
  (`/tmp/lazuli-pr207-api-block7-unit-appointments.log`). Prettier dos
  arquivos alterados e `git diff --check` passaram.
- `teaching-programs/import.ts` e `read.ts` foram separados em persistência e
  projeção com tipos explícitos. Lint direcionado e typecheck API passaram.
  A medição do bloco inteiro confirmou 37 erros restantes, todos em `finance`.
- `finance/internal/contracts-select.ts`, `renewal.ts`, `settings.ts` e
  `student-summary.ts` passaram no lint direcionado e no typecheck API. Oito
  erros do baseline financeiro foram removidos; a medição conjunta será
  repetida após os demais arquivos de financeiro.
- `finance/internal/contract-detail.ts`, `contracts.ts` e
  `contract-materials.ts` passaram no lint direcionado e no typecheck API.
  Restam 18 erros do baseline financeiro em rescisão, necessidades de
  material e tratamentos.
- `finance/internal/contract-termination.ts`, `material-needs.ts` e
  `finance/treatments/index.ts` passaram no lint direcionado e no typecheck API.
  Lint conjunto do bloco: **0 erros, 1 aviso**. Lint completo da API:
  **30 erros**, todos fora do bloco, **0 novos fingerprints** contra
  `/tmp/lazuli-pr207-api-full-block6.json`; snapshot em
  `/tmp/lazuli-pr207-api-full-block7.json`. Uma tentativa sem `--staged` do
  seletor de testes encontrou arquivos executáveis preexistentes sem
  classificação; a seleção restrita ao stage funcionou.
- `pnpm test:affected --staged` passou após stage explícito dos três arquivos
  financeiros e das fichas: API unitária 88/88, Web unitária 295/295, API
  integração 314/314 e transporte 63/63, com banco temporário removido.
  Registro: `/tmp/lazuli-pr207-api-block7-affected.log`.
