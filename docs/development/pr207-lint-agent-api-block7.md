# PR #207 — ficha `api-block7`

> **FOCO:** 100 erros iniciais em 30 arquivos próprios de
> `packages/api/src/admissions`, `appointments`, `class-records`, `finance` e
> `teaching-programs`, congelados no [progresso](pr207-lint-progress.md).
> Medição atual: **79 erros no bloco**, após zerar `admissions` e
> `class-records`; outros 30 da API ficam fora dele. Próxima ação:
> `appointments` (29), `teaching-programs` (13) e `finance` (37). Gate: zero
> erros direcionados, typecheck e testes pertinentes, lint API completo sem
> novos fingerprints e lint da raiz. Baseline:
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
