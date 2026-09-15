# Build Tasks: Display de Parcelas

Generated from: `.design/parcelas/DESIGN_BRIEF.md`

Date: 2026-09-15 (replanejamento da #57)

Ordem: risco financeiro e de paginação primeiro; depois a tabela plana estabelece a direção visual
de **densidade editorial calma**; por fim, o agrupamento vencido e o acabamento completam a
experiência. Cada tarefa inclui seus testes e deve terminar em um estado verificável antes da
próxima.

## Aceite da #52 atualizado

Vencidas fica desabilitada nesta fatia, exibindo seu contador. Sua ativação e apresentação agrupada
permanecem na #57; `status=vencidas` normaliza para Todas, mantém busca e remove página.
Todas e Pagas incluem os estados básicos, seletor de 10/25/50 parcelas por página (padrão 25), busca de até 80 caracteres com
debounce de 300 ms, cancelamento de busca pendente na navegação externa e correção de página acima
do total. Header e controles usam a faixa única de `DataTablePage`; tabela tem altura de viewport,
scroll interno e rodapé fixo. A #54 e o design review mantêm suas tarefas abaixo.

## Base já entregue — referência, não trabalho da #57

O handoff registra identidade/fixtures e backend como entregues nas fatias anteriores; schema,
contrato, consultas e testes atuais corroboram sua presença. Os itens abaixo preservam o plano
original, sem solicitar nova implementação nem afirmar uma nova execução de seus checks nesta fase.

- [x] **Identidade estável da parcela**: adicionar `Installment.sequenceNumber` por nova migration,
      criar a coluna nullable, fazer backfill determinístico por `orderId` na ordem `dueDate, id`,
      torná-la `NOT NULL` e então criar índice único parcial em
      `orderId + sequenceNumber WHERE deletedAt IS NULL`, seguindo o fluxo `--create-only` do guia de
      migrations. Atribuir a sequência na geração/persistência sem renumerar por reagendamento ou
      dispensa e atualizar retornos, seeds e fixtures afetados; done = criação e regeneração preservam
      `1..N`, duplicatas ativas são rejeitadas, uma sequência excluída logicamente pode ser reutilizada
      e testes de domínio, schema e pedidos passam. _Modifica `Installment`, `generateInstallments`, o
      módulo `finance` e seus testes; reutiliza Prisma para schema/migration/writes._

- [x] **Consulta plana paginada do ledger**: entregar o contrato validado de listagem e uma leitura
      Kysely privada do módulo `finance` para Todas e Pagas, incluindo saldo/status derivados,
      total do cronograma, pagador, beneficiários, contadores, busca por nome, exclusão de pedidos
      cancelados, ordenação e páginas de 10/25/50 linhas (padrão 25). Integrar `prisma-kysely` e
      `prisma-extension-kysely` no cliente/transaction boundary conforme ADR 0016; tipos são gerados do
      schema, nunca editados à mão. Done = `finance.installments` é `adminProcedure`, responde ao DTO
      discriminado com input `view=all|overdue|paid` e possui testes DB de
      paginação/ordenação/busca/status/parcial/dispensada mais teste behavior de autorização e
      transporte. Todas usa faixas de status e vencimento com `installmentId` crescente como desempate;
      Pagas usa `dueDate DESC, installmentId ASC`. _Cria validators, read adapter Kysely e procedure;
      modifica o cliente Prisma e a interface profunda de `finance`; reutiliza
      `deriveInstallmentLedger` como oráculo de paridade._

- [x] **Consulta vencida agrupada por pagador**: estender a mesma procedure para
      `view=overdue`, agregando ajustes e allocations no Postgres antes de filtrar, agrupando por
      `payerId`, ordenando grupos por maior atraso e `payerId ASC`, e paginando dez grupos inteiros sem
      dividir suas parcelas; linhas usam `dueDate ASC, installmentId ASC`. A busca primeiro qualifica
      pagadores por nome ou beneficiário dentro do conjunto vencido e depois retorna o grupo vencido
      completo de cada pagador. Done = o DTO retorna resumo e linhas de cada grupo, saldo e contagem
      continuam integrais após busca e testes DB comparam cada linha ao `deriveInstallmentLedger`,
      incluindo empates, homônimos, múltiplos alunos, pagamento parcial, waiver, pedido cancelado e
      fronteiras de data de São Paulo. _Modifica a leitura Kysely, validators e procedure criados na
      tarefa anterior; reutiliza o módulo `finance` e as fixtures financeiras._

- [x] **Cenários financeiros demonstráveis no seed**: evoluir o seed dev idempotente para tornar
      visíveis Todas, Vencidas e Pagas, incluindo um pagador com múltiplos beneficiários, várias
      parcelas vencidas, pagamento parcial e parcela dispensada, sem alterar identificadores de fixture
      ou registrar PII em logs. Done = `pnpm prisma:seed` pode ser repetido e `/parcelas` recebe dados
      suficientes para verificar todos os estados principais. _Modifica `seed-dev-finance.ts`; reutiliza
      os modelos e helpers determinísticos existentes; não cria componente._

## UI já entregue — #52

- [x] **Página de Parcelas e views planas**: criar `/parcelas` e a feature `installments/` com
      header “Parcelas” / “Mensalidades e vencimentos”, busca debounced, tabs Todas/Vencidas/Pagas,
      tabela plana para Todas e Pagas e paginação. Implementar `nuqs` com `status`, `busca` e `pagina`,
      removendo defaults, reiniciando a página ao trocar tab ou busca e mapeando URL → procedure:
      ausente → `view=all`, `pagas` → `view=paid`; nesta fatia, `vencidas` é normalizado
      para Todas e reinicia a página. Formatar `06/12`, data
      civil pt-BR, BRL, saldo parcial e badges de status por view model puro testado. No mesmo slice,
      modificar a sidebar para renderizar a seção não clicável Financeiro contendo Parcelas somente
      para `ADMIN`, omitindo seções vazias. Done = um admin navega e compartilha as duas views planas;
      outros papéis não veem o item e continuam sem acesso à procedure. _Cria `InstallmentsPage`, logic,
      view model, controles, tabela e linhas; modifica `nav-items`/`SidebarNav`; reutiliza `AppShell`,
      `Input`, `Tabs`, `Badge`, `Table*`, `Pagination`, tokens e formatters existentes._

## Implementação #57 — ordem de execução

Cada tarefa inclui apresentação e comportamento observáveis, além da proteção do contrato novo.
A tarefa 1 estabelece a **densidade editorial calma** no ponto de maior risco: a cobrança completa
de um pagador. Confirmar o resultado de cada tarefa antes da seguinte, conforme o design-flow.

- [ ] **1. Composição agrupada verificável**: criar `OverduePayerSummaryRow` e o view model do
      resumo; permitir renderizar a variante vencida de `InstallmentsTable` com um DTO agrupado em
      teste/story. Grupos sempre abertos e identificados por `payerId`; resumo nas colunas 1–4,
      saldo coletável rotulado na coluna Valor e sexta célula vazia. Nas parcelas, omitir visualmente
      o pagador, mostrar todos os beneficiários uma única vez e usar “Há 1 dia” / “Há N dias”.
      Preservar a ordem da API. Aplicar superfície neutra, bordas e altura flexível do documento de
      tokens; compor associação semântica entre grupo, colunas e células. Done = dois pagadores
      homônimos permanecem separados; pacote conjunto não duplica linhas/valores; resumo e parcelas
      são legíveis com nomes longos e saldo parcial. Testes do view model protegem singular/plural,
      beneficiário único/múltiplos, maior atraso e saldo coletável diferente do valor original;
      renderização protege seis colunas, identidade e associações de cabeçalhos. _Cria composição
      e view model na feature; modifica `InstallmentsTable`/`InstallmentRow`; reutiliza `Table*`,
      `Badge`, formatters e tokens. Pode extrair primitivo estrutural se houver necessidade concreta,
      com story e contrato proporcional; nenhuma tarefa obriga essa extração._

- [ ] **2. Abrir e paginar Vencidas na página real**: habilitar a tab, aceitar `status=vencidas`,
      consumir `view=overdue` e encaminhar `groups` à composição. Consultar sempre 10 pagadores,
      omitir seletor e mostrar a unidade correta no rodapé; preservar `porPagina` como preferência
      das views planas e reiniciar página ao trocar tab. Done = acesso direto e sequência Todas com
      50 → Vencidas com 10 grupos → Pagas com 50 funcionam; um grupo longo aparece inteiro e a página
      seguinte não repete/divide pagadores. Contador da tab continua contando parcelas. Testar
      entrada efetiva da consulta e props/renderização da paginação, inclusive URL com `porPagina=50`
      em Vencidas, defaults e status inválido; verificar navegação no browser. _Depende da tarefa 1.
      Modifica filtros, logic, controles e página da feature; reutiliza `nuqs`, paginação compartilhada
      e contrato/API existentes, sem refazer agrupamento ou cálculo financeiro no cliente._

- [x] **3. Buscar e atualizar grupos completos**: mostrar a orientação aprovada quando houver
      busca efetiva em Vencidas, renderizando todo o DTO do pagador sem filtrar ou destacar alunos
      no cliente. Integrar loading, vazio, erro/retry, refetch e correção de página com a variante
      agrupada. Done = pesquisar Ana mostra também as parcelas vencidas dos demais beneficiários
      do pagador, com saldo e contagem integrais; mudar busca/tab não mostra dados do filtro anterior;
      refetch/paginação preservam grupos com indicação de atualização; página inválida é corrigida
      pelo total de grupos após resposta efetiva. Preservar debounce, limite e cancelamento de busca
      por navegação externa. Testar os contratos novos no nível mais barato que os observe;
      renderização estática não comprova debounce ou transições, que precisam de verificação no
      browser ou teste comportamental adequado. _Depende da tarefa 2. Modifica página, logic e
      estados da tabela; reutiliza `TableSkeleton`, `TableEmpty`, `EmptyState` e testes de busca da API._

## Verificação de aceite da #57

Integra a conclusão das três tarefas; não cria uma fase automática de design review.

- [ ] **Validar o fluxo entregue**: conferir em 1280 px os grupos, resumo, saldo parcial, homônimos,
      pacote conjunto, busca e segunda página; verificar integridade em 768/375 px, teclado nos
      controles e leitura do resumo/associações com tecnologia assistiva. Registrar limites reais
      de ferramentas, sem afirmar validação assistiva apenas por inspecionar atributos HTML.
      Inspecionar o diff completo, executar `git diff --check`, formatação, lint, typecheck e testes
      proporcionais; executar os gates aplicáveis ou informar o que ficou para CI e por quê.
      _Verifica as composições modificadas e os componentes reutilizados; não cria nova UI._

### Estratégia de testes

- Contrato protegido: representar a cobrança vencida completa por pagador, sem duplicar parcelas,
  perder beneficiários ou aplicar o tamanho das views planas à paginação de grupos. As expectativas
  vêm do brief aprovado e de exemplos com valores explícitos, não de cálculos copiados da produção.
- Estender `apps/web/test/features/installments.unit.test.ts` para os view models e mapeamento de
  filtros; `installments-ui.unit.test.ts` já renderiza componentes reais e deve proteger composição,
  textos e paginação. Não tratar esses testes estáticos como prova de interação dos hooks.
- Reutilizar `packages/api/test/finance/installments-overdue.integration.test.ts`, que já cobre
  grupos completos entre páginas, homônimos, busca expandida, saldo e múltiplos beneficiários.
  `installments-groups.unit.test.ts` e `installments.transport.test.ts` já protegem montagem e
  transporte. Acrescentar teste nesses níveis somente se surgir um contrato novo ou lacuna concreta.
- Na implementação, carregar `ship-with-tests` e seguir `docs/testing/README.md`: verificar contratos
  e defeitos plausíveis antes de editar, revisar por inteiro cada teste tocado e preservar os gates
  de qualidade e mutation. Usar `pnpm test:affected --base <ref>` e
  `pnpm mutate:changed --base <ref>` com uma base real conferida; analisar novos mutantes sobreviventes.
- O planejamento atual é documental: não comprova execução de testes, build ou validação visual.

## Entrega posterior — #54

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

## Ajuste mínimo do shell aprovado na #52

A verificação em 375 px encontrou a sidebar fixa de 240 px comprimindo os controles. Nesta entrega,
o shell passa a mostrar um menu nativo de navegação abaixo de 640 px e mantém a sidebar em larguras
maiores. O menu reutiliza os destinos e filtros por papel, fecha ao navegar ou pressionar Escape
e devolve o foco ao acionador. A data utilitária do topo aparece a partir de 640 px. O acabamento
ampliado de responsividade continua na #54.

## Refinamento visual aprovado — 2026-09-15

- Cabeçalhos apenas para tecnologia assistiva por grupo, nomes completos e cinco células independentes por parcela.
- Saldo coletável como valor principal; variação líquida com ↓ ou ↑ na mesma linha e original no tooltip.
- Resumo sem contagem de contratos, atraso por extenso e rodapé discreto na mesma posição.
- Exceção visual localizada: `InstallmentsPagination` usa `className="bg-transparent"` somente em
  Vencidas, pois o rodapé acompanha grupos separados sobre o fundo da página. `TablePagination`
  não oferece variante de superfície e um wrapper não remove seu fundo interno. O contrato fica
  limitado à superfície, preservando espaçamento, controles e comportamento do primitivo; se outra
  tela precisar disso, promover a escolha a uma propriedade de superfície compartilhada.
- Testes preservam valores financeiros, grupos e associações de cabeçalhos; abreviações, contagem
  de contratos e formato compacto do atraso deixam de ser expectativas automatizadas.
