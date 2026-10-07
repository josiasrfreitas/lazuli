# Revisão da descoberta do módulo pedagógico

Revisão de 07/10/2026 do [épico #156](https://github.com/josiasrfreitas/lazuli/issues/156),
com o material do stakeholder e as correções confirmadas pelo usuário. A descoberta continua
em planejamento por vertical. A V1 já tem tarefas na #157; as demais verticais ainda
precisam definir regras operacionais e critérios de aceite. Esta revisão organiza o escopo
e os limites das entregas, sem representar conclusão do `design-flow`.

O novo entendimento acrescenta planejamento individual no PPT, aprovação por competência,
atendimentos com finalidades distintas, aulas de entrada e acompanhamento de ocorrências.
As oito verticais anteriores comportam parte disso. A proposta acrescenta duas: Planejamento
do estágio e Ocorrências e intervenções.

## Correções confirmadas

| Tema       | Entendimento revisado                                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PPT        | Cada aluno tem seu planejamento de estágio e seu próprio limite de duração. A operação precisa de auxílio para elaborar e acompanhar esse plano; o exemplo de planilha não estabelece um teto universal.               |
| Regular    | O conteúdo do livro orienta o cronograma compartilhado, que deve completar o estágio em um semestre. Reposições costumam tratar desvios; as consequências no sistema ainda precisam de definição.                      |
| Avaliações | Permanecem dois blocos por estágio. Cada bloco contém oral, listening, written e participação, na escala de 0 a 100. Participação é a quarta competência.                                                              |
| Aprovação  | Cada competência precisa ter média ≥ 60, incluindo participação. Exatamente 60 aprova. Uma média geral alta não compensa uma competência abaixo do corte.                                                              |
| Frequência | A reposição de uma falta compensa a frequência após comparecimento confirmado, preservando a falta original e impedindo compensação duplicada. O usuário confirmou a mudança em relação ao comportamento implementado. |
| Escopo     | Planejamento, ocorrências e intervenções, aulas experimentais e introdutórias entram no épico.                                                                                                                         |

Os pesos iguais entre os dois blocos permanecem conforme a descoberta anterior; a mudança
é calcular a média de cada competência separadamente. Com as duas notas lançadas,
`média da competência = (nota do bloco 1 + nota do bloco 2) / 2`.
Arredondamento, precisão, notas incompletas e recuperação pertencem ao workshop de avaliações.
A confirmação pedagógica antes do remanejamento também permanece.

## Evidências e implicações para o modelo

### Planejamento do estágio e registro da aula

A programação de atividades (imagem de referência local) identifica
aluno e estágio e organiza número da aula, data, lição, página alvo e descrição da aula
realizada. O [contexto do stakeholder](context/schedule/context.txt) confirma que a programação
é feita individualmente para alunos PPT. O exemplo atravessa a virada do ano e contém
revisão, vídeo, testes e atividades identificadas como K.T., cujo significado ainda precisa
ser esclarecido.

O plano expressa a intenção pedagógica. O registro da aula expressa sua execução. A página
alvo não comprova conteúdo realizado, e uma alteração no plano não deve reescrever uma aula
já registrada. Essa separação permite acompanhar atrasos e revisões sem perder o objetivo
original de cada encontro.

As revisões repetem páginas e os testes usam um traço no campo de página. A regra anterior
de exigir páginas em toda baixa precisa admitir atividades para as quais a página não se
aplica, com os detalhes definidos na vertical de registro. O sistema não deve interpretar
todo encontro como avanço numérico no livro.

Para o regular, o plano pertence ao percurso compartilhado da turma no semestre. Para o PPT,
o plano acompanha o aluno no estágio. A troca de turma, a pausa e a virada de semestre
precisam de cenários de continuidade para que datas operacionais não apaguem o planejamento.
O limite planejado de duração é distinto da data em que o estágio foi efetivamente concluído.

**Proposta de auxílio à operação:** permitir organizar atividades em datas, revisar o plano e
comparar previsto e realizado. Templates por livro/estágio e distribuição sugerida no calendário
são possibilidades a validar; geração automática de planos não está aprovada.

### Reposições e outros atendimentos

O [contexto de frequência](context/attendance/context.txt) informa que o registro de aula hoje
é feito no AppSheet e alimenta as planilhas. O conteúdo de reposição é digitado com base no
conteúdo efetivamente dado na aula perdida. A integração com AppSheet não foi solicitada.

A planilha de reposições (imagem de referência local) reúne reposição de
falta, aula complementar PPT, revisão e prova escrita de segunda chance. Há também uma
descrição que referencia duas datas de falta no mesmo atendimento, horários de durações
distintas e remarcações com indicação de taxa ou isenção.

O termo operacional “reposição” abrange finalidades que precisam ser distinguíveis:

| Finalidade                       | Relação com a falta e o resultado esperado                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reposição de conteúdo perdido    | Referencia a aula perdida e o conteúdo a trabalhar; o comparecimento confirmado compensa a frequência, preservando a falta original.                           |
| Complemento de carga horária PPT | Atende à necessidade individual de horas; não se pode presumir uma falta específica.                                                                           |
| Reforço                          | Trabalha uma dificuldade de aprendizagem; realizar a aula não comprova automaticamente que a dificuldade foi resolvida.                                        |
| Avaliação extraordinária         | A planilha mostra segunda chance de prova; agendamento e comparecimento pertencem à operação do atendimento, enquanto nota e resultado pertencem a avaliações. |

**Proposta de conceito:** atendimento pedagógico agendado, com finalidade explícita e relação
com falta quando aplicável. Isso permite reaproveitar a organização de horário, professor,
conteúdo, comparecimento e remarcação sem atribuir a todos os atendimentos o mesmo efeito
sobre frequência ou notas. “Makeup” continua identificando especificamente a reposição de falta
no glossário; o nome do conceito mais amplo é uma proposta para o workshop.

A planilha sugere que uma reposição pode atender mais de uma falta. Essa cardinalidade,
cobertura parcial, compensação por horas e prevenção de compensação duplicada precisam
ser validadas antes do desenho de persistência. As menções a taxas também exigem descoberta;
elas não bastam para definir cobrança automática ou alterar o módulo financeiro.

### Acompanhamento de faltas

O controle de faltas (imagem de referência local) contém data da falta,
data do contato, descrição, contagem mensal e responsável. Além de registrar presença,
a operação acompanha o motivo da ausência e o retorno obtido no contato.

Esse acompanhamento cabe em Reposições e frequência. Um contato por falta pode levar a
uma intervenção, mas não deve criar uma intervenção obrigatória para cada ausência.
Critérios para destacar reincidência e responsabilidade pelo contato ficam no workshop.

### Ocorrências e intervenções

O [contexto de ocorrências](context/occurrences/context.txt) define a separação: o professor
registra uma situação atípica após a aula e o departamento pedagógico analisa se haverá
intervenção. A planilha de ocorrências (imagem de referência local) contém
tipo, descrição, ação inicial, plano de ação, manifestação do departamento e conclusão.
A planilha de intervenções (imagem de referência local) mostra tratativas
em datas distintas e uma pessoa responsável pelo acompanhamento.

**Proposta:** preservar o relato e a ação inicial do professor, e acompanhar a análise,
o responsável, as tratativas e o encerramento da intervenção. Uma ocorrência pode ser
tratada sem intervenção. Ainda é preciso definir se uma intervenção pode nascer diretamente
ou reunir várias ocorrências, quem pode consultar os relatos e o que comprova conclusão.

A intervenção pode resultar em reforço, contato com responsável ou mudança de turma. Essas
ações devem usar as verticais correspondentes. Registrar “mudança de turma” no relato não
equivale a executar uma transferência de matrícula.

### Aulas de entrada

O [contexto de agendamento](context/schedule/context.txt) distingue aula experimental, na
qual o interessado participa de uma turma existente, de aula introdutória, agendada com
professor para apresentar o curso personalizado. A planilha (imagem de referência local)
registra agendamento, professor, estágio, material, presença e matrícula posterior.

A aula experimental usa a data e o horário do encontro da turma. A introdutória precisa
de agendamento próprio. A presença nesses encontros e a matrícula regular são fatos distintos.
Ambas cabem em Entrada e alocação de alunos; criar uma vertical apenas para elas fragmentaria
o mesmo percurso de entrada.

Ficam para o workshop o cadastro mínimo do interessado, a ligação com um aluno já cadastrado,
remarcações, convidados na lista da aula, capacidade, material e confirmação de matrícula.

## Distribuição proposta entre as verticais

V1 a V8 conservam a identificação da divisão anterior. V9 e V10 são acréscimos; o identificador
não determina a ordem de entrega. Cada vertical continua exigindo seu próprio `design-flow`.

| Vertical                                 | Entrega utilizável e responsabilidade                                                                                                                                                          | Mudança nesta revisão                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| V1 Turmas e matrículas                   | Criar e consultar turmas; matricular, pausar, retornar e encerrar vínculos. Transferências adiadas.                                                                                            | Preservar a distinção entre movimentação operacional e continuidade do estágio/plano.                            |
| V2 Operação de professores               | Cadastrar e habilitar professores; alocar, consultar carga e registrar substituições.                                                                                                          | Considerar também compromissos introdutórios e atendimentos extraordinários na descoberta de agenda e carga.     |
| V3 Entrada e alocação de alunos          | Registrar estágio indicado e disponibilidade; encontrar turma; agendar e acompanhar aula experimental ou introdutória e a matrícula posterior.                                                 | Incorporar os dois fluxos de aula de entrada.                                                                    |
| V4 Registro e baixa da aula              | Registrar presença e o conteúdo realizado na turma regular ou por aluno PPT; confirmar e corrigir a aula.                                                                                      | Distinguir realizado de planejado; aceitar revisão e atividades sem página conforme sua natureza.                |
| V5 Presença pelo aluno                   | Coletar presença por QR/link com revisão e confirmação docente.                                                                                                                                | Manter como conveniência posterior ao registro manual funcional.                                                 |
| V6 Reposições, atendimentos e frequência | Acompanhar faltas e contatos; agendar reposição, complemento PPT, reforço e atendimento de avaliação; confirmar comparecimento e tratar remarcações.                                           | Ampliar finalidades; tratar compensação apenas quando aplicável, sem confundir presença, horas, conteúdo e nota. |
| V7 Avaliações e progressão               | Registrar oito notas nos dois blocos, consultar quatro médias e confirmar o resultado pedagógico e a continuidade do estágio.                                                                  | Incluir participação, escala 0–100 e corte individual por competência.                                           |
| V8 Planejamento do próximo semestre      | Formar/dividir turmas, distribuir alunos e professores e efetivar partes do próximo semestre.                                                                                                  | Continuar focada na organização do semestre; considerar planos e pendências individuais na continuidade.         |
| V9 Planejamento do estágio               | Elaborar e revisar cronograma de conteúdo da turma regular e plano individual PPT, com atividades, datas e limite de duração; acompanhar a execução quando os registros estiverem disponíveis. | Nova vertical, com valor próprio ao substituir a programação manual.                                             |
| V10 Ocorrências e intervenções           | Professor relata ocorrência; departamento analisa, acompanha tratativas, atribui responsável e conclui o caso.                                                                                 | Nova vertical, com fluxo e responsabilidade próprios.                                                            |

V9 merece uma vertical própria porque a programação de conteúdo e prazo é usada durante
o estágio, inclusive quando um aluno PPT atravessa semestres. V8 resolve a composição da
operação seguinte. V10 merece outra porque tem análise e acompanhamento pelo departamento,
com continuidade além de uma aula ou de um registro de presença.

## Dependências e ordem de descoberta

- V1 segue para implementação pela #157: tabela → página da turma. O workshop foi descartado; seu visual não foi aprovado.
- V2 e V3 resolvem a gestão de professores e a entrada/alocação. V1 pode começar com professores já habilitados, como definido na #156.
- Convém descobrir V9 antes de fechar V4, pois o plano esclarece atividades e referências de conteúdo. Registrar aulas manualmente não precisa esperar o planejador completo; comparar previsto e realizado precisa das duas entregas.
- V4 sustenta a confirmação de presença, a identificação do conteúdo perdido e a integração de V6 com frequência. V5 não bloqueia essas entregas.
- V7 pode avançar com turmas e estágios, sem esperar QR. V6 agenda atendimentos de avaliação; V7 define o efeito das notas e da recuperação.
- V10 pode começar com relato e tratativa administrativa a partir de alunos, turmas e professores. As ações de transferência e atendimento usam V1 e V6 quando disponíveis.
- V8 integra disponibilidade, professores, matrículas e resultados pedagógicos; deve contemplar a continuidade de planos PPT e pendências do regular.

Os pontos de integração precisam de cenários nos workshops envolvidos. Não exigem uma
vertical técnica de calendário genérico nem um mecanismo genérico de workflows.

## Compatibilidade com as decisões e o código atual

As decisões [0005](../../docs/decisions/0005-separate-academic-and-commercial-calendars.md),
[0006](../../docs/decisions/0006-model-class-modality-as-independent-axes.md),
[0008](../../docs/decisions/0008-model-the-academic-catalog-hierarchy.md) e
[0009](../../docs/decisions/0009-separate-enrollment-from-pedagogical-placement.md)
continuam compatíveis com este entendimento. Prazo pedagógico não redefine contrato ou
parcelas; regular compartilha estágio; o catálogo ordena estágios dentro da trilha; matrícula
e progresso pedagógico são fatos separados. Um prazo planejado não deve preencher a data
de encerramento de um progresso ainda ativo.

Há diferenças concretas entre a descoberta e a implementação que precisam entrar no trabalho:

| Área                    | Evidência no código                                                                                                                    | Consequência para a vertical                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Continuidade do estágio | `PedagogicalProgress` está ligado a `Enrollment` e contém estágio, início, fim e motivo.                                               | V1/V7/V9 precisam definir continuidade de notas e plano entre matrículas sem usar matrícula como identidade de todo o percurso. O desenho ainda está aberto.                         |
| Avanço PPT              | `packages/api/src/enrollment/advance.ts` avança ao próximo estágio sem consultar avaliações.                                           | V7 precisa integrar a confirmação pedagógica; a existência do comando não significa que a regra nova já está atendida.                                                               |
| Reposição               | `Makeup` liga a matrícula de origem a uma aula de destino; não identifica a falta original.                                            | V6 precisa resolver origem e cobertura da reposição e agendamentos fora de uma aula regular existente.                                                                               |
| Frequência              | `makeup-outcome.ts` e os testes de frequência excluem reposições do percentual, enquanto a #156 prevê compensação após comparecimento. | O usuário confirmou a compensação para o novo módulo. V6 precisa alterar o cálculo e a cobertura de testes mantendo a falta original; o comportamento atual não atende ao requisito. |

Fontes de implementação: [schema](../../packages/db/prisma/schema.prisma),
[avanço](../../packages/api/src/enrollment/advance.ts),
[resultado de reposição](../../packages/api/src/attendance/makeup-outcome.ts),
[teste de frequência](../../packages/api/test/attendance/percent.integration.test.ts).

## Pendências dos workshops

| Dono | Questões a resolver                                                                                                                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1   | Retorno com mudança de estágio e efeitos das correções retroativas. Capacidade apenas visual; transferências adiadas. Ver tarefas da #157.                                                                                                     |
| V2   | Disponibilidade, conflitos de agenda, substituição e acesso do professor responsável por cada tipo de encontro.                                                                                                                                |
| V3   | Cadastro do interessado, convidados, experimental versus introdutória, vínculo com matrícula, validade da disponibilidade e aluno sem vaga.                                                                                                    |
| V4   | Baixa com atividade sem livro, aula cancelada ou sem presentes, correções, autoria e integração com o plano.                                                                                                                                   |
| V5   | Prazo/reabertura, homônimos, localização, falhas e alternativa manual.                                                                                                                                                                         |
| V6   | Como calcular a compensação de frequência; uma ou várias faltas por atendimento; cobertura parcial; horas versus encontros; contatos; conteúdo sugerido a partir da aula perdida; cancelamento, remarcação e significado das taxas existentes. |
| V7   | Precisão e arredondamento; notas incompletas; recuperação por competência; critérios da nota de participação; responsáveis por lançamento e confirmação; repetência e fim da trilha.                                                           |
| V8   | Publicação parcial, conflitos e alterações posteriores ao rascunho; continuidade dos alunos com pendências.                                                                                                                                    |
| V9   | Como elaborar o plano individual, limite de duração e revisões; feriados e pausas; templates de conteúdo; significado de K.T.; tratamento explícito de desvios do cronograma regular.                                                          |
| V10  | Intervenção direta ou originada em ocorrência; agrupamento de relatos; responsáveis, acesso, tratativas, conclusão e reabertura.                                                                                                               |

O usuário confirmou que reposições costumam tratar desvios do cronograma regular, mas não
definiu ainda a consequência no sistema. A proposta para o workshop é mostrar o desvio e sua
tratativa, sem presumir aprovação, mudança automática de estágio ou extensão automática
do semestre.

## Fontes e estado do design flow

A discussão consolidada anterior está na #156. Os arquivos em `context/` são evidência
operacional, e as respostas do usuário de 07/10/2026 confirmam as correções acima.
As imagens originais com dados de alunos permanecem locais; somente os textos de contexto
e os entendimentos extraídos delas são versionados.
Os exemplos foram analisados pelos campos e fluxos; dados pessoais das planilhas não são
necessários nesta revisão.

O workshop de V1 foi encerrado e removido a pedido do usuário em 07/10/2026.
A direção escolhida é tabela de turmas → página própria da turma; o visual do protótipo
não foi aprovado. A implementação seguirá diretamente no app, em uma única issue com
quatro slices verticais descritos em [Tarefas de V1](v1-turmas-matriculas/TASKS.md).
Esse recorte atualiza a descoberta acima: transferências foram adiadas e capacidade
passou a ser somente sinalização visual, sem bloqueio ou justificativa adicional.
As decisões confirmadas e as dúvidas pontuais restantes estão registradas nas tarefas.
