# Build Tasks: Display de Parcelas

Generated from: `.design/parcelas/DESIGN_BRIEF.md`

Date: 2026-08-26

Ordem: risco financeiro e de paginação primeiro; depois a tabela plana estabelece a direção visual
de **densidade editorial calma**; por fim, o agrupamento vencido e o acabamento completam a
experiência. Cada tarefa inclui seus testes e deve terminar em um estado verificável antes da
próxima.

## Foundation

- [ ] **Identidade estável da parcela**: adicionar `Installment.sequenceNumber` por nova migration,
      criar a coluna nullable, fazer backfill determinístico por `orderId` na ordem `dueDate, id`,
      torná-la `NOT NULL` e então criar índice único parcial em
      `orderId + sequenceNumber WHERE deletedAt IS NULL`, seguindo o fluxo `--create-only` do guia de
      migrations. Atribuir a sequência na geração/persistência sem renumerar por reagendamento ou
      dispensa e atualizar retornos, seeds e fixtures afetados; done = criação e regeneração preservam
      `1..N`, duplicatas ativas são rejeitadas, uma sequência excluída logicamente pode ser reutilizada
      e testes de domínio, schema e pedidos passam. _Modifica `Installment`, `generateInstallments`, o
      módulo `receivables` e seus testes; reutiliza Prisma para schema/migration/writes._

- [ ] **Consulta plana paginada do ledger**: entregar o contrato validado de listagem e uma leitura
      Kysely privada do módulo `receivables` para Todas e Pagas, incluindo saldo/status derivados,
      total do cronograma, pagador, beneficiários, contadores, busca por nome, exclusão de pedidos
      cancelados, ordenação e páginas de 25 linhas. Integrar `prisma-kysely` e
      `prisma-extension-kysely` no cliente/transaction boundary conforme ADR 0016; tipos são gerados do
      schema, nunca editados à mão. Done = `finance.installments` é `adminProcedure`, responde ao DTO
      discriminado com input `view=all|overdue|paid` e possui testes DB de
      paginação/ordenação/busca/status/parcial/dispensada mais teste behavior de autorização e
      transporte. Todas usa faixas de status e vencimento com `installmentId` crescente como desempate;
      Pagas usa `dueDate DESC, installmentId ASC`. _Cria validators, read adapter Kysely e procedure;
      modifica o cliente Prisma e a interface profunda de `receivables`; reutiliza
      `deriveInstallmentLedger` como oráculo de paridade._

- [ ] **Consulta vencida agrupada por pagador**: estender a mesma procedure para
      `view=overdue`, agregando ajustes e allocations no Postgres antes de filtrar, agrupando por
      `payerId`, ordenando grupos por maior atraso e `payerId ASC`, e paginando dez grupos inteiros sem
      dividir suas parcelas; linhas usam `dueDate ASC, installmentId ASC`. A busca primeiro qualifica
      pagadores por nome ou beneficiário dentro do conjunto vencido e depois retorna o grupo vencido
      completo de cada pagador. Done = o DTO retorna resumo e linhas de cada grupo, saldo e contagem
      continuam integrais após busca e testes DB comparam cada linha ao `deriveInstallmentLedger`,
      incluindo empates, homônimos, múltiplos alunos, pagamento parcial, waiver, pedido cancelado e
      fronteiras de data de São Paulo. _Modifica a leitura Kysely, validators e procedure criados na
      tarefa anterior; reutiliza o módulo `receivables` e as fixtures financeiras._

- [ ] **Cenários financeiros demonstráveis no seed**: evoluir o seed dev idempotente para tornar
      visíveis Todas, Vencidas e Pagas, incluindo um pagador com múltiplos beneficiários, várias
      parcelas vencidas, pagamento parcial e parcela dispensada, sem alterar identificadores de fixture
      ou registrar PII em logs. Done = `pnpm prisma:seed` pode ser repetido e `/parcelas` recebe dados
      suficientes para verificar todos os estados principais. _Modifica `seed-dev-finance.ts`; reutiliza
      os modelos e helpers determinísticos existentes; não cria componente._

## Core UI

- [ ] **Página de Parcelas e views planas**: criar `/parcelas` e a feature `installments/` com
      header “Parcelas” / “Mensalidades e vencimentos”, busca debounced, tabs Todas/Vencidas/Pagas,
      tabela plana para Todas e Pagas e paginação. Implementar `nuqs` com `status`, `busca` e `pagina`,
      removendo defaults, reiniciando a página ao trocar tab ou busca e mapeando URL → procedure:
      ausente → `view=all`, `vencidas` → `view=overdue`, `pagas` → `view=paid`. Formatar `06/12`, data
      civil pt-BR, BRL, saldo parcial e badges de status por view model puro testado. No mesmo slice,
      modificar a sidebar para renderizar a seção não clicável Financeiro contendo Parcelas somente
      para `ADMIN`, omitindo seções vazias. Done = um admin navega e compartilha as duas views planas;
      outros papéis não veem o item e continuam sem acesso à procedure. _Cria `InstallmentsPage`, logic,
      view model, controles, tabela e linhas; modifica `nav-items`/`SidebarNav`; reutiliza `AppShell`,
      `Input`, `Tabs`, `Badge`, `Table*`, `Pagination`, tokens e formatters existentes._

- [ ] **View Vencidas agrupada**: criar a composição `OverduePayerSummaryRow` dentro da tabela e
      renderizar cada grupo por pagador com quantidade, beneficiário único ou contagem de alunos,
      atraso mais antigo e saldo coletável, seguido de suas parcelas da mais antiga à mais recente.
      Done = a tab Vencidas mantém as seis colunas, pagina por grupos, distingue pagadores homônimos por
      identidade e comunica atraso por texto além da cor, sem cards, ações ou linha clicável. _Cria
      composição e view models da feature; modifica `InstallmentsTable`; reutiliza a consulta agrupada,
      `Table*`, `Badge` e tokens semânticos._

## Interactions & States

- [ ] **Estados, responsividade mínima e acessibilidade**: completar loading com geometria estável,
      ledger vazio, filtro sem resultado, erro com “Tentar de novo” e refetch preservando dados
      anteriores; garantir tabela nomeada semanticamente, resumo de grupo compreensível por tecnologia
      assistiva, tabs/busca/retry/paginação operáveis por teclado e foco visível. Validar header e
      controles com quebra de linha e tabela com largura mínima/scroll horizontal, sem inventar layout
      mobile. Done = todos os estados são verificáveis a 1280 px e a integridade básica permanece em
      768 px e 375 px; testes unitários cobrem os view models e contratos de URL/estado novos. _Modifica
      as composições de Parcelas; reutiliza `TableSkeleton`, `TableEmpty`, `EmptyState`, focus/motion e
      breakpoints existentes._

## Review

- [ ] **Design review separado, quando solicitado**: executar `/design-review` contra brief, IA e
      tokens após o build, capturando desktop 1280 para Todas, Vencidas, Pagas, busca vazia, erro e
      loading, além de checks de integridade em 768/375. _Não faz parte automática da Fase 6; cria
      `DESIGN_REVIEW.md` e screenshots somente mediante pedido._
