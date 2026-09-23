# Design Brief: Contratos

Refinamento: [decisões financeiras confirmadas](./FINANCIAL_DECISIONS.md). Pendências e
entregas futuras: [issue #115](https://github.com/josiasrfreitas/lazuli/issues/115).

Data: 2026-09-22. Brief confirmado para avançar à IA; escopo refinado durante a fase 3.

Este brief consolida a descoberta em [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), os esclarecimentos
finais do handoff e a inspeção do produto existente. [FINANCE_ER.md](./FINANCE_ER.md) continua
sendo uma proposta conceitual; seus campos e cardinalidades não se tornam decisões
arquiteturais aceitas por aparecerem no planejamento.

Direção da sessão: planejar até tarefas, reutilizando os tokens existentes. Implementação e
revisão de design terão autorização própria. As propostas de experiência abaixo serão refinadas
na arquitetura da informação; as pendências de negócio permanecem identificadas ao final.

### Refinamento confirmado na IA

O destino de consulta contextual será uma página unificada do aluno, com abas para as áreas
do produto. Cada módulo apontará para sua seção nessa página. Essa entrega fica para depois:
primeiro serão desenvolvidas as páginas operacionais mais densas, para organizar a página do
aluno a partir dos dados e necessidades concretos dessas verticais.

Nesta fatia de Contratos não será construído painel lateral nem página de detalhe. A sugestão
de painel foi substituída explicitamente pela direção de página própria unificada do aluno.
Não criar links ou ações de abertura antes de existir o destino. Rotas, abas e comportamento
da página futura serão planejados separadamente. O refinamento não autoriza iniciar código
durante o planejamento.

Novo contrato será um modal, conforme confirmação na IA. Seguir `Patterns/DenseForm` e
`Components/FormSection` do Storybook e o [padrão de formulários](../../docs/frontend/forms.md).
A composição financeira será reutilizada na etapa Financeiro de Novo aluno.

## Problem

Ao fechar um acordo com uma família, a operação precisa registrar quem paga, qual aluno recebe
o serviço, o período combinado e como o valor será pago. Hoje não há interface de contratos
que reúna essas informações. A etapa financeira do cadastro de aluno é um placeholder, e a
consulta de parcelas mostra cobranças sem representar a vigência e as condições do acordo.

Isso dificulta responder quanto foi contratado, quanto ainda falta pagar e se existe atraso.
Também favorece confundir o fim das parcelas com o fim do serviço, ou alterar a situação de
outro aluno apenas porque ambos têm o mesmo pagador.

## Solution

Uma vertical de Contratos para consultar acordos individuais e registrar um novo contrato
educacional, tanto para aluno existente quanto durante o cadastro de um aluno. A lista mostra
pagador, beneficiário, principal, plano de parcelas, progresso de quitação e situação financeira.
O formulário apresenta primeiro o acordo comum: período, mensalidade negociada e primeira
cobrança. Uma expansão permite distribuir o valor em outra quantidade de parcelas.

A experiência torna visíveis o nominal, o valor em dia e o calendário antes de confirmar.
O cadastro financeiro permanece opcional em Novo aluno. A vertical inclui a configuração
comercial restrita ao Administrador do sistema. O registro pontual de material com recebimento
aguarda os requisitos da entidade Material e não entra no build desta fatia.
O registro de rompimento foi adiado para a futura página do contrato, em uma área de ações
sensíveis. Sua prévia financeira e regras permanecem descritas para orientar essa entrega futura.

## Primary User and Job to Be Done

- **Usuário primário:** operador administrativo que negocia e registra o acordo. O acesso
  operacional atual é `ADMIN`; a atividade de vendas não cria um papel `SELLER`.
- **Usuário de configuração:** `SYSTEM_ADMIN` (Administrador do sistema), novo papel definido
  na descoberta para controlar Ajustes. A extensão de seu acesso operacional e o provisionamento
  ainda precisam ser fechados.
- **Trabalho principal:** registrar o que foi combinado e, depois, localizar o contrato e
  compreender sua situação sem reconstruir o acordo a partir de parcelas.
- **Sucesso:** criar um contrato individual com calendário revisado, localizar contratos pelo
  pagador ou aluno e distinguir compromisso futuro, atraso e quitação. Encerrar um contrato de
  um aluno deve preservar o contrato do irmão que compartilha o pagador.

## Experience Principles

1. **Acordo explícito** — vigência, preço e calendário aparecem separados, com uma prévia que
   permite conferir o resultado antes de salvar.
2. **Complexidade progressiva** — mensalidade e distribuição mensal atendem o caminho comum;
   parcelamento especial e material não tornam obrigatório um cadastro financeiro extenso.
3. **Situação financeira legível** — saldo futuro, atraso e quitação têm rótulos próprios;
   cor destaca a exceção e cada número pode ser explicado pelos registros que o compõem.

## Aesthetic Direction

- **Philosophy:** editorial institucional dark, com a densidade serena de Alunos e Parcelas.
- **Tone:** operacional, calmo e preciso; o operador deve conseguir conferir um acordo com
  tranquilidade durante o atendimento.
- **Reference points:** captura fornecida pelo usuário em 22/09/2026, com sete colunas e barra
  de progresso; implementação de Alunos e Parcelas para shell, controles e formulários.
  A captura usa vários beneficiários no cabeçalho, mas a decisão posterior exige singular.
- **Anti-references:** dashboard de métricas, fintech de consumo, formulário contábil extenso,
  alertas espalhados ou ações sem fluxo funcional.
- **Tema:** dark existente. Reaproveitar cores semânticas; a barra azul da referência não exige
  uma paleta própria. Não há nova identidade visual ou webfont.

## Existing Patterns

Inspeção realizada no workspace em 22/09/2026; documentos antigos descrevem intenções e nem
sempre o estado atual.

- **Shell e páginas:** `AppShell`, navegação agrupada e `DataTablePage`. O frame usa máximo de
  96 rem, padding de 24 px e intervalo de 16 px; tabela ocupa a altura restante com rolagem
  interna. Contratos deve integrar a área Financeiro. O destino de Ajustes será definido na IA.
- **Typography:** Cambria/Georgia para corpo e títulos; Calibri/Segoe UI com
  `font-numeric tabular-nums` para valores, datas, percentuais e contagens. Stacks de sistema.
- **Colors:** tokens semânticos de `packages/ui/src/styles/tokens/color.css`, incluindo
  `neutral`, `success`, `warning` e `destructive`. Atraso combina valor/texto e cor.
- **Spacing:** base de 4 px e tokens existentes de controles, raios, foco e movimento.
- **UI:** Tailwind com tokens CSS, Base UI, CVA e Lucide em `packages/ui`. `Field`, `FormRow`,
  `FormSection`, diálogos, painel lateral, tabelas, badges e paginação já estão disponíveis;
  o catálogo fica em `apps/storybook`. Composições de Contratos pertencem à feature.
- **Estado:** páginas existentes usam tRPC/TanStack Query, view models e nuqs. Filtros e
  paginação têm estado compartilhável na URL; erros e loading preservam a estrutura tabular.
- **Filtros:** nesta cópia, Parcelas ainda possui normalização específica em
  `features/installments/filters.ts`. O contrato genérico está em desenvolvimento separado:
  registrar a dependência e integrar sua versão entregue, sem criar um segundo framework.
- **Novo aluno:** `new-student-dialog.tsx`, `reducer.ts` e `wizard-footer.tsx` mantêm Dados,
  Turma e Financeiro. As duas últimas etapas são placeholders; o aluno é persistido apenas em
  Concluir. A etapa financeira precisa representar o beneficiário ainda sem ID.
- **Acesso:** navegação e proteção de página usam listas explícitas de papéis. `SYSTEM_ADMIN`
  ainda não existe; ocultar o link de Ajustes não substitui a autorização no servidor.

## Content and Scope

### Listagem de contratos

Direção para a IA: `/contratos`, com ação principal “Novo contrato” e estrutura baseada em:

`Pagador · Beneficiário · Principal · Parcelas · Progresso · Situação`

- **Identificação:** pagador e beneficiário são suficientes, conforme decisão do usuário.
  Não criar código humano nem coluna de identificação separada do contrato. A navegação
  contextual futura levará à seção correspondente na página unificada do aluno; nesta fatia
  não há abertura de detalhe. IDs internos continuam necessários para distinguir os registros.
- **Pagador e beneficiário:** um de cada por contrato. Um pagador pode aparecer em várias
  linhas, cada qual com valores, condições e período próprios.
- **Principal:** valor nominal do compromisso educacional, distinto do saldo atual. Material
  e eventual multa não devem ser misturados silenciosamente a esse valor.
- **Parcelas:** síntese fiel do calendário acordado. Usar “12 × R$ …” somente quando os valores
  forem uniformes; diferenças de arredondamento ou distribuição precisam ficar consultáveis.
- **Progresso:** referência visual de parcelas quitadas, acompanhada de texto como “5 de 12
  pagas”. Parcialmente paga não conta como paga, conforme confirmado. O tratamento de
  dispensadas/encerradas ainda precisa ser fechado. Contagem não equivale a percentual monetário recebido.
- **Situação:** diferenciar “Em dia”, valor em atraso e quitação. A vigência/encerramento do
  contrato e a situação financeira são dimensões independentes: quitar não encerra o serviço,
  e desistir não apaga dívida anterior. Labels e composição finais pertencem à IA.

Busca por pagador ou beneficiário, filtros e paginação devem ser feitos no servidor. A IA
especificará critérios, ordenação, unidade de paginação e estado de URL usando o contrato
genérico. Não inferir novos filtros ou tabs apenas da tela de Parcelas.

### Criação do contrato educacional

Modal com formulário denso: grupos com `FormSection`, campos relacionados com `FormRow`,
controles compactos e expansões para conteúdo secundário. Usar a estrutura de diálogo
existente, com ações visíveis e o comportamento de teclado/validação do padrão do Storybook.
Confirmado na IA em 23/09/2026: formulário único, sem etapas internas, com Beneficiário e
pagador, Condições do contrato e Plano de pagamento. Parcelamento especial fica em uma
expansão; as seções financeiras serão reutilizadas na etapa Financeiro de Novo aluno.

Campos e informações necessários à experiência:

- Beneficiário único e pagador, com distinção explícita entre pagador e responsável do aluno.
  Buscar e reutilizar pagador existente ou cadastrar um novo no próprio modal, conforme
  confirmado na IA. Incluir CPF/RG opcional: seletor de tipo e campo de número como em Alunos.
  O mesmo pagador pode atender contratos de irmãos.
  O Contract é a fonte dessas partes; Orders contratuais as obtêm pelo vínculo com o acordo.
  Orders independentes mantêm referências próprias, resolvidas pelo módulo Finance para a UI.
- Data de fechamento, vigência e primeira cobrança como conceitos separados. Conforme
  confirmação na IA, informar início e duração em meses inteiros, exibindo o fim calculado.
  O principal corresponde à duração em meses × mensalidade nominal negociada.
- Mensalidade nominal negociada para o plano inteiro, faixa permitida, desconto de pontualidade
  em percentual e valor final em dia. O vendedor negocia mensalidade e pontualidade dentro
  do limite autorizado; a configuração determina o piso, não um desconto de pontualidade fixo.
  Juros e multa vêm de Ajustes, sem substituição livre no formulário.
- Plano mensal comum e expansão para outra quantidade de parcelas. Exibir total, vencimentos
  e valores antes da confirmação. O dia de vencimento é fixo ao longo do plano. Mudar a
  distribuição não deve mudar o total nominal nem a vigência; primeira cobrança é explícita.
  Quando o dia escolhido não existir em um mês, vencer no último dia desse mês e voltar ao
  dia original no próximo que o comporte. Não transformar um ajuste de fevereiro em novo dia fixo.

O piso é `teto × (1 − desconto máximo)`, com a taxa como fração. Ele limita o valor final em
dia, inclusive após pontualidade. Exemplo da descoberta: teto de R$ 250 e limite de 20%
produzem piso de R$ 200; nominal de R$ 200 com mais 8% resulta em R$ 184 e deve ser rejeitado.
Os exemplos são ilustrações, não valores padrão do produto.

A primeira cobrança é informada conforme o acordo. Não há pró-rata automático por entrada no
meio do mês, limite em dezembro ou vínculo obrigatório com semestre, turma ou prova.
Descontos comerciais avulsos por parcela não fazem parte do formulário.

### Conexão com Novo aluno

Substituir o placeholder financeiro por uma opção de contrato individual, reutilizando a
mesma composição de condições e prévia usada na criação independente. O beneficiário é o
aluno em cadastro e não precisa ser selecionado novamente.

Pular Financeiro continua permitindo concluir o aluno. Voltar às etapas anteriores conserva
o rascunho durante a sessão. Preencher condições ou simular parcelas não cria aluno, contrato
ou pagamento antecipadamente. A operação final e sua recuperação em caso de falha precisam
ser especificadas: a UI não pode anunciar sucesso completo se só parte foi salva, nem criar
duplicatas ao tentar novamente. Não incluir a implementação da matrícula da etapa Turma.

### Material pontual

**Detalhamento em aberto por pedido do usuário.** Haverá uma entidade `Material`, com outros
propósitos além da venda, que também fornecerá dados ao financeiro. Seus campos, relações e
fluxos aguardam esclarecimento de requisitos. Não fixar agora uma seção no modal, ação na
listagem ou cadastro próprio de material.

Confirmado em 23/09/2026: o **preço de venda do material é tabelado e fica em configuração
global**, por enquanto. A venda obtém esse valor da configuração da escola. A entidade
Material e sua integração aguardam o refinamento adiado. Isso não define desconto/exceções,
vigência de preços ou cálculo de markup.

A venda continua usando `Order` de tipo `MATERIAL`, sem entidade `MaterialSale`; o modelo
financeiro discutido permanece. O conteúdo financeiro previsto inclui descrição, beneficiário,
pagador, preço de venda tabelado, markup informado, data, forma de pagamento e quitação.
A apresentação desses dados será refinada com a entidade `Material`. Pagamento no cartão
quita a obrigação com a escola; parcelas da fatura do cartão não viram parcelas no Lazuli.
Markup percentual é a proposta de apresentação, ainda a confirmar. Ausência desse dado não
significa lucro igual ao preço de venda. Não adicionar apuração de ganho ou relatório a esta UI.

### Ajustes comerciais

Tela restrita a `SYSTEM_ADMIN`, com teto da mensalidade, desconto máximo e piso calculado,
juros diários e mensais e percentual de multa de desistência. Mostrar unidades e explicar a
base dos percentuais. A faixa de negociação é global para a escola. Essas configurações são
pontos de partida simples; modelar regras mais complexas apenas quando houver requisitos
concretos. O desconto de pontualidade é negociado pelo vendedor no contrato, respeitando o
piso final em dia; não é taxa global fixa.

O preço de venda do material entra como configuração global da escola. Vencimento é escolhido
por contrato e pode ser qualquer dia do mês; não é uma configuração global. O conjunto atual
5/10/15/20/25 do motor precisa evoluir. Para meses mais curtos, foi confirmado o ajuste ao último
dia disponível, preservando o dia original para os próximos vencimentos.

Confirmado em 23/09/2026: alterações em Ajustes valem para novas contratações. Cada contrato
guarda mensalidade, pontualidade, juros e multa acordados na contratação; contratos existentes
não são recalculados por alterações posteriores da configuração. O ER representa a cópia
dessas condições; detalhes de persistência e arredondamento serão fechados no plano técnico.

### Desistência e consistência dos recebimentos

Refinamento confirmado na IA: o registro de rompimento ficará na futura página do contrato,
menos exposto por ser uma ação destrutiva. Não oferecer essa operação na listagem nem construir
seu fluxo nesta fatia. As regras a seguir descrevem o comportamento financeiro planejado.

A experiência proposta apresenta data efetiva, cobranças preservadas, cobranças futuras
encerradas e multa antes de confirmar a desistência. Para compromisso não quitado, a multa
usa o percentual configurado sobre o nominal das parcelas vincendas, antes de pontualidade.
Para contrato totalmente quitado, encerrar sem multa adicional, reembolso ou crédito.
Data de corte e tratamento das parcelas no próprio dia ainda precisam ser definidos.

Os esclarecimentos sobre recebimentos delimitam a consistência exigida do motor financeiro:

- Saldo deriva de original + ajustes − pagamentos, respeitando o estado do recebível.
  Compromisso futuro e atraso devem permanecer distinguíveis.
- Ajuste registra efeito aplicado, com tipo, valor assinado, motivo/autoria; não guarda a
  fórmula. Também pode existir antes de pagamento, como em uma correção autorizada. Isso não
  implica criar uma tela genérica de ajustes de parcela nesta vertical.
- Juros diários são calculados para uma data de referência, sem uma linha de ajuste por dia.
  As condições são juros simples diários e por mês completo, sobre o saldo restante após
  pagamento parcial; o componente mensal conta aniversários do vencimento, sem capitalização.
- A data efetiva do pagamento governa pontualidade e encargos, mesmo quando o registro é
  posterior. O operador informa essa data; guardar autoria e data do registro, sem comprovante
  obrigatório nesta etapa. Pontualidade exige completar o valor com desconto até o vencimento.
- Uma simulação é somente leitura. Onde houver confirmação de recebimento, a proposta é
  atualizar a prévia ao mudar a data efetiva e recalcular/validar no servidor ao confirmar,
  registrando ajustes, pagamento e alocações atomicamente. É necessário impedir reaplicação
  de juros e dupla contagem de ajuste aplicado com prévia acumulada.

Esses requisitos não acrescentam um caixa completo à tela de Contratos. A UI de recebimento
de material aguarda o detalhamento adiado dessa entidade; um fluxo geral de quitação de
mensalidades exige definição de escopo própria. A consulta de contratos consome os fatos
financeiros existentes.

## Component Inventory

| Component                                                          | Status     | Notes                                                                  |
| ------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------- |
| AppShell e navegação                                               | Modify     | Integrar Contratos e Ajustes com acesso coerente                       |
| DataTablePage, Table, TablePagination, TableSkeleton, EmptyState   | Exists     | Estrutura, densidade, estados e paginação                              |
| Button, Input, Select, Field, FormRow, FormSection, Badge, Tooltip | Exists     | Vocabulário de formulário e situação                                   |
| Dialog, Sheet e Stepper                                            | Exists     | Primitivos disponíveis; IA escolhe a composição                        |
| ContractsPage e ContractsTable                                     | New        | Conteúdo e estados próprios da vertical                                |
| Resumo de progresso                                                | New        | Texto e barra acessíveis; fórmula pendente                             |
| Formulário de condições e prévia de parcelas                       | New        | Compartilhado entre contrato independente e Novo aluno                 |
| NewStudentDialog, reducer e footer                                 | Modify     | Contrato opcional sem exigir ID antecipado                             |
| Registro de rompimento                                             | Future     | Área de ações sensíveis na futura página do contrato; fora desta fatia |
| Registro pontual de material                                       | Deferred   | Aguarda requisitos da entidade Material; fora do build desta fatia     |
| Ajustes comerciais                                                 | New        | Campos comerciais e autorização no servidor                            |
| Contrato genérico de filtros                                       | Dependency | Consumir o trabalho paralelo; não duplicá-lo                           |

## Key Interactions

1. Abrir Contratos, localizar um acordo e ler principal, progresso e atraso sem sair da lista.
2. Acionar “Novo contrato”, escolher aluno/pagador, informar condições e revisar o calendário.
   Erros de faixa ou datas aparecem junto aos campos e preservam o que foi digitado.
3. Expandir o plano de pagamento para alterar a distribuição; a prévia se atualiza e mantém
   explícitos o valor do acordo e a vigência.
4. Em Novo aluno, preencher ou pular Financeiro e concluir com resultado claro para o conjunto
   solicitado. A confirmação desabilita reenvio enquanto estiver em andamento.
5. Consultar a situação pela própria tabela. A navegação para a página unificada do aluno
   e o registro de rompimento na página do contrato pertencem à entrega futura dessa página.
6. Fluxo de material pendente de requisitos da entidade `Material`. Preservar a venda e o
   recebimento no modelo financeiro de `Order`; não definir a entrada ou os campos da UI agora.
7. Como Administrador do sistema, revisar e salvar parâmetros em Ajustes, recebendo retorno
   explícito sobre sucesso ou erro e sobre a aplicação das condições.

## Loading, Empty and Error States

- Loading preserva as colunas e o frame; refetch indica atualização sem atribuir resultados
  antigos a outro filtro.
- Base vazia: “Nenhum contrato cadastrado”, com ação “Novo contrato” para quem pode criar.
- Busca vazia: “Nenhum contrato encontrado”, com orientação para ajustar a busca/filtros.
- Falha de leitura: mensagem dentro da tabela e “Tentar de novo”.
- Falha ao salvar: manter rascunho, identificar campo ou erro geral e permitir recuperação sem
  duplicidade. Configuração indisponível não é substituída por taxas fictícias.
- Ausência de informação não vira zero, “Em dia” ou quitação por padrão.

## Responsive Behavior

Desktop é o alvo principal, a partir de 1280 px. Controles quebram linha; a tabela conserva
largura mínima e rolagem horizontal no próprio frame. Formulários reduzem colunas em janelas
menores, com corpo rolável e ações acessíveis. Preservar o menu compacto já existente no shell.
Não criar uma segunda listagem mobile em cards. Testar nomes longos, valores altos, ampliação
de texto e acesso aos campos/ações em viewport estreito.

## Accessibility Requirements

- Tabela semântica com cabeçalhos associados, nome acessível e ações acionáveis por teclado.
- Situação e progresso descritos em texto; barra e cor não são a única informação.
- Inputs com labels, unidades e erros associados. Anunciar falhas e resultado da confirmação
  sem mover foco durante digitação ou recálculo da prévia.
- Diálogos/painéis gerenciam foco, Escape e retorno ao acionador; erros direcionam ao primeiro
  campo inválido. Não depender de hover para ler condições essenciais.
- Contraste AA: texto comum de pelo menos 4,5:1; texto grande e indicadores essenciais de 3:1.
  Verificar as combinações aplicadas, além da existência dos tokens.
- Foco visível, controles com nomes compreensíveis, valores BRL e datas pt-BR. Datas de negócio
  seguem `America/Sao_Paulo`.

## Dependencies and Open Decisions

Avaliação solicitada durante a IA: [evolução de Parcelas para Recebíveis](./PARCELAS_COMPATIBILITY.md).
A estrutura de consulta continua adequada, mas origem das cobranças, apresentação de valores
e integração das novas regras financeiras exigem ajustes. Foram confirmados uma coluna própria
de Origem e o destaque de saldo nas parcelas abertas / recebido nas pagas, com nominal e ajustes
como informações complementares. O rótulo da multa será apenas “Multa”, e a coluna do aluno
será “Beneficiário”, no singular. **Recebíveis** foi escolhido para o título e a navegação
da página; **Cobranças** fica reservado para um módulo futuro. O cabeçalho “Parcela” também
será substituído por “Sequência”, conforme confirmado, para os valores “3 de 12” ou “1 de 1”.
A estratégia de URL está proposta na IA, preservando links existentes.
As demais propostas e pendências estão identificadas no documento; não acrescentam um fluxo
geral de recebimentos.

Estas pendências não reabrem decisões já resolvidas. Devem ser fechadas na etapa indicada,
antes de transformar a respectiva parte em tarefa implementável.

| Decisão                                                                      | Momento                         | Direção inicial, ainda proposta                                                             |
| ---------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Agregados de situação/progresso e integração do contrato genérico de filtros | Antes das respectivas tarefas   | Composição proposta na IA; preservar a diferença entre quitação e vigência                  |
| Conclusão de aluno com contrato opcional                                     | Antes da tarefa de integração   | Fluxo proposto na IA; definir operação coordenada e recuperação sem duplicidade             |
| Desistência: data de corte e vencimento no próprio dia                       | Antes da tarefa de encerramento | Prévia com vencidas preservadas, vincendas e multa separadas                                |
| Escopo operacional, concessão e provisionamento de SYSTEM_ADMIN              | Antes das tarefas de acesso     | Acesso operacional de ADMIN mais Ajustes, sem autoelevação por ADMIN                        |
| Representação de Contract/Order, multa, encerramento e migração              | Planejamento técnico            | Avaliar as propostas do ER e os dados com vários beneficiários, sem reatribuição automática |

O código atual de cancelamento de Order zera o saldo cobrável e a leitura omite pedidos
cancelados. Não atende por si só à preservação de vencidas na desistência. A futura entrega de
rompimento deve tratar essa diferença no domínio/API e nos consumidores, incluindo Recebíveis.
O cronograma atual também deriva o primeiro vencimento de
`startDate`; a primeira cobrança explícita exige evolução do contrato de dados.

Respeitar os ADRs aceitos [0004](../../docs/decisions/0004-staff-authentication.md),
[0005](../../docs/decisions/0005-separate-academic-and-commercial-calendars.md),
[0007](../../docs/decisions/0007-model-receivables-as-a-payer-scoped-derived-ledger.md),
[0009](../../docs/decisions/0009-separate-enrollment-from-pedagogical-placement.md) e
[0018](../../docs/decisions/0018-expose-finance-through-one-module-api.md). A API pública de
Finance permanece a fronteira da área; regras puras ficam no domínio e autorização/transação
no servidor. Saldos/status financeiros continuam derivados. Student PII permanece em Cloud
SQL; trabalho pesado cruza a fronteira do worker com payload mínimo.

## Out of Scope

- Entidade Material e fluxo de venda/recebimento, até o esclarecimento de seus requisitos.
  O preço global em Ajustes e a identificação da origem em Recebíveis permanecem nesta fatia.

- Registro de rompimento na listagem ou nesta fatia: ficará na futura página do contrato,
  em uma área de ações sensíveis. As regras financeiras continuam documentadas para essa entrega.
- Painel lateral de contrato, página de detalhe e página unificada do aluno com abas. A página
  do aluno será planejada após as páginas operacionais densas; links contextuais entram com ela.
- Contrato coletivo, múltiplos beneficiários, cadastro em lote e políticas de pacote/bundle.
- Anexos, documento contratual, geração de PDF, assinatura e experiência do pagador/aluno.
- Faturas, billing, caixa geral, conciliação bancária e interface geral de recebimento de mensalidades.
- Taxas, repasses, antecipação e parcelamento externo de cartão.
- Custo de aquisição, despesas, estoque, catálogo de materiais e relatórios de lucro.
- Desconto comercial avulso por parcela e pró-rata automático de entrada.
- Renovação, recorrência entre anos, rematrícula e regras automáticas de enquadramento acadêmico.
- Implementar matrícula/progresso pedagógico na etapa Turma de Novo aluno.
- Reembolso ou crédito por desistência de contrato totalmente quitado.
- Edição geral/renegociação de contratos, ações em lote, exportações e dashboards de métricas.
- Habilitar SECRETARY/FINANCE, novo papel de vendedor ou tela geral de gestão de permissões.
- Novo sistema de filtros, identidade visual, tema light ou experiência mobile dedicada.
- Implementação nesta fase e revisão de design automática.
