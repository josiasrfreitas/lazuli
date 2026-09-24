# Information Architecture: Contratos

Refinamento: [decisões financeiras confirmadas](./FINANCIAL_DECISIONS.md). Pendências e
entregas futuras: [issue #115](https://github.com/josiasrfreitas/lazuli/issues/115).

Status: fase 3 consolidada; avanço para tarefas confirmado pelo usuário em 23/09/2026.
O plano está em [TASKS.md](./TASKS.md). Dependências ainda abertas permanecem identificadas;
este documento não autoriza implementação.

Complementa [DESIGN_BRIEF.md](./DESIGN_BRIEF.md). A decisão abaixo substitui a sugestão inicial
de painel lateral para consulta do contrato.

## Decisões confirmadas

- A consulta contextual futura será uma **página própria unificada do aluno, com abas**.
- Cada módulo apontará para sua seção nessa página; Contratos não terá um detalhe isolado
  construído agora.
- Primeiro vêm as páginas operacionais mais densas. Seus dados e necessidades orientarão a
  organização posterior da página do aluno.
- Nesta fatia não haverá painel lateral nem página de detalhe de contrato. Não criar links
  para destinos ainda indisponíveis.
- A correção do usuário para “página própria” substitui a menção anterior a painel lateral.
- Novo contrato será um **modal**, seguindo `Patterns/DenseForm` e `Components/FormSection`
  do Storybook. A composição financeira será reutilizada na etapa Financeiro de Novo aluno.
- Confirmado em 23/09/2026: Novo contrato usa **formulário único**, sem etapas internas,
  com três seções: Beneficiário e pagador, Condições do contrato e Plano de pagamento.
  Parcelamento especial fica em uma expansão. O wizard de Novo aluno mantém suas etapas.
- Vigência em meses inteiros, com início e duração informados e fim calculado. O total nominal
  é duração × mensalidade. O vencimento mantém o mesmo dia ao longo do plano; a primeira
  cobrança é informada separadamente. Parcelamento especial não altera a duração ou o principal.
- Cada contrato guarda as condições acordadas: mensalidade e percentuais de pontualidade,
  juros e multa. Alterações posteriores em Ajustes aplicam-se a novas contratações e não
  recalculam os contratos existentes, conforme confirmação em 23/09/2026.
- O vendedor negocia mensalidade e desconto de pontualidade no contrato. A configuração
  estabelece o piso permitido para o valor final em dia; não determina um desconto fixo
  de pontualidade. Juros e multa continuam vindo de Ajustes.
- A faixa de negociação é **global para a escola**. Essas configurações são pontos de
  partida simples; modelar regras mais complexas quando houver requisitos concretos.
  Não antecipar faixas por modalidade, tabelas de preços ou motor de regras.
- O vencimento pode ser escolhido em qualquer dia do mês, por contrato; não há lista global
  de dias permitidos. A configuração global mencionada pelo usuário refere-se ao preço de
  material. Confirmado: quando o dia não existir no mês, usar o último dia daquele mês e
  voltar ao dia originalmente escolhido nos meses seguintes. Exemplo: 31/01, 28/02 e 31/03
  em ano não bissexto; fevereiro usa 29 em ano bissexto.
- Haverá uma entidade `Material`, que atende outros propósitos e fornece dados ao financeiro.
  A venda permanece um `Order` de tipo `MATERIAL`, com o modelo financeiro já discutido.
  Entidade, relações e fluxo de material aguardam esclarecimento de requisitos; não definir
  agora suas entradas na interface.
- O preço de venda do material é tabelado e, por enquanto, fica em **configuração global**
  da escola. A entidade Material, seus demais usos e o fluxo de venda continuam aguardando
  requisitos; não criar uma estrutura de tabelas de preços por material nesta etapa.
- Pagador: buscar e reutilizar cadastro existente ou cadastrar no próprio modal. O cadastro
  deve incluir CPF/RG opcional, com tipo e número seguindo Alunos.
- A identificação visual de contrato usa pagador e beneficiário; não criar código humano ou
  coluna própria de identificação. Isso não altera a identidade interna dos registros.
- A coluna do aluno chama-se **Beneficiário**, no singular. A origem de multa usa apenas
  **Multa** como rótulo de UI; sua regra de desistência permanece a mesma.
- `Contract` guarda pagador e beneficiário; Orders contratuais obtêm essas partes pelo vínculo
  com ele. Orders independentes guardam referências próprias. A UI recebe essas informações
  resolvidas pelo módulo Finance, sem implementar os dois caminhos de acesso.
- **Recebíveis** é o nome confirmado para a página hoje chamada Parcelas, no título e na
  navegação. Cobranças fica reservado para um módulo futuro.
- O registro de rompimento fica na futura página do contrato, em uma área menos exposta de
  ações sensíveis. Não aparece no menu da linha nem recebe fluxo nesta entrega da listagem.
  O destino futuro segue a organização de contrato na página unificada do aluno já definida.
- A coluna hoje chamada Parcela passa a se chamar **Sequência**, conforme confirmação;
  o significado continua sendo a posição no plano, por exemplo “3 de 12” ou “1 de 1”.

## Site Map

Estrutura de trabalho, com as propostas identificadas:

- Alunos `/alunos` — existente.
  - Novo aluno — diálogo existente; etapa Financeiro receberá contrato individual opcional.
- Financeiro — agrupamento existente na navegação, sem página intermediária.
  - Contratos `/contratos` — proposta de rota para a listagem desta vertical.
    - Novo contrato — modal com o padrão de formulário denso do Storybook.
  - Recebíveis `/recebiveis` — proposta de rota canônica; novo nome confirmado.
- Ajustes `/ajustes` — proposta de entrada utilitária fora do grupo Financeiro, restrita
  a `SYSTEM_ADMIN`.

Material não recebe posição no mapa nesta etapa. A venda continua prevista no modelo financeiro,
mas sua localização e composição de UI aguardam os requisitos da entidade `Material`.

A futura página do aluno não recebe rota ou nomes de abas neste documento. Seu planejamento
deverá permitir que cada módulo abra a seção relevante e mantenha contexto suficiente para
identificar o registro de origem.

## Navigation Model

- Reutilizar o AppShell e a navegação agrupada existentes.
- Proposta: Contratos ao lado de Recebíveis, no grupo Financeiro, sem adicionar um nível de menu.
- Proposta: Ajustes na área utilitária da navegação, após os grupos operacionais. Não inserir
  parâmetros globais nos controles da listagem.
- Preservar o menu compacto existente em telas pequenas, com a mesma filtragem por papel.
- Linhas de contrato não abrem painel ou detalhe nesta entrega. Sem menu de linha, seleção em
  lote ou ação sem destino implementado. Novo contrato é a ação principal da página.
- Proposta de acesso: `ADMIN` mantém as operações e `SYSTEM_ADMIN` recebe as mesmas operações
  e Ajustes. Ocultar navegação não substitui os controles de acesso na página e na API.
  O provisionamento desse novo papel é uma dependência técnica, sem elevação automática.

## Content Hierarchy

### Contratos

Proposta baseada no brief: consulta de situação é o uso dominante, seguida de criação.
A tabela concentra o trabalho diário. Material aguarda requisitos; o registro de rompimento
pertence à futura página do contrato.

1. Título e ação de criação.
2. Busca e filtros, integrados ao contrato genérico em desenvolvimento separado.
3. Tabela: Pagador, Beneficiário, Principal, Parcelas, Progresso e Situação.
4. Paginação por contratos e estados de carregamento, vazio e erro.

Composição proposta para revisão:

- Busca por nome do pagador ou beneficiário, sem exigir código de contrato. Filtros de
  vigência e situação financeira são dimensões distintas, integradas ao padrão genérico
  em desenvolvimento; não criar um segundo sistema de filtros nesta vertical.
- Ordenação inicial por fechamento mais recente, com desempate estável. Paginação e escolha
  de tamanho seguem os controles existentes.
- Principal mostra o nominal do contrato educacional; não soma vendas independentes de material.
  Parcelas mostra a quantidade do plano. Progresso mostra a contagem de parcelas quitadas sobre
  o total, com texto legível além da barra; dispensa não deve ser apresentada como pagamento.
- Situação apresenta a condição financeira e a vigência separadamente. Quitar o plano não
  encerra a prestação do serviço. A regra exata dos agregados e casos excepcionais precisa ser
  fechada antes de implementar os indicadores, conforme as dependências abaixo.
- Sem registros: explicar o estado e oferecer Novo contrato. Sem resultados: preservar busca
  e filtros e oferecer limpá-los. Falha de consulta: mensagem e tentar novamente, sem mostrar
  falha como tabela vazia. Usar os estados de carregamento existentes.

### Novo contrato — modal

Formulário único e ordem das três seções confirmados em 23/09/2026. Os campos detalhados
continuam sujeitos às pendências comerciais identificadas no brief:

1. **Beneficiário e pagador** — identificar a quem o acordo atende e quem paga. Em Novo aluno,
   o beneficiário já vem do cadastro, ainda sem ID; não repetir sua seleção.
2. **Condições do contrato** — fechamento, período, mensalidade nominal, faixa autorizada,
   pontualidade e valor final em dia.
3. **Plano de pagamento** — primeira cobrança e síntese da distribuição mensal. Quantidade
   especial de parcelas e calendário completo ficam em expansões, com prévia antes de confirmar.

Rodapé: Cancelar e Criar contrato na criação independente. Na etapa Financeiro de Novo aluno,
reutilizar os campos de condições/plano no fluxo existente, com financeiro opcional; não
introduzir outro wizard ou modal dentro dessa etapa.

Mensalidade e desconto de pontualidade são entradas da negociação. Exibir a faixa autorizada
e calcular o valor final em dia para conferir o limite. Exemplo: piso de R$ 200, mensalidade
de R$ 250 e pontualidade de 20% resultam em R$ 200; 25% resultariam em R$ 187,50 e devem
ser rejeitados. A validação no servidor precisa usar a mesma regra monetária da prévia.
Taxas de juros e multa são apresentadas como condições configuradas, sem negociação no modal.

Na vigência, informar início e duração em meses inteiros; mostrar fim calculado e principal
nominal. Exemplo: 12 meses × R$ 250 = R$ 3.000. No plano comum, distribuir em 12 parcelas;
na expansão, 3 parcelas de R$ 1.000 conservam o mesmo acordo. A primeira cobrança é explícita
e os vencimentos seguintes mantêm o dia escolhido, que pode ser qualquer dia do mês. Quando
necessário, ajustar apenas aquele vencimento ao último dia do mês, sem mudar o dia de referência
do plano. Confirmado: início em 15/03/2026 com 12 meses encerra em 15/03/2027,
sem pró-rata automático. Diferenças de centavos da distribuição ficam na última parcela.

### Pagador — seleção e cadastro no modal

Fluxo confirmado: buscar um pagador existente e selecioná-lo ou usar “Cadastrar pagador”
sem sair do modal. Contratos de irmãos reutilizam a mesma identidade de pagador.

Proposta de composição: buscar pelo nome e selecionar em uma lista de resultados com contexto
de documento/contato para distinguir homônimos. Paginar a busca no servidor, sem carregar o
cadastro inteiro. Ao escolher cadastrar, abrir os campos dentro da seção Pagador,
sem empilhar outro diálogo. Mostrar nome, documento e contatos. CPF/RG foi solicitado
explicitamente e confirmado como opcional; seguir a apresentação de Alunos com
`SegmentedControl` para CPF ou RG e campo de número, sem exigir ambos.
O cadastro de responsável do aluno permanece conceitualmente distinto do pagador.

Evidência atual: `payerCreateInputSchema` e `Payer` aceitam `taxId` opcional, sem distinguir
CPF/RG. Alunos já usa `documentType` e `documentNumber`. Incluir no planejamento a evolução
do contrato de dados do pagador, preservando valores existentes sem classificar todos como CPF.
Reconhecer cadastros existentes não implica mesclar pessoas automaticamente pelo nome.

Material permanece em aberto, sem seção ou ação adicionada ao modal por enquanto.

Referências locais verificadas:

- [Patterns/DenseForm](../../apps/storybook/src/patterns/dense-form.stories.tsx).
- [Components/FormSection](../../apps/storybook/src/components/form-layout.stories.tsx).
- [Form standard](../../docs/frontend/forms.md).

Aplicar o padrão existente: `FormSection` para grupos, `FormRow` para campos curtos relacionados,
`Field`/`Label`/`FieldError` e controles `size="sm"`. Datas usam texto com máscara pt-BR;
placeholders mostram formato, sem substituir labels. Grupos condicionais ficam recolhidos
até serem necessários. A seleção pesquisável de alunos/pagadores deve seguir os controles
acessíveis existentes e comportar o crescimento dos cadastros.

O formulário responde a Enter e abre com foco no primeiro campo. Cabeçalho e rodapé ficam
visíveis, usando `DialogHeader`, `DialogBody` e `DialogFooter`. O estado inicial deve caber
sem rolagem em 1280 × 800, conforme o guia; expansões e telas menores podem rolar no corpo.
Se a composição não couber, ajustar agrupamento e divulgação progressiva, sem reduzir
arbitrariamente fontes ou controles. Erros aparecem junto aos campos e levam ao primeiro
campo inválido. Durante envio, impedir reenvio e fechamento, como em Novo aluno.

### Ajustes

Proposta: página simples de formulário, com três seções e uma ação Salvar ajustes:

1. **Negociação** — teto da mensalidade, desconto máximo percentual e piso calculado.
   Explicar que a faixa global limita o valor final em dia negociado pelo vendedor.
2. **Encargos** — juros diários, juros mensais e multa de desistência, com unidades e base
   de incidência explícitas. Pontualidade é negociada por contrato e não é campo de Ajustes.
3. **Material** — preço global tabelado. Não implica construir cadastro ou venda de material.

Informar que novos valores se aplicam a novas contratações; os contratos existentes preservam
as condições acordadas. Se ainda não houver configuração válida, explicar a dependência ao
criar contrato e orientar o contato com o administrador; não inventar preços ou taxas padrão.
Evitar abas, versionamento de tabelas ou editor de regras para esse pequeno conjunto inicial.

## User Flows

### Consultar contratos

1. Abrir Contratos pela navegação de Financeiro.
2. Localizar o acordo por busca/filtros.
3. Ler os dados e a situação na tabela.
4. Quando a página unificada do aluno for entregue, uma ação contextual poderá abrir sua
   seção de contratos. Essa transição não faz parte do build atual.

### Criar contrato

1. Acionar Novo contrato na listagem e abrir o modal.
2. Informar beneficiário, pagador e condições, na ordem dos grupos acima.
3. Conferir o total e a prévia do plano; expandir opções quando necessário.
4. Enviar por Criar contrato ou Enter. O servidor valida o acordo.
   - Em erro: preservar rascunho e apresentar os erros no próprio formulário.
   - Em sucesso: fechar o modal, confirmar a criação e atualizar a listagem preservando filtros.
     Um contrato fora dos filtros ativos não deve ser inserido artificialmente no resultado.

Proposta para a integração: em Novo aluno, reutilizar os grupos financeiros dentro da etapa
existente, sem abrir um segundo modal. O envio ocorre na conclusão do cadastro, com contrato
opcional. Preservar os dados em caso de falha e permitir nova tentativa sem duplicar aluno,
pagador ou contrato. A UI só informa conclusão integral quando o conjunto escolhido tiver
sido criado; a operação coordenada e sua recuperação serão definidas nas tarefas técnicas.
Prévia e navegação entre etapas não persistem o contrato. Turma permanece fora desta entrega.

### Consultar recebíveis

1. Abrir Recebíveis e usar Todos, Vencidos ou Pagos.
2. Localizar o registro e identificar Origem, Pagador e Beneficiário.
3. Ler saldo nas obrigações abertas ou recebido nas pagas, com nominal e ajustes complementares.
   Em Vencidos, o resumo agrupa o pagador; a origem continua em cada linha.

### Alterar ajustes

1. O administrador do sistema abre Ajustes e vê os valores atuais.
2. Altera os campos; piso e unidades ajudam a conferir o resultado.
3. Salva. Validar no servidor, preservar entradas em erro e confirmar sucesso na própria página.
   Bloquear reenvio durante a operação e seguir o padrão existente para erros por campo.

### Registrar rompimento — entrega futura

Acessar pela futura página do contrato, em uma área de ações sensíveis, com exposição menor
que as ações de consulta e criação. Não disponibilizar o registro no menu de linha da listagem.
A proposta para essa entrega futura é mostrar a prévia do efeito financeiro e pedir confirmação
explícita antes de executar. As regras de desistência já discutidas permanecem no modelo;
elas não criam uma tarefa de registro de rompimento nesta fatia.

O fluxo de material aguarda os requisitos que o usuário esclarecerá posteriormente.

## Naming Conventions

| Conceito             | Label na UI  | Notas                                                                      |
| -------------------- | ------------ | -------------------------------------------------------------------------- |
| Contract             | Contrato     | Acordo individual com pagador e beneficiário                               |
| Student              | Aluno        | Futuro destino unificado dos módulos                                       |
| Beneficiary          | Beneficiário | Singular em cada contrato                                                  |
| Payer                | Pagador      | Distinto de responsável do aluno                                           |
| Finance settings     | Ajustes      | Tela restrita ao Administrador do sistema                                  |
| Receivables          | Recebíveis   | Nome da página; Cobranças reservado para módulo futuro                     |
| Installment position | Sequência    | Posição no plano, como 3 de 12                                             |
| Origin               | Origem       | Multa, Mensalidade e Material; preservar identificação de tipos históricos |

## Component Reuse Map

| Componente                            | Usado em            | Comportamento                                               |
| ------------------------------------- | ------------------- | ----------------------------------------------------------- |
| AppShell                              | Contratos e Ajustes | Navegação e proteção por papel                              |
| DataTablePage, Table, TablePagination | Contratos           | Listagem operacional sem painel de detalhe                  |
| Field, FormSection, FormRow           | Criação e Ajustes   | Estrutura comum de campos                                   |
| NewStudentDialog e Stepper            | Novo aluno          | Financeiro opcional, beneficiário ainda sem ID              |
| Tabs e grupos de pagador existentes   | Recebíveis          | Todos, Vencidos e Pagos, preservando consulta e agrupamento |

Novo contrato usa `Dialog` e sua estrutura de cabeçalho, corpo e rodapé. O padrão
`Patterns/DenseForm` é uma composição de referência, não um novo componente a copiar para a
biblioteca. Os campos financeiros compartilhados permanecem uma composição da feature.

## Content Growth Plan

- Contratos e parcelas acumulam registros: usar busca, filtros e paginação no servidor.
- Ajustes representa parâmetros comerciais, com estrutura pequena e estável nesta vertical.
- Usar os tokens, temas, tamanhos e comportamento responsivo existentes. Tabelas densas mantêm
  rolagem horizontal em telas estreitas; não ocultar valores ou origem apenas em tooltip.
- A página futura do aluno agregará o contexto das verticais já desenvolvidas. A necessidade
  de uma aba não obriga antecipar seu layout ou novas consultas neste planejamento.

## URL Strategy

- Seguir rotas em pt-BR e as convenções existentes de estado de URL.
- Propostas: `/contratos`, `/recebiveis` e `/ajustes`. Substituir `/parcelas` por `/recebiveis`
  sem redirecionamento, pois o sistema está em pré-produção.
- Busca, filtros, aba e paginação devem sobreviver à navegação de voltar/avançar. Alterar busca
  ou filtros retorna à primeira página. A serialização usa o contrato genérico em desenvolvimento,
  preservando a compatibilidade dos parâmetros atuais de Recebíveis; não inventar uma API paralela.
- Não adicionar `?contrato=` para abrir painel nem rota de detalhe nesta entrega.
- A rota e os parâmetros de abas da página unificada do aluno serão definidos com essa página.
- Rascunhos de criação não devem colocar dados pessoais ou condições financeiras na URL.
- Proposta: abertura de Novo contrato em estado local, como Novo aluno, sem rota de criação.

## Dependências para as tarefas

A estrutura das páginas está definida para revisão. As pendências abaixo limitam tarefas
específicas; não devem ser resolvidas por suposição durante a implementação:

- Antes dos indicadores: agregação de situação financeira e progresso, incluindo parcelas
  dispensadas ou encerradas. Parcialmente paga não conta como paga: cinco quitadas e uma
  parcial em doze mostram “5 de 12 pagas”. Distinguir vigência de quitação.
- Antes de novos cálculos/recebimentos: detalhar alocação, períodos de incidência e
  arredondamento de percentuais conforme as decisões financeiras confirmadas. Juros usam saldo
  restante após pagamento parcial; aplicar somente juros novos e preservar a data efetiva.
  Não mostrar prévia como saldo registrado nem somá-la duas vezes aos ajustes efetivados.
- Antes de migrar dados: restrições entre Contract e Order, preservação dos registros históricos
  com vários beneficiários e dos documentos de pagador sem tipo conhecido.
- Antes da entrega de Ajustes: provisionamento e aplicação do novo papel nos pontos de autorização.
- Na integração: conclusão de aluno/contrato sem duplicidade e contrato genérico de filtros.

Material permanece adiado por requisitos; sua entidade e fluxo não recebem tarefas de build
agora. Rompimento permanece na futura página contextual; a data de corte será fechada nessa
entrega futura. Registrar essas dependências nas tarefas, sem ampliar esta fatia para resolvê-las.

## Integração com Recebíveis — evolução de Parcelas

O usuário solicitou verificar se a tela existente continua atendendo. A inspeção está em
[PARCELAS_COMPATIBILITY.md](./PARCELAS_COMPATIBILITY.md), com evidências locais e recomendações
separadas das decisões confirmadas.

Conclusão: manter a estrutura de consulta, as três tabs e o agrupamento de vencidas por
pagador é suficiente como base. A tela precisa identificar a origem de cada cobrança e
distinguir nominal, recebido, saldo e condições/prévias. A desistência e os novos juros
exigem evolução dos cálculos e do contrato de dados, além da apresentação. A definição da
entidade Material continua adiada; a análise considera apenas sua venda como Order.

### Apresentação confirmada

- **Coluna Origem dedicada**, em Todos, Pagos e Vencidos, para identificar rapidamente o tipo
  da obrigação. Não agrupar essa informação apenas na célula Sequência ou em tooltip.
- **Saldo em destaque nas abertas; recebido em destaque nas pagas.** Nominal e ajustes
  aparecem como informações complementares.
- Manter Vencidos agrupado por pagador, com a origem em cada linha.

Proposta de colunas para Todos/Pagos:
`Sequência · Origem · Pagador · Beneficiário · Vencimento · Valor · Situação`.
Em Vencidos, com pagador no resumo:
`Sequência · Origem · Beneficiário · Vencimento · Em aberto · Atraso`.
“Sequência” foi confirmado para substituir o cabeçalho Parcela.
O cabeçalho singular de Beneficiário acompanha o modelo novo; registros históricos com
múltiplos beneficiários continuam exibindo todos os nomes, conforme a estratégia de migração.

Labels de Origem confirmados: **Multa, Mensalidade e Material**. A API deve
informar a origem real, incluindo a distinção entre mensalidade e multa originadas de contrato.
Tipos históricos devem manter identificação fiel. A coluna não depende do detalhamento
adiado da entidade Material. Nominal e ajustes são informações secundárias na célula de valor,
acessíveis também sem hover. Saldo zero por dispensa não deve ser rotulado como pagamento;
a definição dos agregados financeiros permanece uma dependência explícita das tarefas.

### Nome da página — confirmado

**Recebíveis** substitui Parcelas no título, breadcrumb e navegação. O cabeçalho Parcela
também será substituído por **Sequência**, como “3 de 12”. Origem identifica Multa, Mensalidade e
Material. Ajustar a concordância dos labels das tabs para **Todos, Vencidos e Pagos**, mantendo
as perspectivas existentes.

**Cobranças** fica reservado para um módulo futuro, cujos requisitos não são antecipados aqui.
O nome Recebíveis não altera as entidades Contract, Order ou Installment. A rota `/parcelas`
é substituída por `/recebiveis` sem redirecionamento nesta fase de pré-produção.
