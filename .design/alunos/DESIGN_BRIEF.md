# Design Brief: Vertical de Alunos

> Escopo: página `/alunos` (listagem com data table), modal "Novo aluno" (wizard multi-etapas) e painel lateral de pré-visualização do aluno. Primeira vertical de produto do `apps/web`.

## Problem

A secretaria atende telefone e WhatsApp o dia inteiro com uma pergunta implícita: "quem é esse aluno e qual a situação dele agora?". Hoje essa resposta está espalhada — planilha de matrícula, caderno de chamada, controle financeiro separado. Encontrar um aluno, ver se está em dia e agir (mandar um WhatsApp, cadastrar um novo) exige trocar de tela e de sistema, com a pessoa esperando na linha.

## Solution

Uma página única onde a lista de alunos já responde as três perguntas de cada linha — em qual turma está (e com quem), se está frequentando, se está em dia — com ação de WhatsApp a um clique. Clicar na linha abre uma pré-visualização lateral sem sair da lista (a ligação continua, o contexto não se perde). Cadastrar um aluno novo é leve: o wizard permite criar só com os dados essenciais e continuar matrícula/financeiro depois.

## Experience Principles

1. **Responder antes de navegar** — a linha da tabela e o painel lateral carregam a resposta completa; navegação profunda é exceção, não requisito.
2. **Cadastro leve sobre cadastro completo** — o wizard nunca bloqueia a criação por falta de dados de etapas futuras; turma e financeiro são skippáveis (princípio S-STU-4/S-ENR-1 do PRD).
3. **Densidade serena** — muita informação por linha, mas com hierarquia tipográfica (serifa) e cor usada só para significado (verde = em dia, vermelho = pendência/frequência baixa).

## Aesthetic Direction

- **Philosophy**: editorial institucional dark — densidade de ferramenta profissional (Linear/Attio) com voz tipográfica serifada de instituição de ensino.
- **Tone**: calma e precisa. A interface é uma ferramenta de trabalho diário da secretaria; nada grita, tudo responde.
- **Reference points**: os dois mockups da vertical (fonte da verdade visual); Linear/Attio em modo escuro para densidade e interação.
- **Anti-references**: dashboards SaaS genéricos barulhentos (cards com gradiente, ícones coloridos demais); sistemas escolares governamentais.
- **Tema**: dark por padrão (classe `.dark` fixa no app). Tokens light permanecem para o futuro.
- **Tipografia (decisão nova, global)**: corpo e títulos em **Cambria, Georgia, 'Times New Roman', serif**; números tabulares (percentuais, valores, telefones) em **Calibri, 'Segoe UI', Helvetica, Arial, sans-serif** com `tabular-nums`. Stacks de sistema, sem webfont. Atualiza `--lz-font-display`/`--lz-font-sans` e cria token de fonte numérica em `packages/ui`.

## Existing Patterns

- **Tokens** (`packages/ui/src/styles/tokens/`): paleta navy/gold com temas `.light`/`.dark` completos; semânticos (`--background`, `--card`, `--muted-foreground`, `--success`, `--destructive`, `--border`…); escala de espaçamento base 0.25rem, radius sm→xl, sombras, motion (`--lz-duration-*`, `--lz-ease-standard`). Componentes consomem só tokens semânticos.
- **Typography**: ramp display/h1–h3/body/control/caption/micro já tokenizada — as fontes mudam (acima), a escala permanece.
- **Componentes** (`packages/ui`, Base UI + CVA + lucide, D-0015): alert, badge, button, checkbox, dialog, dialog-layout, input, popover, select (+content/options), table (+cells/skeleton), tabs, textarea, tooltip. Todos com stories.
- **Regras duras**: componente ≤ 200 linhas físicas (`pnpm test:component-lines`); primitivos em `packages/ui`, composições de produto em `apps/web`; `apps/web` não importa Prisma/worker-handlers; Storybook raso (`Foundations/*`, `Components/*`); código/docs em inglês, copy de produto em pt-BR.

## Arquitetura (decidida no grill)

- **Camadas sem XState**: componentes presentacionais puros (props in, events out, sem tRPC) + `logic.ts` (único ponto de import do client tRPC, hooks TanStack Query) + `view-model.ts` (DTO → props, puro) + `lib/format.ts` (BRL de centavos, datas America/Sao_Paulo, wa.me). Wizard com reducer puro testável (`new-student/reducer.ts`).
- **Estado de URL via nuqs**: tab de status, busca, página, aluno selecionado no painel.
- **Data**: `@trpc/client` + `@trpc/react-query` + `@tanstack/react-query` + `nuqs` entram no catalog do pnpm.
- **Backend novo**: `students.list` (paginação, filtro por status agrupado, busca, turma ativa + professor, % frequência do semestre corrente, saldo vencido em aberto, contadores do header). Financeiro por linha = soma de parcelas vencidas não pagas ("Em dia" se zero; "—" sem pedido ativo). Semestre corrente derivado da data via `Semester`.
- **Auth ignorada por ora**: bypass de dev no contexto tRPC (env var resolve admin seedado). Sem login UI (GRE-58).
- **Seed dev realista**: ~15 alunos com turmas, matrículas, presenças e parcelas.

## Component Inventory

| Component                                                          | Status              | Notes                                                              |
| ------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------ |
| table + table-cells + table-skeleton                               | Exists              | Base da data table; célula de avatar pode exigir extensão          |
| tabs                                                               | Exists              | Tabs de status (Todos / Ativos / Inativos) com contadores          |
| badge                                                              | Exists / Modify     | Status "Ativo", tag "menor" — conferir variantes necessárias       |
| button, input, select, dialog, dialog-layout, tooltip              | Exists              | Wizard e ações                                                     |
| avatar (iniciais, cores determinísticas)                           | New (`packages/ui`) | Círculo com iniciais como no mockup                                |
| sheet / side-panel                                                 | New (`packages/ui`) | Painel lateral de pré-visualização (overlay à direita)             |
| pagination                                                         | New (`packages/ui`) | Data table paginada                                                |
| stepper (indicador de etapas)                                      | New (`packages/ui`) | Wizard dados → turma → financeiro                                  |
| empty-state                                                        | New (`packages/ui`) | Lista vazia / sem resultados de filtro                             |
| AppShell + Sidebar + TopBar                                        | New (`apps/web`)    | Composição: sidebar do mockup (só "Alunos" ativo), topbar com data |
| StudentsPage, StudentsTable, StudentPreviewPanel, NewStudentDialog | New (`apps/web`)    | Composições da feature `features/students/`                        |

## Key Interactions

- **Clique na linha** → painel lateral abre (param `?aluno=<id>` via nuqs); refresh/link reabrem. Fechar limpa o param. Botão "Abrir perfil" presente e **desabilitado** (página de perfil fora do escopo).
- **Botão WhatsApp** (linha e painel) → abre `wa.me` em nova aba; clique não seleciona a linha (stop propagation).
- **Tabs de status** → filtram server-side e resetam página; contadores vêm do `students.list`.
- **Filtro local** ("nome, turma ou professor") → busca server-side com debounce; estado na URL.
- **Novo aluno** → wizard etapa 1 (dados + responsável obrigatório se menor — validação já existe no backend, mensagens em pt-BR); etapas 2–3 visíveis mas "em breve"/skippáveis. Sucesso → fecha, invalida lista, abre painel do aluno criado.
- **Estados de dado**: loading = table-skeleton; vazio = empty-state; frequência `< 75%` e valores vencidos em `--destructive`; "Em dia" em `--success`; ausência de dado = "—" (nunca zero fake).

## Responsive Behavior

Desktop-first (ferramenta de secretaria). Alvo primário ≥ 1280px. Em janelas menores a tabela ganha scroll horizontal no próprio container; painel lateral vira overlay de largura total abaixo de ~768px. Sem versão mobile dedicada nesta vertical.

## Accessibility Requirements

- Linha da tabela acionável por teclado (Enter abre painel), foco visível com `--lz-shadow-focus`.
- Painel lateral: foco move para dentro ao abrir, Esc fecha, retorno de foco à linha de origem.
- Wizard: dialog com foco preso, erros de validação anunciados junto ao campo.
- Cor nunca é o único canal: "Em dia"/valor vencido são texto, não só cor; frequência baixa idem.
- Contraste AA no tema dark (tokens já calibrados).

## Out of Scope

- Página de perfil completo do aluno (`/alunos/:id`) — botão fica desabilitado.
- Busca global ⌘K do topo (usa `students.search` existente; fica para depois).
- Backend das etapas 2 (matrícula) e 3 (financeiro) do wizard.
- Login UI / proteção de rota real (GRE-58); RBAC de TEACHER na listagem.
- Edição de aluno, mudança de status, importação do legado.
- Tema light no produto; responsivo mobile dedicado.
