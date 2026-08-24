# Build Tasks: Vertical de Alunos

Generated from: .design/alunos/DESIGN_BRIEF.md
Date: 2026-08-24

Ordem: risco primeiro (backend agregado é a maior incerteza), depois a superfície mais visível (tabela) para validar a direção estética cedo. Cada task é uma fatia vertical verificável.

## Foundation (backend + infra)

- [x] **Seed dev realista**: script em `packages/db` que popula ~15 alunos (nomes do mockup), responsáveis, semestre corrente, 6 turmas com professores e horários, matrículas (algumas duplas, uma sem turma), sessões passadas com presenças variadas (uma <75%) e payers/orders/installments (em dia, vencida, sem pedido). Done = `pnpm prisma:seed` popula e é idempotente. _Novo; reusa modelos Prisma existentes._
- [ ] **Procedure `students.list`**: paginação + filtro `status` agrupado (ativos/inativos) + busca (nome/turma/professor) + por linha: matrícula ativa mais recente (código da turma, horário, professor), % frequência do semestre corrente, saldo vencido em aberto (centavos), flag menor derivada; + contadores (`totalStudents`, `activeClasses`, contagens por tab). Zod input/output em `@lazuli/validators`; testes db + behavior seguindo `students-http.test.ts`. Done = testes verdes contra o seed. _Novo; reusa `attendance-percent.ts` e `finance-ledger.ts` do domain._
- [ ] **Dev auth bypass**: env var (ex.: `DEV_AUTH_EMAIL`) que o contexto tRPC usa em `NODE_ENV=development` para resolver o admin seedado sem sessão; produção intocada. Done = procedures respondem sem login em dev. _Modifica `packages/api/src/trpc/context.ts`._
- [ ] **Infra do client web**: adicionar `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `nuqs` ao catalog; `apps/web/src/lib/trpc.ts` (único ponto de import do client), providers no layout (QueryClient + NuqsAdapter), classe `.dark` fixa no `<html>`, `lib/format.ts` (BRL de centavos, datas America/Sao*Paulo, wa.me) com testes unit. Done = página de teste consome `students.list` renderizando JSON. \_Novo.*

## UI primitives (`packages/ui`, cada um ≤200 linhas + story)

- [ ] **`avatar`**: círculo com iniciais, cor de fundo determinística por id (paleta de tokens), tamanhos sm/md/lg. Story com grade de variações. _Novo._
- [ ] **`sheet`**: painel lateral overlay (Base UI Dialog), lado direito, largura configurável, scroll interno, foco preso + Esc + retorno de foco. Story com conteúdo longo. _Novo; segue padrão do `dialog.tsx`._
- [ ] **`pagination`**: anterior/próxima + indicador de página/total, estados disabled. Story. _Novo._
- [ ] **`stepper`**: indicador horizontal de etapas (atual/completa/pendente/desabilitada), genérico. Story. _Novo._
- [ ] **`empty-state`**: ícone + título + descrição + ação opcional. Story com/sem ação. _Novo._

## Core UI (`apps/web`, `features/students/`)

- [ ] **AppShell + rota**: layout `app/(app)/` com sidebar (logo, Início, Alunos ativo, rodapé com usuário) e topbar (data por extenso pt-BR); `/` redireciona para `/alunos`. Estética do mockup: dark, serifa, calma. Done = shell navegável com página vazia. _Composição; reusa tokens/botões._
- [ ] **Tabela de alunos**: `StudentsPage` + `logic.ts` + `view-model.ts` + `StudentsTable`; header (título + "X alunos · Y turmas ativas" + botão Novo aluno), tabs com contagens, filtro debounced, colunas Aluno (avatar + nome + tag menor) / Turma / Professor / Frequência / Financeiro / WhatsApp; paginação; estados loading (table-skeleton), vazio (empty-state), erro. Números em `font-numeric tabular-nums`; freq <75% e valores vencidos em destructive, "Em dia" em success, "—" para ausência. Estado em nuqs (`status`, `busca`, `pagina`). Done = idêntico ao mockup 1 contra o seed. _Depends on: Foundation + primitives._
- [ ] **Painel de preview**: `StudentPreviewPanel` via `?aluno=` (nuqs); avatar grande, nome, badge de status detalhado (Ativo/Trancado/Desistente/Inativo), fatos (turma, professor, frequência, financeiro, telefone formatado), ações "Abrir perfil" (disabled + tooltip) e WhatsApp. Clique/Enter na linha abre; WhatsApp da linha não abre painel. Done = idêntico ao mockup 2. _Depends on: sheet, tabela._
- [ ] **Wizard novo aluno**: `NewStudentDialog` com stepper (Dados → Turma → Financeiro) e `new-student/reducer.ts` puro testado; etapa 1 completa (nome obrigatório; telefone/email/nascimento/documento opcionais; seção Responsável obrigatória se menor — espelha regras do backend, erros pt-BR do servidor mapeados aos campos); etapas 2–3 com estado "em breve" e Pular. Sucesso → fecha, invalida lista, abre painel do criado. Done = aluno criado aparece na tabela e no painel. _Depends on: stepper, infra._

## Interactions & polish

- [ ] **Acessibilidade e teclado**: linha focável (Enter abre), foco visível `--lz-shadow-focus`, Esc fecha painel com retorno de foco, wizard com erros anunciados (aria), cor nunca é o único canal. Checklist do brief. _Modifica as composições._
- [ ] **Responsivo mínimo**: tabela com scroll horizontal no container; sheet full-width <768px. Breakpoints: 768/1280. _Modifica sheet + tabela._

## Review

- [ ] **Design review**: rodar /design-review contra o brief com screenshots (desktop 1280, estados: cheio, filtrado, vazio, painel aberto, wizard etapas).
