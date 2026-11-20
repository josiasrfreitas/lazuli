# Formação de turmas · Continuidade do aluno na turma

Regras de produto acordadas em 19/11/2026 para orientar o refactor da Formação.

## Entradas para implementação na mesma branch

- Agente 1 · Continuidade na turma e bloqueios automáticos. Unifica o vocabulário e a regra no domínio, na revisão coletiva e na confirmação do vínculo. A lista agrupada por turma já oferece a estrutura necessária.
- Agente 2 · Acompanhamento na ficha do aluno. Conduz a mudança de interface na coluna esquerda, do relato inicial à passagem do caso, à negociação referenciada e ao desfecho.

As duas frentes partem da branch `workspace/ec2-lazuli` e das alterações já presentes nela. O ponto de encontro é a situação exibida para o mesmo aluno. A primeira frente fornece os status de continuidade. A segunda apresenta esses status e registra o trabalho humano que explica a evolução do caso.

## O que a secretaria está decidindo

Na Formação, a pergunta é **“contamos com este aluno para acompanhar a turma dele no próximo período?”**. O grupo pode avançar de estágio e continuar sendo a turma do aluno. A origem vem da matrícula anterior do aluno. O destino é a turma proposta para ele. A relação de continuidade entre turmas vem do plano (`SemesterClassPlan.sourceClassId`) e, depois da criação da turma, da relação entre as turmas (`Class.previousClassId`).

A Rematrícula cuida da permanência **na escola**, especialmente quando o contrato está perto do vencimento e o semestre está virando. A Formação usa essa informação para planejar vagas. A secretaria registra as exceções e dispensa a marcação individual de “vai ficar”.

## Status antes de confirmar a turma

**Pré-confirmado** é o status do aluno que deve seguir com a própria turma e está livre de impedimentos para essa continuidade.

**Continuidade bloqueada** é o nome do conjunto de status que impedem a continuidade. Na revisão individual, o aluno aparece com o status específico que se aplica, como **Sem contrato vigente** ou **Frequência baixa**. Cada um desses status exclui **Pré-confirmado**. Quando há vários impedimentos, todos continuam visíveis até a resolução de cada um.

Por exemplo, se o único impedimento é a falta de cobertura contratual na entrada, o status exibido é **Sem contrato vigente**. Quando a renovação assegura a cobertura exigida, o status passa diretamente a **Pré-confirmado**, desde que o aluno siga com a própria turma.

Quando a equipe registra explicitamente um impedimento para acompanhar a turma, ele impede a pré-confirmação enquanto estiver ativo. **Impedimento sinalizado pela equipe** é o nome provisório dessa situação. A equipe também pode registrar um risco de saída para acompanhamento.

**Confirmado na turma** é o resultado de efetivar ou agendar o vínculo. “Pronto para alocar” não deve aparecer como uma etapa adicional para quem já está pré-confirmado.

## Motivos e efeitos

| Situação                                                      | Efeito acordado                                                                                                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sem contrato vigente para a entrada                           | Bloqueio automático.                                                                                                                                                             |
| A cobertura contratual termina na primeira metade do semestre | Bloqueio automático. O critério usa o período letivo.                                                                                                                            |
| Material do estágio sem compra registrada                     | Bloqueio automático.                                                                                                                                                             |
| Notas insuficientes ou frequência baixa                       | Cada motivo é suficiente para bloquear automaticamente.                                                                                                                          |
| Notas incompletas ou presença sem registros                   | Ponto de atenção. A falta de dados, sozinha, não bloqueia.                                                                                                                       |
| Score de saúde do vínculo baixo                               | Status de atenção. Pode coexistir com **Pré-confirmado** e corroborar um relato de desengajamento. Se também houver bloqueio acadêmico, mostrar o motivo acadêmico que bloqueou. |
| Observação da equipe                                          | Texto livre para acompanhamento. Só a ação explícita de sinalizar um impedimento gera o bloqueio manual.                                                                         |
| Interessado aguardando entrada ou aluno sem turma de destino  | Precisa escolher turma. A pré-confirmação pressupõe uma turma cuja continuidade se possa identificar.                                                                            |
| Aluno pediu troca de turma                                    | Precisa escolher outra turma. Uma proposta de transferência pode ser confirmada no destino, sem receber o rótulo de continuidade com a turma anterior.                           |

## O que acontece ao resolver os impedimentos

- O impedimento automático deixa de valer quando o dado que o originou é corrigido. Por exemplo, a renovação pode resolver o bloqueio por cobertura contratual.
- O impedimento sinalizado pela equipe deixa de valer quando a equipe registra sua resolução.
- Quando o **último impedimento** é resolvido, o aluno volta automaticamente a **Pré-confirmado**, desde que ainda vá acompanhar a própria turma e seu vínculo ainda aguarde confirmação. A secretaria não precisa marcar “vai ficar”.
- Se houver impedimentos simultâneos, resolver um deles preserva os demais. Por exemplo, renovar o contrato de um aluno que também tem um impedimento sinalizado pela equipe resolve apenas o contrato. Ao resolver a sinalização, a pré-confirmação volta, mesmo que ainda exista uma observação de acompanhamento.
- Resolver um impedimento não confirma uma vaga, não desfaz uma confirmação já registrada e não recoloca na turma de origem quem pediu transferência ou teve a saída registrada.

## Como resolver cada bloqueio automático

A secretaria abre a pendência na Formação e segue para o fluxo responsável. Quando os dados na origem passam a atender ao critério, a pendência deve desaparecer sem baixa manual.

| Pendência                                                         | Ação no fluxo existente                                                                                          | Quando o motivo deixa de valer para a continuidade                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato vencido ou com vencimento na primeira metade do semestre | Registrar a renovação pela Rematrícula ou cadastrar o contrato no financeiro do aluno.                           | A cobertura passa a incluir a data de entrada e se estende além da primeira metade do período, sem lacuna entre os contratos usados para compor essa cobertura. |
| Material sem compra registrada                                    | Conferir o material e registrar a aquisição para o aluno e o estágio previsto.                                   | Há um registro válido de compra para aquele estágio. Orientar a família a comprar é uma providência em andamento.                                               |
| Frequência baixa                                                  | Realizar e registrar um atendimento de reposição vinculado às faltas de origem.                                  | Os minutos efetivamente compensados elevam a frequência ao mínimo exigido. Só agendar uma reposição não altera a frequência.                                    |
| Notas insuficientes                                               | Abrir **Revisar notas** e registrar uma recuperação na competência afetada, ou corrigir um lançamento incorreto. | A avaliação passa a indicar resultado suficiente nas competências. A Formação já lê o resultado efetivo, incluindo a recuperação.                               |

Os fluxos para renovar contrato, registrar material, repor faltas e lançar recuperação já existem. O retorno automático a **Pré-confirmado** após resolver o último motivo é a regra acordada para a integração da Formação.

## Como a revisão funciona hoje

Ao consultar o semestre, a API lê contratos, compras de material, notas, frequência e o score registrado. A partir desses dados e da proposta do aluno, monta os pontos de atenção, a lista de bloqueios e o rótulo de confirmação. Se um contrato renovado passa a cobrir a entrada, a próxima consulta já reflete essa cobertura. A consulta em si não grava uma resolução nem um histórico de cada mudança de rótulo.

A Formação guarda a proposta do aluno no semestre, as sinalizações da equipe e as alterações registradas na proposta. Ao publicar o vínculo, também guarda evidências da publicação. Os bloqueios da proposta são recalculados na revisão, na publicação e antes da entrada agendada.

## Risco de saída e acompanhamento na ficha do aluno

**Risco de saída** substitui **Pensando em sair**. A professora pode sinalizar o risco ao perceber desengajamento em aula, inclusive antes de o aluno falar sobre sair. O formulário pergunta se o aluno ou a família comunicou verbalmente a possibilidade de saída e oferece um campo livre para descrever o que aconteceu na turma ou o que foi dito. Um score baixo pode reforçar a percepção da professora. O relato da equipe e a manifestação do aluno têm origens distintas e devem continuar identificáveis no histórico.

Na ficha do aluno em contexto de Formação, a coluna esquerda fica dedicada aos impedimentos e ao que a equipe está fazendo a respeito deles, incluindo o acompanhamento do risco de saída. Quem assume o caso precisa conseguir ver o que motivou a sinalização, quem já atuou, o resultado da última tentativa e o que falta fazer.

| Momento                              | O que registrar na linha do tempo                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sinalização                          | Quem percebeu o risco, quando, quais fatos motivaram o registro e se houve manifestação verbal. Incluir o score como contexto quando for relevante.                                                                                                    |
| Tentativa de contato ou intervenção  | Quem tentou conversar, com quem, o que foi tentado e qual foi o resultado, inclusive quando ninguém respondeu. Uma conversa pode esclarecer a situação sem resolver o caso.                                                                            |
| Passagem para outra pessoa ou equipe | Quem assume o próximo passo, por qual motivo e o que foi combinado. Quando o motivo é financeiro, a equipe pode negociar diretamente ou tratar da negociação durante a renovação do contrato. A ficha referencia a negociação existente no Financeiro. |
| Reavaliação ou desfecho              | Depois da intervenção, registrar se o risco continua, mudou ou foi resolvido, e o que sustenta essa avaliação. Se a família comunicar que o aluno **não vai continuar**, a decisão de permanência na escola cabe à Rematrícula.                        |

Por exemplo, a professora relata que o aluno deixou de participar das atividades e registra que ele ainda não falou em sair. A secretaria tenta contato e fica sem resposta. Em uma segunda conversa, a família explica que a dificuldade é financeira. A secretaria encaminha o caso ao Financeiro e vincula a negociação. Depois, registra a resposta da família e se o risco continua. Assim, quem abrir a ficha consegue distinguir a tentativa, a providência tomada e a mudança efetiva na situação do aluno.

O atual **Histórico da proposta** dá lugar, nessa coluna, à linha do tempo dos acontecimentos que explicam a situação do aluno. Edições de texto e revisões da proposta ficam no log de auditoria. A publicação do vínculo é um acontecimento identificável quando fizer parte da progressão do aluno.

## Detalhes em aberto

A equipe usa **Registrar intervenção** para registrar o trabalho no caso. **Risco de saída** ativo bloqueia a pré-confirmação até a reavaliação que o resolve. Na integração entre ficha e lista, `exitRiskActive` identifica a sinalização atual. O valor legado `continuity === "LEAVING"` também indica risco. Uma troca de turma e um impedimento explícito preservam seus próprios motivos.

A cobertura deve passar do dia central do período letivo. Terminar exatamente nesse dia ainda bloqueia a continuidade. Quando coexistem um bloqueio automático e um sinalizado pela equipe, todos permanecem visíveis. A precedência visual entre eles continua em aberto.
