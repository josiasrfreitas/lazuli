# PR #218 — lint da tela inicial

> **BLOCO WEB FECHADO:** 93 erros originais em 11 arquivos de
> `apps/web/src/features/admin-home`; restam **0**. Inventário completo:
> `pnpm -F @lazuli/web exec eslint . -f json > /tmp/lazuli-pr218-web-lint-baseline.json`.
> O snapshot inicial incluiu um arquivo temporário criado por teste, removido
> antes das correções. Gate: lint direcionado 0 erros e 0 avisos, lint global
> 16/16, typecheck Web e testes Web 305/305 passaram.

> **BLOCO API FECHADO:** 27 erros originais em três arquivos de
> `packages/api/src/dashboard`; restam **0**. Inventário completo:
> `pnpm -F @lazuli/api exec eslint . -f json > /tmp/lazuli-pr218-api-lint-baseline.json`.
> Gate: lint direcionado 0 erros, lint global 16/16, typecheck API,
> testes API 95/95 e integração Dashboard 6/6 passaram.

> **PRÓXIMO GATE:** publicar o lote uma vez e acompanhar o novo head no PR
> #218.

O dono pediu checks locais em sequência, correções agrupadas e um único push
após validar o conjunto. O lint inicial da raiz parou nos 27 erros da API; os
inventários completos dos dois workspaces registraram 120 erros na nova home.
O Web foi dividido em funções de triagem e componentes menores, preservando
as ações e os estados. A API ganhou tipos de retorno, parâmetros agrupados e
constantes de período. O lint direcionado passou após cada bloco. Os dois
avisos de segurança introduzidos no Web foram removidos usando pares de
métricas e associação das séries pelo mês.

`pnpm format:check` passou após remover o cache local
`.impeccable/hook.cache.json`, ignorado pelo Git. `pnpm typecheck` passou
14/14, `pnpm lint` 16/16, `pnpm build` 3/3 e o gate de qualidade dos testes
com 0 erros e 0 avisos. `pnpm test` passou na etapa de scripts, mas a etapa
paralela de pacotes falhou por tempo na inicialização da API e interrompeu
testes Web. Execuções isoladas posteriores passaram: API 95/95, Web 305/305 e
configuração do ESLint 21/21.

A integração focada falhou em duas asserções de primeira página no banco
local já populado; no banco temporário isolado, passou 6/6. O transporte
completo passou 63/63 em banco temporário, removido ao final.

A revisão do diff preservou a classificação da cobertura com data passada e
o estado inicial da escola para contagens diferentes de zero. O navegador
abriu a home com dados reais e a lista de alunos aguardando turma; o retorno
deu foco à região de prioridades. Não houve overflow horizontal em 1120 px e
390 px. O comando `pnpm dev` parou no seed local por nome de semestre
duplicado; a validação de interface usou o processo Web direto, sem alterar
os dados existentes.

## Web — 93 erros

| Arquivo em `apps/web/src/features/admin-home` | Erros |
| --------------------------------------------- | ----: |
| `group-detail.tsx`                            |     4 |
| `home-business.tsx`                           |     4 |
| `home-loading.tsx`                            |     5 |
| `home-metrics.tsx`                            |    14 |
| `home-parts.tsx`                              |     4 |
| `home-priority.tsx`                           |     7 |
| `home-queue.tsx`                              |     4 |
| `home-school.tsx`                             |     5 |
| `home-start.tsx`                              |     2 |
| `home-work-model.ts`                          |    35 |
| `home.tsx`                                    |     9 |

## API — 27 erros

| Arquivo em `packages/api/src/dashboard` | Erros |
| --------------------------------------- | ----: |
| `home-insights.ts`                      |    22 |
| `home-pending.ts`                       |     1 |
| `home.ts`                               |     4 |
