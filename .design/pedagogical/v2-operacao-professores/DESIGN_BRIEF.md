# Design Brief: V2 — Operação de professores

Fonte: descoberta com o usuário iniciada em 07/10/2026 e [brief do módulo](../DESIGN_BRIEF.md).
Épico: [#156](https://github.com/josiasrfreitas/lazuli/issues/156). V1 está em implementação por
outra frente na [#157](https://github.com/josiasrfreitas/lazuli/issues/157).
Execução de V2: [#158](https://github.com/josiasrfreitas/lazuli/issues/158).

O usuário confirmou entendimento suficiente para avançar ao brief. As decisões de produto
abaixo foram respondidas na conversa; propostas de composição estão identificadas. Este arquivo
não representa implementação, aceite visual ou issue de execução. A estrutura lista → página
do professor com grade semanal foi confirmada ao avançar à
[arquitetura da informação](INFORMATION_ARCHITECTURE.md). O usuário aceitou também a totalização
ajustada da semana e as pendências na lista de Professores. A [referência de tokens](DESIGN_TOKENS.md)
documenta o reaproveitamento visual; [TASKS.md](TASKS.md) organiza a execução em uma issue com
três entregas de valor. Implementação permanece pendente.

## Problema

A administração recebe professores novos conforme cresce a demanda e novas turmas se formam.
Nesse processo, reorganiza as turmas e sua distribuição entre docentes. Os horários disponíveis
são acordados fora do sistema; cadastrar uma grade de disponibilidade acrescentaria um controle
que o usuário decidiu dispensar.

O trabalho necessário é cadastrar a pessoa, enxergar suas turmas e horários na semana e resolver
exceções. Contar apenas turmas não mostra a carga: algumas se encontram duas vezes por semana,
uma hora por dia; outras concentram duas horas num único dia. Uma substituição muda quem atende
um encontro, enquanto uma saída pode deixar compromissos futuros sem docente.

Vincular esses trabalhos obrigatoriamente ao login também não serve: a administração precisa
organizar a atuação de professores que ainda não usam o sistema.

## Solução e sucesso esperado

Oferecer uma experiência administrativa para encontrar e cadastrar professores com nome, CPF e
e-mail, consultar sua semana e registrar substituições e encerramento de atuação. Acesso ao
sistema é uma escolha explícita, independente da possibilidade de receber turmas e substituições.

A visualização semanal organiza os horários em blocos identificados por turma, com delimitação
de cada hora-aula. **Hora-aula é uma unidade de 60 minutos**; um encontro de duas horas deve
mostrar suas duas unidades sem se transformar em dois encontros ou duas chamadas.

Associar ou trocar o docente habitual continua no contexto de criação/manutenção da turma.
Redistribuição mais ampla pertence à operação de turmas e à organização semestral. A V2 fornece
cadastro, consulta e regras de atuação para essas operações; não cria um painel de redistribuição
em massa nem reimplementa a V1.

Sucesso é conseguir cadastrar um professor sem liberar seu acesso, atribuí-lo pela operação de
turmas, reconhecer seus compromissos semanais, substituir um encontro sem mudar a turma e
programar sua saída mantendo visíveis os compromissos que precisam de novo docente. Uma
coincidência de horários impede a atribuição e explica quais compromissos conflitam.

## Usuário e princípios de experiência

Usuário primário: administração da escola, seguindo o acesso administrativo existente. A V2
não entrega o portal do professor nem concede acesso às aulas por registrar uma substituição.

1. **Tempo legível:** a semana mostra dia, início, fim, turma e horas-aula, permitindo entender a
   distribuição sem deduzi-la da quantidade de turmas.
2. **Efeito e vigência explícitos:** diferenciar docente habitual, substituição pontual e saída
   programada; preservar a responsabilidade e a autoria dos fatos passados.
3. **Pendência acionável:** mostrar compromissos sem professor e conflitos no contexto da
   operação, com caminho para resolvê-los.

## Decisões confirmadas

| Assunto             | Decisão                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Cadastro            | Nome, CPF e e-mail.                                                                                                       |
| Disponibilidade     | Não registrar faixas disponíveis nem acordos de horários.                                                                 |
| Acesso              | Opt-in; professor sem acesso pode receber turmas e substituições.                                                         |
| Docente habitual    | Associado na criação/manutenção da turma.                                                                                 |
| Troca permanente    | Nova alocação com vigência hoje ou futura.                                                                                |
| Substituição        | Administração atribui outro professor a um encontro específico, mantendo o habitual da turma.                             |
| Conflito            | Coincidência de compromissos do professor bloqueia a atribuição.                                                          |
| Carga               | Turmas e horas previstas por semana; informação sem teto individual impeditivo.                                           |
| Semana              | Conjuntos de horários com delimitadores por turma e por hora-aula de 60 minutos.                                          |
| Saída               | Pode ocorrer hoje ou em data futura, deixando compromissos sem professor sinalizados. Na data efetiva, bloqueia o acesso. |
| Experiência docente | Acesso do substituto à aula e sua experiência ficam para uma entrega posterior.                                           |

Atuação e acesso precisam aparecer como estados distintos. Desabilitar login não significa,
por si só, retirar a pessoa de suas turmas. A data de saída define até quando ela pode assumir
compromissos; sua programação não deve apresentá-la como já desligada antes da vigência.

## Cenários que orientam o desenho

### Cadastrar antes de liberar acesso

A administração recebe nome, CPF e e-mail de um professor que começa na próxima reorganização.
Cadastra-o com acesso não habilitado. Ele fica disponível para atribuições compatíveis com sua
atuação. Liberar acesso depois utiliza sua identidade existente, sem cadastrar outra pessoa.

### Entender duas distribuições de mesma carga

Uma turma ocupa terça e quinta, das 18h às 19h. Outra ocupa sábado, das 9h às 11h. Ambas
representam duas horas-aula semanais. A semana mostra dois blocos separados para a primeira e
duas unidades consecutivas delimitadas dentro do encontro da segunda, sempre identificando a turma.

Essa unidade não aprova uma restrição de início apenas em horas cheias nem determina como
tratar durações fracionárias. Não inventar essas validações a partir do desenho da grade.

### Substituir somente um encontro

A administração abre o compromisso de quinta-feira e escolhe outro professor. O formulário
identifica turma, data e intervalo completo. Ao confirmar, a exceção fica visível e o docente
habitual continua responsável pelos demais encontros. Professor sem login também pode substituir.

Se o substituto já tem outra aula no mesmo intervalo, a operação é bloqueada e apresenta o
compromisso conflitante. Não gravar uma substituição parcialmente nem contornar o bloqueio com
uma justificativa. O recorte é por encontro: substituição de uma fração de um encontro de duas
horas não foi solicitada.

### Programar saída e resolver a cobertura

A administração informa uma data futura de encerramento. Antes de confirmar, a proposta é
mostrar turmas e encontros afetados. A saída não depende de resolver tudo primeiro: os
compromissos ficam sinalizados como pendentes a partir da vigência, com acesso ao contexto da
turma para atribuir novo docente. Substituições futuras já atribuídas em lugar do professor que
sai serão desfeitas e exigirão nova atribuição, mesmo que o substituto continue em atuação.
Bloquear o acesso do professor que sai na data efetiva. Não cancelar aulas nem apagar o professor
ou as substituições dos registros passados.

### Trocar o docente habitual na turma

A operação de turma escolhe um novo docente e uma data de vigência. A consulta semanal precisa
respeitar essa mudança sem atribuir encontros passados ao novo professor. A integração usa o
trabalho de V1 e não autoriza alterar a frente concorrente durante este planejamento.

## Direção estética e padrões existentes

Interface operacional compacta, sóbria e legível, coerente com o restante do Lazuli. Usar o
AppShell, as tabelas operacionais e os formulários existentes; dar à semana o espaço necessário
para ler os horários. Uma ação dominante por contexto, com edição, acesso e encerramento em
posições secundárias. Evitar métricas decorativas ou ações de mesma ênfase competindo no cabeçalho.

Cambria no texto e fonte numérica existente para horários e totais. Reutilizar cores, espaçamento,
bordas, foco e estados semânticos de `packages/ui/src/styles/tokens/`. O projeto usa Tailwind
via CSS e componentes Base UI; não há necessidade demonstrada de outra biblioteca ou tema.
As histórias DenseForm, DataTablePage e dos componentes são a referência de densidade e interação.

**Estrutura confirmada:** listagem de professores levando a uma consulta individual com semana,
turmas e situação cadastral. Dias em colunas e tempo no eixo vertical são uma proposta de
composição, ainda sem aceite visual. A grade deve explicitar turma, intervalo e substituição;
cor pode reforçar os agrupamentos, mas não ser sua única identificação.

**Carga confirmada na IA:** total referente à semana selecionada, com substituições identificadas
nos blocos. Descontar o encontro do substituído, somá-lo ao substituto e excluir cancelados.
A referência visual da exceção pode permanecer na consulta do substituído, sem entrar em seu
total. Não apresentar carga realizada, remuneração ou banco de horas. Compromissos sem professor
ficam reunidos na lista de Professores, com caminho para resolver na turma ou no encontro.

## Inventário de componentes

| Componente                                      | Tratamento                     | Uso                                                               |
| ----------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| AppShell, SidebarNav, MobileNavigation          | Reutilizar; estender navegação | Acesso administrativo a Professores.                              |
| DataTablePage, DataTable, paginação e filtros   | Reutilizar                     | Encontrar professores e consultar relações operacionais.          |
| Dialog, FormSection/FormRow, Field, Input       | Reutilizar                     | Cadastro, vigência e encerramento.                                |
| SearchSelect e controles de data existentes     | Reutilizar                     | Seleção de professor, semana e data efetiva.                      |
| Badge, Alert, EmptyState, carregamento          | Reutilizar                     | Acesso, atuação, substituição, conflito e pendência.              |
| Consulta semanal e blocos de hora-aula          | Criar em apps/web              | Composição específica, com unidades agrupadas por encontro/turma. |
| Formulário de substituição e resumo de impactos | Criar em apps/web              | Operações administrativas com efeito explícito.                   |

Não foi encontrado um componente compartilhado de agenda semanal pronto. Criar uma composição
da feature com os primitives existentes; extrair API compartilhada apenas se houver necessidade
concreta. Componentes respeitam o limite de 200 linhas de `docs/frontend/README.md`.

## Interações, estados e recuperação

Encontrar professor → abrir sua consulta → navegar pela semana → abrir um compromisso →
registrar substituição ou acessar a turma. Cadastro preserva preenchimento em erro e confirma
se o acesso foi habilitado. A grade distingue ausência de compromissos de falha de carregamento.

Saída programada mostra data e compromissos pendentes. Inativos e históricos precisam continuar
encontráveis. Atualizar os dados após salvar; conflitos ou mudanças concorrentes exigem nova
avaliação no servidor, sem apresentar uma confirmação baseada apenas no estado da tela.

O agendamento e a correção de aulas pertencem às suas operações. A grade não oferece arrastar
blocos para mudar horários nesta entrega. Não expor ações ou links para experiências ainda inexistentes.

## Responsividade e acessibilidade

Proposta: no desktop, semana com alinhamento temporal; em tela estreita, sequência de dias com
intervalos e agrupamentos preservados. Não reduzir sete colunas até tornar seus rótulos ilegíveis.
A navegação definida na IA conserva semana selecionada e contexto.

Permitir alcançar compromissos por teclado com rótulos completos de turma, data e intervalo.
Divisores de hora-aula não criam controles redundantes para o mesmo encontro. Foco visível,
retorno de foco nos diálogos, Enter para submeter e erros associados aos campos seguem o padrão
de formulários. Estados incluem texto; contraste alvo de 4,5:1 para texto normal e 3:1 para texto
grande e controles relevantes. Validar no navegador em desktop e largura estreita na construção.

## Contrato de integração e evidência atual

Na base local consultada, `User` contém nome, e-mail, papel e `isEnabled`, mas não CPF ou estado
de atuação independente. `classes/guards.ts` exige `TEACHER` com `isEnabled`; a autenticação
também usa esse campo. Atender ao opt-in exige separar elegibilidade operacional e acesso.
Reutilizar a identidade da pessoa; este brief não decide criar uma entidade paralela ou o schema.

`Class.teacherId` é obrigatório e aponta para User. Não representa vigência nem ausência de
docente após uma saída. `ClassSession` não identifica o professor responsável por encontro, e o
acesso existente usa o professor atual da turma. Trocar somente `teacherId` pode alterar acesso
a encontros antigos; a nova modelagem precisa preservar responsabilidades históricas e autoria
de confirmação/correção. Não confundir responsável pela aula com quem registrou uma ação.

Contrato funcional proposto para alinhar com V1 antes da implementação:

- A operação de turma consulta professores elegíveis por atuação e vigência, independentemente
  da liberação de login; criação de turma continua em V1.
- Uma troca permanente informa data efetiva e não reescreve encontros anteriores.
- Uma substituição referencia o encontro e o substituto, sem mudar o habitual nem conceder
  permissões docentes adicionais nesta V2.
- A saída pode deixar responsabilidade futura pendente sem cancelar o compromisso ou perder
  a referência histórica ao professor que saiu.
- Na data efetiva da saída, o acesso do professor é bloqueado. Substituições futuras ligadas
  aos seus encontros são desfeitas ao programar a saída e voltam à lista de pendências para
  nova atribuição; preservar o registro da atribuição anterior e sua autoria.
- A conferência de conflitos usa compromissos e intervalos efetivos, incluindo substituições;
  não depende de cadastro de disponibilidade ou apenas de aulas já geradas pelo worker.
- Hora-aula mede duração. A geração e identificação de encontros não devem ser fragmentadas
  apenas para desenhar divisores de 60 minutos.

O épico já registra hora-aula de 60 minutos e atribui recorrência à V1, carga à V2 e uso da
duração a V4/V6. A frente de implementação recebeu essa orientação diretamente do usuário.
Reconsultar seu código atualizado antes de fechar tarefas ou migrar relações; esta inspeção
não comprova integração pronta. Trabalho pesado/agendado mantém a fronteira do worker.

## Fora do recorte e refinamentos restantes

- Cadastro de disponibilidade, redistribuição em massa e planejamento do próximo semestre.
- Experiência do professor, acesso automático do substituto e novas permissões sobre histórico.
- Horas realizadas, remuneração, banco de horas, teto de carga e substituição parcial do encontro.
- Agendamento de introduções e atendimentos de V3/V6. Quando entregues, esses compromissos
  deverão participar da mesma conferência de conflitos; não antecipar seus fluxos ou modelos.
- Alterações retroativas, reativação e cancelamento de uma saída programada não foram definidos;
  não expor esses caminhos por inferência. Preservar dados históricos não autoriza construir
  um módulo geral de auditoria.

As duas decisões locais do encerramento foram fechadas: bloquear acesso na data efetiva e
desfazer substituições futuras já atribuídas em lugar de quem sai, exigindo nova cobertura. A
integração das vigências com as consultas de V1 deve ser alinhada antes da implementação. O
planejamento não autoriza iniciar a construção.

Não foi escolhido nem executado um protótipo de V2. Se houver workshop visual, combinar seu
uso com o usuário e seguir alternativas e validação de `docs/frontend/README.md`. O workshop
descartado de V1 não é referência aprovada. Esta etapa entrega documentação; revisão de design
depende de construção e pedido separado.
