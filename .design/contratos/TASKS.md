# Build Tasks: Contratos e Recebíveis

Data: 2026-09-23.
Origem: [brief](./DESIGN_BRIEF.md), [IA](./INFORMATION_ARCHITECTURE.md),
[decisões financeiras](./FINANCIAL_DECISIONS.md) e [compatibilidade de Recebíveis](./PARCELAS_COMPATIBILITY.md).

Status: planejamento revisado para 15 PRs, priorizando fatias verticais; nenhuma implementação.
A revisão individual das 12 tarefas originais está em [PR_REVIEW.md](./PR_REVIEW.md).
O usuário autorizou avançar da IA às tarefas e reutilizar os tokens existentes. O build depende
de autorização própria. O [ER](./FINANCE_ER.md) é conceitual; suas propostas não equivalem a schema aprovado.

## Escopo e ordem

Entregar consulta de Recebíveis, Ajustes globais, criação e consulta de contratos individuais
e Financeiro opcional em Novo aluno. Cada tarefa reúne interface, dados, interação e validação
do comportamento descrito. Dependências explicitadas abaixo; a numeração identifica PRs e permite ordenar a execução.
Não publicar uma etapa incompleta como conclusão da vertical: criação exige a consistência
dos recebimentos e dos indicadores antes da liberação operacional do conjunto.

Ficam na [issue #115](https://github.com/josiasrfreitas/lazuli/issues/115): avaliação de worker
de juros, extratos, invoices/Cobranças, página unificada do aluno e contexto do contrato,
rompimento e entidade/fluxo de Material. Preço global de material e origem em Recebíveis
entram agora. Não criar telas, migrations de encerramento ou infraestrutura para essas entregas futuras.

## Reutilização verificada

Direção visual: **editorial institucional dark**, com densidade das telas Alunos/Parcelas.
Tokens existentes em `packages/ui/src/styles/tokens/{color,scale,typography,effects,tailwind-bridge}.css`;
sem fase de geração de tokens, novas fontes ou tema. Valores/datas usam `font-numeric tabular-nums`.

| Classificação        | Componentes e composições                                                                                                     | Destino                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Reutilizar           | DataTablePage, Table, TableScrollArea, TablePagination, TableSkeleton, InlineSkeleton, EmptyState                             | Listagens e estados                                          |
| Reutilizar           | Button, Input, Textarea, Select, SelectOptions, SelectContent, SegmentedControl, Checkbox, Label, Field, FormSection, FormRow | Campos conforme necessidade; não adicionar controles sem uso |
| Reutilizar           | Dialog, DialogHeader, DialogBody, DialogFooter, Badge, Alert, Tooltip, Popover, Tabs, Stepper                                 | Modal, condições, navegação e feedback                       |
| Modificar composição | AppShell, Sidebar, SidebarNav, MobileNavigation, AppBreadcrumb, nav-items                                                     | Contratos, Recebíveis e Ajustes; mesmos controles de acesso  |
| Modificar            | InstallmentsPage, InstallmentsTable, InstallmentsControls, OverduePayerGroup, OverdueInstallmentAmount e view models          | Origem, nomenclatura e valores                               |
| Modificar            | NewStudentDialog, reducer, WizardFooter e conversão do input                                                                  | Financeiro opcional na conclusão                             |
| Criar na feature     | ContractsPage, ContractsTable, NewContractDialog, campos financeiros compartilhados e FinanceSettingsPage                     | Composições específicas, sem duplicar primitivos             |
| Não usar nesta fatia | Sheet, StudentPreviewPanel, Avatar, Pagination avulsa, HelloWorld, MarqueeLayout, MarqueeCard                                 | Nenhuma tarefa de alteração necessária                       |

Seguir arquivos kebab-case, `apps/web/src/features/<feature>`, rotas finas em `app/(app)`
e primitivos em `packages/ui`. Stack já disponível: React/Next, Base UI, Tailwind/CVA,
Lucide, tRPC/TanStack Query e nuqs. Sem nova biblioteca de formulários, ícones ou animação.
`Patterns/DenseForm` e `Components/FormSection` no Storybook são referências de composição.

## Dependências antes da implementação

| Dependência                        | Bloqueia | Resultado necessário                                                                                                                        |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Acesso privilegiado                | P03      | Provisionamento e matriz de SYSTEM_ADMIN definidos; sem autoelevação ou gestão geral de permissões                                          |
| Persistência e entrega incremental | P04      | Restrições Contract/Order, preservação dos históricos e controle de operações ainda incompatíveis; inventariar todos os leitores/escritores |
| Datas e percentuais                | P05      | Encerramento no mesmo dia após N meses; explicitar casos de dia inexistente e arredondamento percentual, sem reabrir decisões confirmadas   |
| Documentos legados                 | P06      | Preservar taxId sem tipo e permitir CPF/RG novo; não presumir saneamento ou deduplicação                                                    |
| Dispensas e encerramentos          | P08, P09 | Denominador do progresso e condição financeira desses registros; parcial não conta como paga                                                |
| Filtros genéricos                  | P10      | Interface pronta do trabalho paralelo; não construir outro framework                                                                        |
| Alocação e datas retroativas       | P12–P15  | Principal versus encargos, incidência por período, arredondamento e inserção de pagamento efetivo anterior a fatos já registrados           |
| Reconciliação em lote              | P15      | Valor de quitação na data efetiva, com desconto/encargos e sem desvio das regras do recebimento individual                                  |

Resolver a dependência antes do respectivo comportamento. Decisões de produto faltantes voltam
ao dono; não são autorização para inventar regras. Pendências estão na #115.

## Checklist por PR

Épico no GitHub: [#116](https://github.com/josiasrfreitas/lazuli/issues/116). As issues abaixo são sub-issues nativas do épico.

Cada item abaixo é **um PR proposto**, com todas as camadas necessárias ao caso de uso.
As tarefas originais T01–T12 foram substituídas por P01–P15; o mapeamento e a avaliação
individual estão em [PR_REVIEW.md](./PR_REVIEW.md). PRs dependentes não significam liberação
imediata: os cenários contratuais só entram em operação quando seu comportamento completo
estiver protegido na UI e na API, incluindo chamadas pelo lote.

- [ ] **P01 — Identificar a origem em Recebíveis.** [#117](https://github.com/josiasrfreitas/lazuli/issues/117) Renomear página/nav/breadcrumb para
      Recebíveis; manter Vencida e Paga no filtro Situação, sem tabs, e mostrar todos quando não houver seleção.
      Usar Sequência e Origem nas tabelas planas e agrupadas.
      Levar origem real da consulta à UI, mantendo tipos históricos fiéis. Substituir a rota
      `/parcelas` por `/recebiveis` sem redirecionamento, pois o sistema está em pré-produção.
      Não criar Contract ou finalidade de multa aqui.
      **Reutiliza:** AppShell, DataTablePage, Table, TableFilters. **Modifica:** DTO/consulta e componentes de installments.
      **Depende:** nenhuma. **Aceite/testes:** origens distintas visíveis sem hover, cabeçalhos por grupo,
      um grupo por pagador e navegação em `/recebiveis`; integração de consulta e navegação real.

- [ ] **P02 — Distinguir nominal, saldo e recebido.** [#118](https://github.com/josiasrfreitas/lazuli/issues/118) Mostrar saldo nas abertas e recebido nas
      pagas, com nominal/ajustes complementares. Dispensa não se torna pagamento. Sem prévia de
      novos juros neste PR. **Reutiliza:** células e tokens numéricos. **Modifica:** view models,
      InstallmentsTable e OverdueInstallmentAmount. **Depende:** P01.
      **Aceite/testes:** nominal R$ 250 − desconto R$ 20, pago R$ 230 → recebido R$ 230; nominal
      R$ 250 + ajuste R$ 30, sem pagamento → saldo R$ 280. Verificar apresentação e paridade com
      consulta; não somar futuras no vencido nem contar ajustes duas vezes.

- [ ] **P03 — Manter os Ajustes globais com autorização.** [#119](https://github.com/josiasrfreitas/lazuli/issues/119) Entregar `/ajustes`, leitura/gravação
      e autorização real de SYSTEM_ADMIN juntos. Seções Negociação, Encargos e Material; piso
      derivado, sem pontualidade global. Incluir o novo papel só nos acessos definidos.
      **Reutiliza:** AppShell, FormSection, FormRow, Field. **Cria:** FinanceSettingsPage.
      **Modifica:** FinanceSettings, módulo Finance e autorização. **Depende:** decisão de acesso.
      **Aceite/testes:** R$ 250 e 20% → piso R$ 200; guardar autoria/data; configuração ausente
      não inventa valores; erros preservam entradas. Integração de persistência e transporte com
      acesso permitido/negado. Excluir gestão de usuários e framework de permissões.

- [ ] **P04 — Consultar obrigações cujas partes vêm do contrato.** [#120](https://github.com/josiasrfreitas/lazuli/issues/120) Introduzir a persistência
      contratual mínima e tornar suas obrigações legíveis em Recebíveis e demais consumidores
      existentes. Contract guarda pagador/aluno; Order contratual resolve pelo vínculo; históricos
      e independentes preservam suas identidades. Atualizar validação do pagador em alocações e
      impedir novas operações contratuais ainda sem suporte. Sem formulário novo ou motor de juros.
      A migração deve tornar `Order.payerId` anulável e impor no banco os ramos exclusivos:
      `CONTRACT` exige `contractId` e proíbe pagador e beneficiários diretos;
      pedidos independentes/históricos mantêm pagador e beneficiários diretos, sem `contractId`.
      Preservar a cardinalidade dos históricos multibeneficiário; rejeitar fontes conflitantes.
      **Reutiliza:** Recebíveis e fronteira Finance. **Modifica:** schema/migration aditiva, resolução,
      consultas e proteções dos escritores existentes. **Depende:** P01 e estratégia de compatibilidade/entrega.
      **Aceite/testes:** cenários contratuais de integração aparecem no grupo correto e nos totais
      do aluno; outro pagador não recebe alocação; históricos multibeneficiário permanecem íntegros.
      Testar restrições no banco e partes resolvidas uniformemente em consultas e pagamentos.
      Demonstrar via leitura real, não só ORM. É a única fatia habilitadora; não conclui criação.

- [ ] **P05 — Criar um contrato mensal para aluno e pagador existentes.** [#121](https://github.com/josiasrfreitas/lazuli/issues/121) Entregar modal,
      prévia, gravação transacional e listagem básica reais no mesmo PR. Três seções DenseForm;
      seleções pesquisáveis; fechamento, início/duração, primeira cobrança, negociação e condições
      preservadas. `/contratos` mostra partes, principal e plano com paginação; indicadores entram
      em P08/P09. Não incluir novo pagador, parcelamento especial ou filtros avançados aqui.
      **Reutiliza:** Dialog/layout, Field, FormSection, Table e DataTablePage.
      **Cria:** NewContractDialog, campos compartilhados, ContractsPage/Table e operação de criação.
      **Depende:** P03, P04 e datas/percentuais definidos.
      **Aceite/testes:** 15/03/2026 + 12 meses → 15/03/2027; 12 × R$ 250 → R$ 3.000;
      31/01 → 28/29 de fevereiro → 31/03. Piso limita valor final em dia; preservar taxas/condições
      após alterar Ajustes. A criação recebe identidade de comando persistida e única, gravada
      na mesma transação: repetição da mesma carga retorna o resultado original; mesma identidade
      com carga diferente falha. Unit para regras, integração de rollback e resposta perdida após
      commit sem duplicar contrato, pagador ou aluno; transporte e criação real seguida de consulta.
      Storybook apoia o mesmo fluxo, não o substitui.

- [ ] **P06 — Criar pagador dentro da contratação.** [#122](https://github.com/josiasrfreitas/lazuli/issues/122) Acrescentar cadastro inline com documento
      opcional CPF/RG e contatos, concluído junto do contrato; preservar a seleção de existente.
      **Reutiliza:** Field, SegmentedControl e padrão de documentos de Alunos. **Modifica:** modal,
      Payer, validação e operação de P05. **Depende:** P05 e migração compatível do documento.
      **Aceite/testes:** irmãos reutilizam pagador; homônimos não se mesclam; taxId sem tipo não
      vira CPF. Unidade para validação, integração com rollback e retry, alternância entre busca e
      cadastro sem perder rascunho. Sem saneamento amplo ou inferência a partir do responsável.

- [ ] **P07 — Negociar outra quantidade de parcelas.** [#123](https://github.com/josiasrfreitas/lazuli/issues/123) Implementar expansão, prévia e gravação
      do parcelamento especial juntos, mantendo principal e vigência; calendário completo acessível.
      **Reutiliza:** campos/cálculo do plano comum. **Modifica:** expansão, validação, criação e síntese
      do plano na tabela. **Depende:** P05.
      **Aceite/testes:** 12 meses × R$ 250 podem gerar 3 × R$ 1.000; R$ 1.000 em três gera
      R$ 333,33 + R$ 333,33 + R$ 333,34. Testar conservação do total no domínio e persistência;
      UI não apresenta “N × valor” quando houver diferença. Conferir teclado e retorno ao plano comum.

- [ ] **P08 — Consultar progresso de pagamento do contrato.** [#124](https://github.com/josiasrfreitas/lazuli/issues/124) Entregar agregado e barra/texto
      juntos; contar apenas parcelas totalmente pagas. **Reutiliza:** Table e tokens semânticos.
      **Cria:** apresentação acessível do progresso. **Modifica:** consulta e ContractsTable.
      **Depende:** P05 e denominador definido para dispensas/encerramentos.
      **Aceite/testes:** cinco pagas e uma parcial em doze → “5 de 12 pagas”; material independente
      não entra. Integração dos agregados, dispensas e contratos de irmãos; texto legível sem cor.
      Não incluir filtros ou condição de atraso neste PR.

- [x] **P09 — Distinguir situação financeira e vigência.** [#125](https://github.com/josiasrfreitas/lazuli/issues/125) Entregar condições e valores de
      atraso na listagem, separados do estado do serviço. **Reutiliza:** Table, Badge e datas.
      **Modifica:** agregados e células de ContractsTable. **Depende:** P05 e semântica de estados
      excepcionais definida. Não depende da barra de P08.
      **Aceite/testes:** quitar não encerra o serviço; saldo zero por dispensa não é quitação por
      pagamento; vencidas e futuras são distintas. Integração dos estados/totais e apresentação
      com datas-limite e nomes longos. Usar os fatos financeiros disponíveis e rótulos explícitos;
      futuras prévias não devem ser apresentadas como saldo registrado. Sem rompimento ou detalhe.

- [ ] **P10 — Encontrar contratos por busca e filtros.** [#126](https://github.com/josiasrfreitas/lazuli/issues/126) Integrar controle, URL e consulta no
      servidor: pagador/beneficiário, vigência e situação, ordenação por fechamento recente com
      desempate estável. **Reutiliza:** contrato genérico de filtros, nuqs e TablePagination.
      **Modifica:** toolbar e consulta de ContractsPage. **Depende:** P09 e filtros genéricos entregues.
      **Aceite/testes:** filtro retorna à primeira página; voltar/avançar restaura consulta; criação
      preserva filtros e não força linha incompatível. Integração de consulta/ordenação, navegação
      real e estados distintos de base vazia, busca vazia e falha. Sem novo framework.

- [ ] **P11 — Concluir Novo aluno com contrato opcional.** [#127](https://github.com/josiasrfreitas/lazuli/issues/127) Integrar os campos financeiros e
      conclusão transacional no mesmo PR. O beneficiário vem do rascunho sem ID; reutilizar criação
      de contrato/pagador em cliente transacional, sem duplicar regras. Turma permanece fora.
      **Reutiliza:** NewStudentDialog, Stepper e campos de P05–P07. **Modifica:** reducer, input,
      footer e operação coordenada no servidor. **Depende:** P06, P07.
      **Aceite/testes:** pular cria só aluno; preencher conclui o conjunto; falha mantém rascunho
      e não deixa parte persistida nem duplica em nova tentativa. Reutilizar a identidade de comando
      de P05 na conclusão conjunta; testar repetição após commit com resposta perdida. Prévia não
      grava. Integração de rollback, reducer/input, transporte e percurso completo voltar/avançar/concluir.

- [ ] **P12 — Aplicar pontualidade na quitação em dia.** [#128](https://github.com/josiasrfreitas/lazuli/issues/128) Mostrar condição em dia, validar
      recebimento e registrar desconto/pagamento/alocações atomicamente no caminho individual.
      Data efetiva informada governa o benefício; guardar autoria/data do registro sem comprovante
      obrigatório. Persistir identidade de comando única com desconto, pagamento e alocações na
      mesma transação; repetição da mesma carga retorna o resultado confirmado, e carga diferente
      com a mesma identidade falha.
      **Reutiliza:** ledger, registro de pagamento e células de P02. **Modifica:** cálculo,
      orquestração, DTO e apresentação de Recebíveis. **Depende:** P02, P05 e semântica das datas/alocações.
      **Aceite/testes:** R$ 100 + R$ 130 até o prazo quitam nominal R$ 250 com condição R$ 230;
      só R$ 100 não garante desconto. Registrar depois respeita data efetiva. Testar unidade,
      integração atômica e transporte, incluindo resposta perdida após commit para pagamento
      parcial e quitação com desconto; consultar recebido R$ 230 e saldo zero na UI.
      Não criar tela de pagamentos; lote contratual continua protegido até P15.

- [ ] **P13 — Quitar atraso sem pagamentos parciais anteriores.** [#129](https://github.com/josiasrfreitas/lazuli/issues/129) Entregar prévia datada e
      efetivação individual de juros simples diários + mensais por aniversário para esse cenário.
      Mostrar saldo registrado separado da prévia; considerar juros já aplicados e gravar somente
      o incremento junto do pagamento. Não usar a regra antiga para casos ainda não suportados.
      **Reutiliza:** operação de P12 e células de Recebíveis. **Modifica:** cálculo, persistência de
      ajustes e apresentação. **Depende:** P12 e incidência/arredondamento definidos.
      **Aceite/testes:** 31/01 → 28/29 de fevereiro → 31/03, sem capitalização; repetir prévia não
      grava, repetir confirmação não duplica. Casos calculados à mão, integração com ajustes já
      efetivados e UI antes/depois. Recebimentos contratuais parciais em atraso aguardam P14.

- [ ] **P14 — Receber parcialmente em atraso e recalcular o restante.** [#130](https://github.com/josiasrfreitas/lazuli/issues/130) Estender o mesmo fluxo
      de prévia/efetivação para reduzir a base após pagamento parcial e respeitar datas efetivas,
      inclusive registro posterior. Fechar antes a alocação principal/encargos e o tratamento de
      fatos retroativos; não derivar uma política de replay implicitamente.
      **Reutiliza:** caminhos individuais e apresentação de P12/P13. **Modifica:** cálculo por
      períodos, validação/transação e resultado consultável. **Depende:** P13 e regras abertas resolvidas.
      **Aceite/testes:** juros novos usam saldo restante, sem cobrar novamente o que já foi aplicado
      nem capitalizar; parcial não conta como parcela paga. Casos manuais, integração de sequência,
      concorrência/retry e data retroativa; conferir saldo e progresso. Sem reprocessamento geral
      de históricos. Se esse requisito surgir, delimitar novo escopo antes de implementar.

- [ ] **P15 — Reconciliar obrigações contratuais pelo lote existente.** [#131](https://github.com/josiasrfreitas/lazuli/issues/131) Fazer o lote usar as
      mesmas regras e data efetiva dos recebimentos individuais, preservando sua atomicidade e
      organização por pagador. Não basta chamar o persistidor antigo com o saldo registrado.
      **Reutiliza:** regras/transação de P12–P14 e batchReconcile existente. **Modifica:** validação,
      cálculo do valor de quitação e aplicação por lote. **Depende:** P14 e semântica de lote definida.
      **Aceite/testes:** equivalência com quitação individual na mesma data, múltiplos pagadores,
      linha inválida sem aplicação parcial indevida, descontos/juros uma vez e repetição segura.
      Integração e transporte do adaptador real; conferir resultados nas consultas existentes.
      Remover restrição contratual do lote somente quando protegido. Não criar nova tela de caixa.

## Ordem, tamanho e liberação

P01 → P02 e P03 podem avançar independentemente. O núcleo segue P04 → P05; P06/P07,
P08/P09 e P12 derivam desse núcleo. P10 espera P09 e os filtros externos; P11 espera P06/P07;
P12 → P13 → P14 → P15 completa os recebimentos. As dependências técnicas de cada item
continuam valendo mesmo quando dois PRs possam ser desenvolvidos em paralelo.

P04/P05 e P12–P15 são os PRs de maior risco. Estimar o diff antes de começar; a divisão é
por capacidade, não uma garantia de número de linhas. Se um requisito novo romper o limite,
redividir pelo cenário afetado, preservando cálculo/persistência/leitura juntos sempre que possível.

P04 é uma exceção habilitadora explícita: garante que a origem contratual pode ser consumida
sem perder atribuição ou histórico; ainda não entrega criação ao operador. Não subdividi-la
em PRs apenas de schema, API e frontend. Regras de entrega intermediária estão em PR_REVIEW.md:
nenhum caminho, inclusive API/lote, pode aceitar cenário contratual usando regras incorretas.
Liberar o conjunto contratual apenas após os cenários incluídos e suas dependências estarem
concluídos; esconder navegação sozinho não protege o backend.

## Critério de conclusão de cada tarefa

Cada entrega inclui loading, vazio, erro, pendência de envio e sucesso que lhe forem aplicáveis,
responsividade e acessibilidade; isso não fica para uma tarefa de acabamento posterior.
Validar desktop 1280 × 800 e viewport estreito, rolagem interna de tabela/modal, foco visível,
Enter, labels/erros associados, datas pt-BR e negócio em America/Sao_Paulo.

Antes de código, carregar `ship-with-tests` e seguir [docs/testing/README.md](../../docs/testing/README.md).
Inspecionar testes existentes: domínio em `packages/domain/test`, contratos/validators em
`packages/validators/test`, persistência/transport em `packages/api/test/finance` e apresentação
em `apps/web/test/features`. Usar a camada mais barata que prove o defeito relevante, sem
testes que apenas espelhem a implementação. O script web `test:e2e` atual é placeholder e
não conta como evidência de validação visual.

Executar checks proporcionais e os gates exigidos para o diff: formatação, lint/typecheck/build
afetados, unit/integration/transport conforme o contrato, qualidade dos testes e mutação quando
aplicável. Revisar o diff completo e `git diff --check`; registrar o que ficou para CI com motivo.
Não alterar migrations aplicadas, IDs históricos ou fixtures para simplificar migração.

A fronteira pública é `finance(db, staffUserId)`; domínio mantém regras puras, servidor mantém
autorização/transações e web não importa Prisma. Não criar uma fundação paralela de Finance.

## Revisão e encerramento

A checklist é de planejamento, não autorização de execução. Ao implementar, concluir e demonstrar
cada tarefa antes de marcá-la. A vertical só está pronta quando os fluxos incluídos funcionam
juntos e as dependências aplicáveis estão resolvidas; placeholders não satisfazem aceite.

`design-review` fica disponível após o build, somente quando solicitado pelo usuário;
não é uma etapa automática nem motivo para antecipar screenshots ou revisão de UI não construída.
