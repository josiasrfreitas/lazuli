# Design Brief: Operação pedagógica

Consolidado em 07/10/2026 a partir dos relatos em [context/](context/), do
[épico #156](https://github.com/josiasrfreitas/lazuli/issues/156) e das decisões de V1 na
[issue #157](https://github.com/josiasrfreitas/lazuli/issues/157).

Este brief do módulo explica os problemas da operação e o entendimento de solução alcançado.
Ele orienta os briefs de cada vertical; não representa desenho completo das dez entregas.
“Confirmado” significa decisão de produto, não funcionalidade já implementada. As hipóteses
estão identificadas e não autorizam implementação. As tarefas e os critérios de entrega
permanecem nos work items; as restrições estruturais permanecem nos ADRs.

Os cenários abaixo ilustram as regras com situações fictícias. Não são relatos de alunos.

## Problema e resultado esperado

Administração, professores e departamento pedagógico precisam conectar alocação, planejamento,
realização das aulas e acompanhamento do aluno. Hoje os relatos e planilhas mostram esses fatos
em controles distintos; o registro via AppSheet alimenta parte deles. Essa evidência descreve a
operação e não constitui pedido de integração com AppSheet.

A solução é entregar experiências por responsabilidade operacional, preservando a identidade do
aluno, da turma e do percurso pedagógico. O sucesso é conseguir executar cada trabalho e entender
seus efeitos sem confundir programação com realização, matrícula com progresso ou atendimento
com aprovação. Cada seção abaixo registra um problema concreto e o grau de definição da solução.

## Princípios de experiência e limites

1. Mostrar o contexto da operação: turma, aluno e encontro têm responsabilidades distintas.
2. Explicitar o efeito e a vigência das ações, preservando o histórico necessário à continuidade.
3. Entregar por vertical utilizável, reaproveitando a linguagem visual do Lazuli.

Tom operacional, claro e compacto. Tabelas, formulários e tokens existentes são a referência;
nenhuma nova identidade visual ou integração externa está aprovada. A composição visual da V1
será refinada no produto. As outras verticais ainda precisam dos próprios briefs e arquiteturas;
não criar telas, abas ou modelos especulativos para dar aparência de completude.

## 1. Administrar uma turma exige um lugar próprio

**Problema.** Criar uma turma, consultar seu professor, horários e ocupação e gerenciar seus
vínculos são trabalhos sobre a turma. Uma página de aluno não oferece o contexto adequado
para essas operações. Concentrar todo o módulo pedagógico em abas do aluno também mistura
responsabilidades das diferentes verticais.

**Solução confirmada para V1.** Encontrar turmas numa tabela e abrir uma página própria de
cada turma. A página reúne os dados essenciais e a relação de alunos, com as operações de
matrícula no contexto do vínculo. A futura página do aluno continua sendo outra experiência.

**Cenário.** Para matricular alguém numa turma de terça e quinta, a administração encontra
a turma, abre sua página e consulta horário, professor e ocupação antes de registrar a entrada.
Não precisa abrir primeiro o cadastro de um aluno para administrar a turma.

**Consequência.** A navegação foi escolhida; a composição visual ainda será refinada no app.
O workshop foi descartado, e seu visual não recebeu aceite. Não criar abas vazias para as
outras verticais. Execução: [V1, slice 1](v1-turmas-matriculas/TASKS.md).

## 2. Trocar o vínculo operacional não pode apagar o percurso pedagógico

**Problema.** A turma em que o aluno participa e o estágio que ele está cursando são fatos
diferentes. Se todo o percurso depender da matrícula atual, uma pausa ou mudança operacional
pode interromper indevidamente referências a notas, progresso e planejamento.

**Solução confirmada.** Matrícula representa participação na turma; progresso pedagógico
representa posicionamento no estágio ao longo do tempo. Pausa e retorno preservam histórico
e continuidade. Não aprovam o aluno nem avançam seu estágio automaticamente. A separação é
uma decisão estrutural já aceita no [ADR 0009](../../docs/decisions/0009-separate-enrollment-from-pedagogical-placement.md).

**Cenário.** Um aluno PPT pausa durante um estágio e depois retorna. O retorno precisa
permitir reconhecer o percurso anterior, sem tratar a matrícula nova como um aluno começando
do zero e sem concluir automaticamente o estágio anterior.

**Limite.** A forma de preservar essa continuidade na persistência ainda precisa ser
implementada. Retorno com mudança de estágio exige decisão específica. Transferências,
inclusive Regular ↔ PPT, foram adiadas e não fazem parte da V1 atual. Não generalizar a regra
de retorno para resolver transferência por consequência.

## 3. Regular e PPT têm organizações pedagógicas diferentes

**Problema.** Um estágio único na turma atende ao regular, mas não representa uma turma PPT
com alunos em estágios ou ritmos distintos. Presencial e online tampouco explicam essa
diferença: são formatos de realização.

**Solução confirmada.** Regular tem estágio compartilhado; PPT tem posicionamento individual
por aluno. Organização Regular/PPT e formato presencial/online são dimensões independentes,
como estabelece o [ADR 0006](../../docs/decisions/0006-model-class-modality-as-independent-axes.md).
O catálogo distingue linha de produto, trilha e estágio, sem presumir equivalência entre
trilhas ([ADR 0008](../../docs/decisions/0008-model-the-academic-catalog-hierarchy.md)).

**Cenário.** Na matrícula regular, o estágio vem da turma. Na matrícula PPT, a administração
informa o estágio do aluno; os colegas não precisam estar no mesmo estágio.

**Consequência.** Formulários e consultas precisam mostrar essa diferença. Não inferir estágio
a partir de “online”, nem criar regra de exclusividade de matrícula por trilha sem decisão.

## 4. Capacidade orienta a operação, mas a escola precisa de flexibilidade

**Problema.** A escola quer enxergar turmas cheias e excedentes sem depender de uma autorização
especial para acomodar um aluno. Um bloqueio de capacidade ou justificativa obrigatória
introduz um obstáculo que o usuário expressamente decidiu evitar por enquanto.

**Solução confirmada para V1.** Mostrar ocupação e capacidade com indicação de turma cheia
ou acima da capacidade. Permitir matrícula normalmente, sem bloqueio, justificativa ou
permissão adicional por esse motivo.

**Cenário.** Numa turma com capacidade 8 e 8 alunos, a administração matricula o nono.
A operação é concluída e a ocupação passa a indicar 9/8 e excesso de capacidade.

**Consequência.** A regra deve valer no backend, não apenas no botão da interface. A
implementação atual exige `capacityOverrideReason` para ultrapassar o limite; isso precisa
mudar no [slice 2](v1-turmas-matriculas/TASKS.md). A sinalização não remove as demais
validações de matrícula, como existência da turma e duplicidade na mesma turma.

## 5. Programar uma mudança não significa que ela já aconteceu

**Problema.** A administração precisa preparar entradas, pausas, retornos e saídas futuras.
Se registrar a intenção muda imediatamente a relação de alunos ou a ocupação, a tela deixa
de representar a operação de hoje. Apagar uma programação cancelada também perde o histórico.

**Solução confirmada para V1.** Distinguir situação vigente, movimentação programada e registro
histórico. Permitir hoje ou data futura, considerando o dia de negócio em America/Sao_Paulo.
Permitir cancelar uma programação antes da data efetiva, preservando autoria e registro.
A pausa libera a vaga na data efetiva; o retorno exige escolher turma e não reserva a vaga anterior.

**Cenário.** Uma pausa marcada para a próxima semana não tira o aluno da turma hoje.
Se for cancelada antes da data efetiva, ele continua na turma e o cancelamento fica registrado.
Se a pausa ocorrer, um retorno posterior não garante lugar na turma anterior.

**Limite.** A interpretação temporal precisa ser única nas consultas e mutações. Limites
exatos dos intervalos de datas devem ser documentados e testados na implementação; este
entendimento não aprova uma representação de banco específica. Pausa não estende
automaticamente o prazo do plano individual.

## 6. Corrigir o passado pode atingir fatos que já foram registrados

**Problema.** Alterar retroativamente a data de uma matrícula pode mudar quais aulas e
registros pertencem ao período de participação. Tratar isso como uma edição comum pode
produzir inconsistência ou reescrever silenciosamente o histórico.

**Solução confirmada em princípio.** Usar um fluxo de correção justificada, avaliar os
registros afetados e preservar autoria e histórico. Uma alteração operacional não pode
apagar nem recalcular silenciosamente frequência, notas ou planos.

**Cenário.** A administração percebe que registrou uma entrada uma semana depois da data
correta. Antes de confirmar a correção, precisa entender quais encontros e registros daquele
intervalo serão afetados.

**Em aberto.** O tratamento concreto de aulas e frequência já registradas e os impactos que
impedem a correção ainda não foram definidos. O [slice 4](v1-turmas-matriculas/TASKS.md)
prevê uma prévia dos impactos, mas sua escrita depende dessa decisão. Não apresentar esse
fluxo como completamente especificado ou pronto para implementação sem a definição pontual.

## 7. Planejamento, execução e conclusão do estágio são fatos distintos

**Problema observado.** O planejamento PPT é elaborado manualmente com datas, lição e página
alvo. Os exemplos têm revisões, atividades sem página e planos que atravessam a virada do ano.
A página prevista não comprova conteúdo realizado; repetir uma atividade pode ser válido.
No regular, é necessário organizar o conteúdo do estágio para o semestre.

**Solução confirmada.** Ter cronograma compartilhado no regular e plano individual por aluno
no PPT, com atividades, datas e limite de duração. Registrar separadamente o que foi realizado:
por turma no regular e por aluno presente no PPT. O prazo planejado não é a data de conclusão
efetiva do estágio. A operação precisa de auxílio para elaborar e acompanhar esse planejamento.

**Cenário.** Uma revisão ocupa o encontro previsto para avançar no livro. O registro deve
mostrar o que ocorreu sem transformar a revisão em avanço nem alterar retroativamente a
intenção original do plano.

**Em aberto.** Templates, sugestões automáticas de distribuição, significado de K.T., revisões
e tratamento de desvios precisam de descoberta em V9/V4. O usuário informou que reposições
costumam tratar desvios do regular; isso não define aprovação ou extensão automática do
semestre. Geração automática de planos não foi aprovada.

## 8. “Reposição” reúne problemas diferentes na linguagem da operação

**Problema observado.** A mesma planilha reúne reposição de falta, complemento de horas PPT,
reforço e prova de segunda chance. Dar o mesmo efeito a todos confundiria compensação de
frequência, carga horária, aprendizagem e avaliação.

**Solução confirmada.** Distinguir as finalidades. Na reposição de falta, o comparecimento
confirmado compensa a frequência, preservando a falta original e impedindo compensação
duplicada. Complemento de horas e reforço não pressupõem falta. Agendar uma prova não
registra sua nota nem confirma aprovação.

**Proposta ainda em descoberta.** Organizar essas finalidades sob um conceito de atendimento
pedagógico agendado. `Makeup` continua designando especificamente reposição de falta; o nome
e a estrutura do conceito mais amplo não estão fechados.

**Cenário.** Dois alunos comparecem a atendimentos: um recupera conteúdo de uma aula perdida;
outro busca reforço sem ter faltado. Só o primeiro tem uma falta de origem a compensar.

**Em aberto.** A planilha sugere cobertura de mais de uma falta por atendimento, mas isso não
fecha cardinalidade, cobertura parcial ou cálculo por horas. Taxas mencionadas nas planilhas
não autorizam cobrança automática. V6 resolve essas regras; V7 resolve notas e recuperação.
O acompanhamento de contatos motivados por faltas também pertence a V6.

## 9. Média geral pode esconder uma competência insuficiente

**Problema.** Uma nota alta numa competência não demonstra domínio de outra. Uma média geral
que permita compensação entre competências não corresponde ao critério confirmado pela escola.

**Solução confirmada.** Cada estágio tem dois blocos; cada bloco contém oral, listening,
written e participação, de 0 a 100. Calcular a média de cada competência entre os dois blocos,
com pesos iguais. Cada uma deve atingir pelo menos 60; exatamente 60 atende ao corte.
Permanece a confirmação pedagógica antes do remanejamento.

**Cenário.** Médias 80, 75, 59 e 90 não atendem ao corte em todas as competências, mesmo que
a média geral seja superior a 60. O sistema deve evidenciar a competência abaixo do corte.

**Em aberto.** Arredondamento, notas incompletas, recuperação, repetência, autoria e fim da
trilha pertencem a V7. A existência atual de um comando para avançar estágio PPT não significa
que a confirmação pedagógica já esteja implementada.

## 10. Participar de uma aula de entrada não equivale a estar matriculado

**Problema observado.** Aula experimental e aula introdutória têm organizações diferentes.
Misturá-las exige horários inadequados ou cria vínculos antes de existir matrícula.

**Solução confirmada.** Experimental é participação do interessado num encontro de turma
existente, usando o horário desse encontro. Introdutória é um encontro agendado com professor
para apresentar o curso personalizado. Agendamento, presença e matrícula posterior são fatos
separados, tratados em V3.

**Cenário.** Um interessado participa de uma turma regular na terça; outro agenda uma
introdução ao PPT na sexta. Comparecer a qualquer dos encontros não os matricula automaticamente.

**Em aberto.** Cadastro mínimo do interessado, convidados, disponibilidade, remarcações e
confirmação de matrícula ainda precisam de desenho. Nivelamento continua externo; registrar
seu estágio indicado não substitui matrícula ou progresso efetivo.

## 11. Relatar uma ocorrência não equivale a executar uma intervenção

**Problema observado.** O professor relata situações atípicas; o departamento pedagógico
analisa e acompanha tratativas que podem continuar além da aula. Um registro único de texto
não distingue relato, ação inicial, decisão de intervir e acompanhamento.

**Solução confirmada.** Distinguir ocorrência e intervenção. Preservar o relato do professor
e a ação inicial. Conforme definição de 10/10/2026, uma intervenção nasce de uma série de
ocorrências que exige a atuação de um professor. Ocorrências podem se relacionar entre si sem
intervenção automática. A intervenção reúne os relatos motivadores, identifica o professor
responsável e acompanha suas tratativas. Nem toda ocorrência exige intervenção.

**Cenário.** O professor registra uma dificuldade recorrente. O departamento analisa e pode
encerrar a ocorrência ou acompanhar uma intervenção. Escrever “encaminhar para reforço” não
agenda o atendimento; a ação operacional usa V6.

**Em aberto.** Acesso, conclusão e reabertura são decisões de V10. Relação entre ocorrências e
intervenção motivada por uma série de relatos estão confirmadas. Contato por falta em V6 pode motivar intervenção, sem criar uma obrigatória.

## 12. Alocação de professores precisa distinguir turma e encontro

**Problema.** A chegada de professores acompanha o aumento da demanda e a reorganização de
turmas. A administração precisa reconhecer os compromissos de cada professor e resolver
substituições e saídas, sem confundir atuação na escola com acesso ao sistema.

**Solução confirmada na descoberta de V2.** Cadastrar nome, CPF e e-mail; tornar acesso ao
sistema opt-in, independente da elegibilidade para receber turmas e substituições. Não registrar
disponibilidade ou acordos de horários nesta entrega. Associar docente na criação/manutenção
da turma; redistribuição pertence a esse contexto e à organização semestral. Troca permanente
tem vigência hoje ou futura. Substituição pontual pertence ao encontro e não muda o docente
habitual; conceder acesso ao substituto fica para a futura experiência do professor.

**Carga e agenda.** Carga prevista é informativa, sem teto individual. Exibir a semana com
blocos delimitados por turma e por hora-aula: cada unidade tem 60 minutos. Um encontro de duas
horas contém duas horas-aula; não se torna dois encontros por causa da divisão visual. Coincidência
de compromissos de um professor bloqueia a atribuição. Encerrar sua atuação hoje ou em data
futura pode deixar turmas/aulas sem professor, que devem permanecer visíveis como pendências.
Na data efetiva, seu acesso é bloqueado. Substituições futuras já atribuídas em seus encontros
são desfeitas ao programar a saída, exigindo nova cobertura mesmo se o substituto segue ativo.
O histórico das atribuições anteriores é preservado.

**Cenários.** Uma turma de terça e quinta, com uma hora por dia, e outra de sábado, com duas
horas consecutivas, contribuem com duas horas-aula semanais cada. Um professor assume só o
encontro de quinta sem receber acesso automático à turma. A saída programada de outro professor
mostra quais compromissos precisarão de novo docente, preservando o passado.

**Integração e limites.** O [brief de V2](v2-operacao-professores/DESIGN_BRIEF.md) detalha a
experiência e distingue decisões de propostas; a [#158](https://github.com/josiasrfreitas/lazuli/issues/158)
organiza a execução em três entregas verticais. A implementação de V1 segue em paralelo;
alinhar o contrato de responsabilidade por turma/encontro antes de alterá-lo. Introduções e
atendimentos continuam em V3/V6; sua integração futura não autoriza entregar esses fluxos na V2.

## 13. Presença informada pelo aluno ainda precisa de confirmação docente

**Problema.** Facilitar a coleta de presença não elimina ambiguidades de identidade nem a
responsabilidade de confirmar quem participou do encontro.

**Direção confirmada para V5.** QR/link por aula aberto pelo professor, com validade; identificação
pelo nome e correspondência automática apenas quando clara, pedindo escolha em ambiguidades.
Presencial usa localização; online usa link ou registro docente. Registro manual continua possível,
e o professor revisa e confirma a presença na baixa da aula.

**Em aberto.** Validade exata, prazo de reabertura, precisão e raio de localização e tratamento de
falhas precisam de definição. Os parâmetros de protótipos descartados não são decisões de produto.
V5 pode ser entregue depois de V4; coleta por QR não bloqueia registro manual de aulas.

## 14. Disponibilidade e organização do próximo semestre mudam com o tempo

**Problema.** Reaproveitar uma disponibilidade antiga pode levar a uma alocação incompatível.
Ao mesmo tempo, a escola precisa organizar o próximo semestre enquanto o atual ainda funciona,
sem exigir que todos os alunos e professores estejam resolvidos de uma só vez.

**Direção confirmada.** Disponibilidade tem validade; confirmar dados vencidos ou reaproveitados
antes de efetivar uma alocação dependente deles. Invalidar disponibilidade não altera matrícula
vigente. Em V8, permitir planejamento contínuo e confirmação parcial da operação seguinte,
considerando pendências do regular e planos PPT em andamento.

**Em aberto.** Prazo de validade, representação de disponibilidade, conflitos, publicação parcial
e reconciliação com alterações na operação precisam de desenho em V3/V8. Assistência para
organizar a alocação não significa distribuição automática aprovada.

## Fronteiras que todas as soluções preservam

- Calendário acadêmico, duração do compromisso comercial e vencimentos financeiros são distintos
  ([ADR 0005](../../docs/decisions/0005-separate-academic-and-commercial-calendars.md)). Pausar
  matrícula não muda contrato ou gera cobrança automaticamente.
- V8 organiza a operação do próximo semestre; V9 organiza o conteúdo e o prazo do estágio.
  Um plano individual PPT pode continuar através de semestres. A organização do semestre
  seguinte não pressupõe conclusão de todos os percursos no semestre atual.
- Histórico de movimentação e autoria das ações fazem parte das entregas. Isso não autoriza
  construir um módulo geral de auditoria ou uma plataforma genérica de workflows.

## Vocabulário para conversar e implementar

O [CONTEXT.md](../../CONTEXT.md) é o glossário canônico. Esta tabela mapeia a linguagem da
operação para os termos do domínio; não cria novos modelos de persistência.

| Na operação                        | Termo do domínio         | Distinção essencial                                                     |
| ---------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| Turma                              | Class                    | Grupo que se encontra num horário; diferente de um encontro particular. |
| Aula da turma                      | Class Session            | Encontro datado da turma.                                               |
| Matrícula na turma                 | Enrollment               | Vínculo operacional; diferente de contrato e posicionamento no estágio. |
| Estágio do aluno ao longo do tempo | Pedagogical Progress     | Percurso pedagógico; diferente da turma atual.                          |
| Programação / plano do estágio     | Stage Plan               | Intenção de conteúdo e datas; diferente do realizado.                   |
| Competência                        | Competency               | Dimensão avaliada individualmente.                                      |
| Bloco de avaliação                 | Assessment Block         | Um dos dois conjuntos de quatro notas do estágio.                       |
| Reposição de falta                 | Makeup                   | Tem falta de origem; não é sinônimo de todo atendimento.                |
| Aula experimental                  | Experimental Session     | Participação de interessado em encontro de turma.                       |
| Aula introdutória                  | Introductory Session     | Encontro próprio para apresentar o personalizado.                       |
| Ocorrência                         | Pedagogical Occurrence   | Relato de situação atípica.                                             |
| Intervenção                        | Pedagogical Intervention | Acompanhamento pedagógico que pode resultar da análise do relato.       |

## Distância entre solução definida e implementação

Inspeção do código em 07/10/2026; este quadro precisa ser revisto quando as entregas avançarem.

| Evidência atual                                                                                                                                                  | Consequência para a entrega                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`enrollment/data.ts`](../../packages/api/src/enrollment/data.ts) exige justificativa para exceder capacidade e usa `exitDate: null` nas consultas operacionais. | V1 precisa permitir excedente sem justificativa e implementar leitura coerente de vigências futuras.                                                  |
| [`enrollment/close.ts`](../../packages/api/src/enrollment/close.ts) fecha matrícula e progresso na data de hoje.                                                 | Pausa/retorno, continuidade e agendamento ainda precisam da solução temporal de V1.                                                                   |
| [`enrollment/advance.ts`](../../packages/api/src/enrollment/advance.ts) avança PPT sem consultar avaliações.                                                     | V7 precisa integrar confirmação pedagógica; o comando atual não comprova conclusão da vertical.                                                       |
| [`attendance/makeup-outcome.ts`](../../packages/api/src/attendance/makeup-outcome.ts) não aplica compensação ao percentual.                                      | V6 precisa implementar a regra de frequência confirmada e definir cobertura/cálculo.                                                                  |
| [`schema.prisma`](../../packages/db/prisma/schema.prisma) liga progresso à matrícula e reposição à aula de destino.                                              | Preservar continuidade e identificar falta de origem requer trabalho de modelagem; não inferir que os vínculos atuais já resolvem essas necessidades. |

## Como manter este entendimento

Ao resolver uma dúvida, atualizar a seção do problema correspondente, registrar fonte/data e
ajustar o work item afetado. Uma solução nova não transforma o código antigo em evidência de
aceite. Termos estáveis vão para o glossário; escolhas estruturais duráveis, quando houver
trade-off real, vão para `docs/decisions/`. Evidências operacionais sem dados pessoais permanecem em [context/](context/).
O recorte de V1 está no [brief da vertical](v1-turmas-matriculas/DESIGN_BRIEF.md), e sua execução
permanece em [TASKS.md](v1-turmas-matriculas/TASKS.md).
