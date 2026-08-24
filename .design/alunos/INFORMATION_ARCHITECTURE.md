# Information Architecture: Lazuli — Vertical de Alunos

> Complementa `DESIGN_BRIEF.md`. Estrutura do `apps/web` a partir do zero; esta vertical define o esqueleto que as próximas herdam.

## Site Map

- Raiz `/` → **redirect server-side para `/alunos`** (Início não existe ainda)
- Alunos `/alunos` — listagem (data table) + painel de pré-visualização + modal de novo aluno
  - Painel de preview: **não é rota** — estado de URL `?aluno=<uuid>`
  - Modal novo aluno: **não é rota** — estado local do dialog
- ~~Perfil do aluno `/alunos/:id`~~ — fora do escopo (botão "Abrir perfil" desabilitado, rota reservada para o futuro)

## Navigation Model

- **Primary navigation**: sidebar fixa à esquerda (composição `AppShell` em `apps/web`). Nesta vertical mostra **apenas o que existe**: Início (aponta para `/`, que redireciona) e Alunos (ativo). Os demais itens do mockup (Turmas e calendários, Analytics, Contratos, Parcelas) entram quando suas verticais existirem — a sidebar cresce por demanda, igual aos componentes.
- **Secondary navigation**: tabs de status dentro de `/alunos` (Todos / Ativos / Inativos) — filtram a mesma view, não navegam.
- **Utility navigation**: rodapé da sidebar com usuário logado (nome + papel, como no mockup); topbar com data do dia (busca ⌘K fora do escopo).
- **Mobile navigation**: fora do escopo (desktop-first); abaixo de ~768px a sidebar colapsa para ícones ou some — decisão adiada.

## Content Hierarchy

### /alunos

1. **Header da página**: título "Alunos" + contadores ("X alunos · Y turmas ativas") — orienta a escala; botão "Novo aluno" à direita — ação primária da página.
2. **Controles**: filtro de busca local + tabs de status com contagem — o operador afunila antes de ler.
3. **Data table** (80% do tempo de uso): colunas Aluno (avatar + nome + tag "menor") · Turma · Professor · Frequência · Financeiro · ação WhatsApp. Ordenada por nome. Paginada.
4. **Painel de preview** (sob demanda): identidade (avatar, nome, status) → fatos (turma, professor, frequência, financeiro, telefone) → ações (Abrir perfil desabilitado, WhatsApp).

## User Flows

### Consultar situação de um aluno (fluxo dominante — telefone tocando)

1. Operador chega em `/alunos` (ou já está).
2. Digita nome no filtro local → tabela reduz (busca server-side com debounce, estado em `?busca=`).
3. Lê a linha: turma, frequência, financeiro respondem 90% das perguntas.
4. Se precisa de mais → clica na linha → painel abre (`?aluno=<id>`), mostra telefone e detalhes.
5. Ação: botão WhatsApp abre `wa.me` em nova aba. Esc/× fecha o painel e devolve o foco à linha.

### Cadastrar aluno novo

1. Clica "Novo aluno" → dialog wizard abre na etapa 1 (Dados).
2. Preenche nome (único obrigatório); telefone/email/nascimento opcionais.
   - Se data de nascimento indica menor → seção Responsável vira obrigatória (nome + telefone ou email). Validação espelha o backend; mensagens pt-BR do servidor são exibidas junto ao campo.
3. Avança → etapas 2 (Turma) e 3 (Financeiro) exibem estado "em breve" com ação Pular.
4. Conclui → mutation `students.create` → sucesso: dialog fecha, lista invalida/recarrega, painel do aluno recém-criado abre (`?aluno=<novo id>`).
   - Erro de validação do servidor → volta à etapa 1 com erros nos campos.

### Filtrar por situação

1. Clica tab (ex.: Inativos) → `?status=inativos`, `?pagina` reseta → tabela e contadores refletem o filtro server-side.

## Naming Conventions

| Conceito                        | Label na UI    | Notas                                                                                              |
| ------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| Student                         | Aluno          | Rota `/alunos`, param `?aluno=`                                                                    |
| Tab ACTIVE                      | Ativos         | `StudentStatus.ACTIVE`                                                                             |
| Tab INACTIVE+SUSPENDED+DROPPED  | Inativos       | Agrupamento decidido no grill; badge individual no painel pode detalhar ("Trancado", "Desistente") |
| Status SUSPENDED                | Trancado       | Vocabulário do PRD (D-0024)                                                                        |
| Status DROPPED                  | Desistente     |                                                                                                    |
| Status INACTIVE                 | Inativo        |                                                                                                    |
| Guardian                        | Responsável    | Obrigatório para menores                                                                           |
| Menor de idade                  | tag "menor"    | Derivado de `birthDate` (nunca persistido)                                                         |
| Enrollment ativa mais recente   | Turma (coluna) | "—" sem matrícula ativa                                                                            |
| Frequência do semestre corrente | Frequência     | "—" sem dado; destaque destructive < 75%                                                           |
| Saldo vencido em aberto         | Financeiro     | "Em dia" / "R$ X,XX" / "—"                                                                         |

## Component Reuse Map

| Componente                                    | Usado em                                                       | Diferenças de comportamento                |
| --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `AppShell` (sidebar + topbar)                 | Todas as rotas futuras via layout de grupo `app/(app)/`        | Item ativo por rota                        |
| `table` + células                             | /alunos (e futuras listagens)                                  | Célula avatar+nome é composição da feature |
| `sheet` (novo primitivo)                      | Painel de preview; futuras verticais (ex.: detalhe de parcela) | Largura/lado configuráveis                 |
| `dialog` + `dialog-layout` + `stepper` (novo) | Wizard novo aluno; futuros fluxos multi-etapa                  | Stepper é primitivo genérico               |
| `empty-state` (novo)                          | Tabela vazia, sem resultado de filtro                          | Variante com/sem ação                      |
| `lib/format.ts`                               | Toda a app                                                     | BRL de centavos, datas SP, wa.me           |

## Content Growth Plan

- A lista de alunos cresce indefinidamente (escola real: centenas) → paginação server-side desde o dia 1, busca server-side, filtros por status. Ordenação por coluna fica para quando houver demanda.
- A sidebar cresce por vertical entregue; o layout `app/(app)/` já nasce preparado para novas rotas irmãs.
- O painel de preview ganhará seções (turmas N, histórico) quando `StudentProfile` deixar de retornar `[]` — o sheet deve tolerar conteúdo mais alto que a viewport (scroll interno).

## URL Strategy

- **Pattern**: rotas em pt-BR, substantivo plural — `/alunos` (futuro: `/alunos/:id`, `/turmas`…).
- **Dynamic segments**: nenhum nesta vertical.
- **Query parameters** (nuqs, todos em pt-BR, todos opcionais, defaults limpos da URL):
  - `?status=` `ativos | inativos` (ausente = todos)
  - `?busca=` texto livre (debounced)
  - `?pagina=` inteiro ≥ 2 (ausente = 1)
  - `?aluno=` uuid do aluno selecionado no painel (ausente = painel fechado)
- Mudar `status` ou `busca` reseta `pagina`. `aluno` sobrevive a mudanças de filtro (painel independe da linha estar visível).
