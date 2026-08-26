# Design Brief: Display de Parcelas

> Escopo: consulta operacional em `/parcelas`. Os fluxos de registrar pagamento, criar
> contrato e abrir o contrato serão desenhados separadamente.

## Problem

O administrador precisa entender a situação das mensalidades sem reconstruir mentalmente
contratos, pagamentos e vencimentos. Hoje os dados financeiros existem, mas não há uma interface
que responda com rapidez quais parcelas estão vencidas, quem é o pagador, quais alunos são
beneficiados e qual cobrança merece atenção primeiro.

A dificuldade cresce quando um pagador responde por mais de um aluno ou possui várias parcelas:
uma lista indiferenciada perde o contexto familiar, enquanto uma tela excessivamente contábil
torna lenta uma consulta que deveria levar poucos segundos.

## Solution

Criar uma página desktop de consulta do ledger completo de parcelas. A experiência reaproveita o
AppShell e a linguagem visual da vertical de Alunos, oferece busca por pagador ou beneficiário e
organiza os dados em três perspectivas: Todas, Vencidas e Pagas.

Todas e Pagas usam uma tabela direta. Vencidas mantém a mesma tabela, mas acrescenta resumos por
pagador para preservar o contexto da cobrança: quantidade vencida, alunos envolvidos, atraso mais
antigo e saldo total em aberto. A interface não executa ações financeiras neste slice.

## Primary User and Job to Be Done

- **Usuário primário:** administrador. Os procedimentos financeiros permanecem `ADMIN`-only; os
  papéis SECRETARY e FINANCE continuam fora do escopo enquanto o RBAC vigente os mantiver sem
  acesso.
- **Job to be done:** responder rapidamente “quais parcelas existem, quais estão vencidas, quem
  deve e qual cobrança é mais urgente?”.
- **Sucesso:** localizar um pagador ou aluno em poucos segundos e compreender a situação sem abrir
  contratos ou reconciliar pagamentos manualmente.

## Experience Principles

1. **Contexto de cobrança sobre uniformidade visual** — Vencidas agrupa por pagador porque a
   cobrança acontece no nível da pessoa responsável; as demais tabs permanecem planas para leitura
   rápida.
2. **Verdade derivada sobre conveniência persistida** — status e saldo vêm do ledger; a interface
   nunca mantém uma segunda fonte de verdade financeira.
3. **Urgência localizada sobre alarme constante** — a página é calma e estável; cor destrutiva fica
   restrita a atraso e valores que realmente exigem atenção.

## Aesthetic Direction

- **Philosophy:** densidade editorial calma, herdada da vertical de Alunos.
- **Tone:** operacional, sóbrio e confiável, com urgência localizada.
- **Reference points:** as duas capturas fornecidas para hierarquia da tabela e agrupamento por
  pagador; a implementação atual de `/alunos` governa shell, largura, espaçamento, controles e
  estados.
- **Anti-references:** fintech de consumo, dashboard composto por cards de métricas, ERP contábil
  carregado, cores de alerta espalhadas pela página ou ações decorativas sem fluxo implementado.

## Existing Patterns

O ponto de partida é o código entregue pela vertical de Alunos no commit `4fd25b0`.

- **Shell:** `AppShell` já compõe sidebar, topbar, identidade e sign-out dentro de `app/(app)`.
  Parcelas acrescenta sua entrada à navegação; não cria outro shell.
- **Layout:** conteúdo centralizado em `max-w-6xl`, padding de 32 px e intervalos de 20 px, como
  `StudentsPage`.
- **Tipografia:** Cambria/Georgia para corpo e display; `font-numeric tabular-nums` para dinheiro,
  datas, contagens e sequências.
- **Cores:** papéis semânticos dark existentes em `packages/ui/src/styles/tokens/color.css`.
  `destructive`, `warning`, `success` e `neutral` comunicam significado; não serão criadas cores
  específicas de Financeiro.
- **Espaçamento e efeitos:** escala de 4 px, controles tokenizados, radius, motion e foco existentes.
- **Controles:** o padrão atual posiciona busca à esquerda e tabs à direita. A referência visual não
  substitui esse padrão.
- **Tabela:** `TableContainer`, `Table`, `TableHead`, `TableCell`, `TableSkeleton` e `TableEmpty`
  preservam estrutura entre loading, dados, vazio e erro.
- **Estados e navegação:** `EmptyState`, `Pagination`, `Tabs`, `Input` e URL state seguem os padrões
  de Alunos.
- **Catálogo:** componentes e tokens possuem stories no Storybook e devem ser estendidos somente
  quando a composição de feature não for suficiente.
- **Tema:** dark permanece o tema inicial do produto autenticado; não há delta visual previsto.

## Content and Data Contract

### Tabs

- **Todas** — tab padrão; inclui parcelas abertas, vencidas, pagas e dispensadas. Pedidos cancelados
  não aparecem.
- **Vencidas** — inclui somente parcelas coletáveis, vencidas e com saldo positivo. Exibe contador.
- **Pagas** — inclui parcelas integralmente pagas.

### Columns

`Parcela · Pagador · Beneficiário(s) · Vencimento · Valor · Status`

- **Parcela:** `06/12`, usando `Installment.sequenceNumber` persistido e o total do cronograma
  retornado pela API. A UI não infere sequência por `dueDate`.
- **Pagador:** `Payer.name`.
- **Beneficiário(s):** nomes dos alunos vinculados ao pedido; suporta mais de um aluno.
- **Vencimento:** data pt-BR, baseada em data civil.
- **Valor:** `Installment.amountCents`. No caso excepcional de pagamento parcial, a célula acrescenta
  uma linha secundária com o saldo em aberto.
- **Status:** derivado do ledger, nunca persistido.

### Status language

- `OVERDUE` → “Vencida há N dias”, destructive.
- Vencimento hoje → “Vence hoje”, warning.
- `DUE_THIS_MONTH` ou `UPCOMING` → “A vencer”, neutral.
- `PAID` → “Paga”, success.
- `WAIVED` → “Dispensada”, neutral; aparece somente em Todas.
- Pagamento parcial não cria um novo status; é informação secundária na célula Valor.

Na tab Vencidas, a coluna Status pode mostrar somente “N dias” para evitar repetição dentro de um
grupo cujo contexto já é vencido.

### Grouped overdue display

- Um grupo por `payerId`, nunca por nome.
- Com um beneficiário: “3 parcelas vencidas · Ana Souza · mais antiga há 45 dias”.
- Com múltiplos beneficiários: “3 parcelas vencidas · 2 alunos · mais antiga há 45 dias”.
- O cabeçalho soma o saldo coletável, não o valor original.
- Cada linha mantém o(s) beneficiário(s) da parcela.
- Grupos ordenados pelo maior atraso; em empate, `payerId` crescente. Parcelas do grupo vão da mais
  antiga para a mais recente, com `installmentId` crescente como desempate de vencimentos iguais.

### Search, ordering and pagination

- Busca server-side por nome do pagador ou beneficiário, com debounce. Telefone, documento e busca
  global ficam fora deste slice.
- Em Vencidas, a busca seleciona pagadores dentro do conjunto vencido: basta o nome do pagador ou o
  beneficiário de uma parcela vencida corresponder. Depois que o pagador qualifica, o resultado
  inclui todas as suas parcelas vencidas coletáveis, mesmo as que não correspondem diretamente ao
  termo, para que resumo, contagem e saldo representem a cobrança completa.
- Todas: vencidas primeiro; depois abertas pelo vencimento mais próximo; por fim pagas e dispensadas
  da mais recente para a mais antiga. Dentro de cada faixa, vencimento e `installmentId` crescente
  formam o desempate total; na faixa final, vencimento é decrescente e `installmentId` crescente.
- Pagas: vencimento mais recente primeiro, com `installmentId` crescente em empate.
- Todas e Pagas: 25 parcelas por página.
- Vencidas: 10 grupos de pagadores por página; um grupo nunca é dividido entre páginas.
- Busca ou troca de tab reinicia em página 1.
- Estado compartilhável na URL: status, busca e página. A forma exata dos parâmetros será fechada na
  arquitetura da informação.
- A lista representa o ledger completo. Não existe mês implícito no título ou na consulta; o
  subtítulo é “Mensalidades e vencimentos”.

## Data and Architecture Constraints

- Adicionar `sequenceNumber` a `Installment` por nova migration. A migration cria a coluna nullable,
  faz backfill determinístico por `orderId` na ordem `dueDate, id`, torna a coluna `NOT NULL` e só
  então cria um índice único parcial em `orderId + sequenceNumber WHERE deletedAt IS NULL`, seguindo
  o guia de migrations. Parcelas excluídas logicamente não bloqueiam a regeneração de um cronograma
  ativo. A geração atribui a sequência; reagendar ou dispensar uma parcela não a renumera.
- `amountCents` continua sendo o valor original. Saldo permanece derivado de valor, ajustes e
  `PaymentAllocation`s; nenhuma coluna de saldo ou status será criada no banco.
- Prisma continua responsável por schema, migrations, writes e CRUD convencional.
- Adotar Kysely apenas na camada de leituras SQL complexas. `prisma-kysely` gera tipos a partir do
  schema e a extensão do Prisma compartilha driver e transações.
- A consulta de Parcelas executa no Postgres agregação de ajustes e allocations, derivação do saldo,
  filtros, ordenação, agrupamento e paginação. Não carrega todo o ledger para agrupar na API.
- O resultado SQL deve ter testes de paridade com `deriveInstallmentLedger`, preservando uma só regra
  financeira observável.
- A adoção de Kysely segue o decision record aceito
  [`0016`](../../docs/decisions/0016-use-kysely-for-complex-relational-reads.md); o brief registra a
  intenção de produto, não substitui essa autoridade arquitetural.
- Datas de negócio usam `America/Sao_Paulo`; labels e mensagens são pt-BR; valores são BRL em
  centavos inteiros.
- Student PII permanece no Cloud SQL e não entra em payloads Hatchet ou logs. Esta tela é uma leitura
  síncrona, sem trabalho pesado inline.

## Component Inventory

| Component                      | Status | Notes                                                                    |
| ------------------------------ | ------ | ------------------------------------------------------------------------ |
| AppShell / sidebar / topbar    | Modify | Reusar composição de Students e acrescentar Parcelas à navegação         |
| InstallmentsPage               | New    | Composição da rota, query, filtros e paginação                           |
| InstallmentsHeader             | New    | Título e subtítulo; sem ações neste slice                                |
| InstallmentsControls           | New    | Compõe `Input` e `Tabs` existentes segundo o padrão de Students          |
| InstallmentsTable              | New    | Composição de feature sobre os primitivos compartilhados de tabela       |
| InstallmentRow                 | New    | Linha não interativa com formatação numérica e status                    |
| OverduePayerSummaryRow         | New    | Linha de agrupamento dentro da mesma tabela; não é novo primitivo global |
| Status badge/view model        | New    | Mapeamento puro de DTO para label e variante de `Badge` existente        |
| Pagination                     | Exists | 25 parcelas ou 10 grupos, conforme a tab                                 |
| TableSkeleton / EmptyState     | Exists | Estados estruturais iguais aos de Students                               |
| API list output and validators | New    | DTO discriminado para linhas planas e grupos vencidos                    |
| Kysely read adapter/types      | New    | Integração limitada a consultas complexas, conforme decision record 0016 |

## Key Interactions

1. O administrador abre `/parcelas` e vê Todas, sem mês implícito.
2. Digita um nome; após o debounce, a URL e a consulta mudam, e a página volta para 1.
3. Alterna entre Todas, Vencidas e Pagas; cada tab preserva sua semântica e reinicia a página.
4. Em Vencidas, lê primeiro o resumo do pagador e depois as parcelas que compõem o total.
5. Pagina sem perder filtros porque o estado está na URL.
6. Em erro, usa “Tentar de novo”; em busca vazia, ajusta filtro ou termo.

As linhas não são clicáveis, não possuem checkbox, menu ou ação. Uma navegação futura para o
contrato poderá ser adicionada quando essa rota e sua identificação humana existirem.

## Loading, Empty and Error States

- **Loading:** `TableSkeleton` preserva colunas e altura aproximada.
- **Ledger vazio:** “Nenhuma parcela cadastrada”, sem CTA para um fluxo de contrato inexistente.
- **Busca/filtro vazio:** “Nenhuma parcela encontrada” + orientação para ajustar busca ou status.
- **Erro:** mensagem dentro do frame da tabela e botão “Tentar de novo”.
- Tabs podem aparecer sem contagens no primeiro carregamento ou erro, seguindo Students.

## Responsive Behavior

- Alvo inicial: desktop com viewport de 1280 px ou maior.
- Header e controles podem quebrar em linhas sem perder conteúdo.
- A tabela mantém largura mínima e usa rolagem horizontal em telas menores.
- Não existe composição mobile em cards neste escopo. Abaixo de 1280 px garantimos integridade
  básica, não uma experiência móvel otimizada.

## Accessibility Requirements

- Tabela semântica com nome acessível; cabeçalhos associados às células.
- O agrupamento por pagador mantém estrutura tabular compreensível e uma descrição acessível do
  resumo.
- Status sempre combina texto e cor; atraso nunca depende apenas de vermelho.
- `font-numeric tabular-nums` mantém leitura e alinhamento de valores, datas e contagens.
- Tabs, busca, retry e paginação funcionam por teclado e preservam foco visível.
- Loading e atualizações de consulta não removem a orientação estrutural da página.
- Contraste segue os tokens semânticos já testados; texto normal atende WCAG AA.

## Out of Scope

- Registrar, processar, tentar ou reconciliar pagamentos pela interface.
- Criar, editar, cancelar ou abrir contratos/pedidos.
- Navegação ao clicar numa parcela.
- Ações em lote, checkboxes, menus de linha ou botão “Pagar”.
- Número humano de contrato como `CTR-0231`.
- Filtro por mês, período, telefone ou documento.
- Busca global do AppShell.
- Pedidos cancelados na listagem normal.
- Experiência mobile otimizada.
- Analytics, exportações e relatórios.
- Alterar o RBAC para SECRETARY ou FINANCE.
- Materializar saldo ou status no banco.
- Design review, que será executado separadamente após o build.
