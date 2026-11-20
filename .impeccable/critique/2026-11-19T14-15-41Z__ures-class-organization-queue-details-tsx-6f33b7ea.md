---
target: Ficha do aluno na formação de turmas
total_score: 21
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 2
target_identity: "file:/Users/josiasribeiro/orca/lazuli/apps/web/src/features/class-organization/queue-details.tsx"
target_fingerprint: "sha256:fbd4201502fb07b9b4ac7d0a9f2a931357aa1796ba62a2daf15cb879def81229"
target_path: /Users/josiasribeiro/orca/lazuli/apps/web/src/features/class-organization/queue-details.tsx
timestamp: 2026-11-19T14-15-41Z
slug: ures-class-organization-queue-details-tsx-6f33b7ea
---
# Revisão da ficha de formação de turmas

Avaliação da ficha antes do refactor. A secretaria precisa comparar horários para o próximo semestre, entender a situação do aluno e distinguir o que pode resolver agora do que depende de acompanhamento pedagógico.

## O que a ficha já resolvia

A origem, o semestre e o estágio proposto ajudavam a situar o aluno. Cada horário abria uma proposta que podia ser revisada ou cancelada antes de salvar. O histórico identificava a data e o responsável.

## Prioridades

| Prioridade | Evidência na interface original | Direção |
| --- | --- | --- |
| P1 | Cinco controles de 32 px antecediam as opções. Três usavam a variante secundária e dois a variante discreta. | Destacar a ação local da ficha com o botão primário e dar aos atalhos do perfil um lugar próprio. |
| P1 | O pedido de mudança de horário ficava separado das opções. Em 390 × 844, a primeira turma começava a 900 px do topo. Professor e modalidade ocupavam a primeira linha. | Colocar o motivo da troca antes dos horários, mostrar dias e horas em primeiro plano e identificar a turma e o professor na mesma linha da ação de revisão. |
| P2 | Duas instruções pediam que a equipe escolhesse uma turma. A pendência de aprovação pedagógica aparecia na mesma lista, sem encaminhamento claro. | Consolidar instruções equivalentes. Expor os impedimentos para confirmação e manter o acesso a notas e chamadas. |
| P2 | A navegação preservava o foco. O movimento configurado era breve e pouco perceptível. | Conectar o nome na fila à identidade na ficha, indicar a direção da volta e respeitar a preferência por movimento reduzido. |

As sugestões são compatíveis segundo as regras de formação. A disponibilidade escrita na observação precisa ser comparada pela equipe. Destacar um horário como recomendado exigiria dados que esta ficha não possui.

## Heurísticas de Nielsen

| Heurística | Nota de 0 a 4 | Evidência |
| --- | --- | --- |
| Visibilidade do estado | 2 | O destino indefinido aparecia, mas a aprovação pendente se perdia entre as instruções. |
| Linguagem da escola | 2 | Dias, professores e estágios eram reconhecíveis. “Health Score” divergia da terminologia do perfil. |
| Controle e liberdade | 3 | Voltar restaurava o foco e o diálogo permitia cancelar. |
| Consistência | 2 | Escolher a turma e consultar o perfil recebiam destaque semelhante. |
| Prevenção de erros | 3 | A proposta tinha revisão e salvamento explícito. |
| Reconhecimento | 2 | A equipe precisava memorizar o pedido ao comparar os horários. |
| Eficiência | 2 | O atalho por turma ajudava, mas havia entradas redundantes. |
| Simplicidade visual | 1 | Controles, instruções e histórico competiam com a escolha. |
| Recuperação de erros | 2 | O histórico oferecia nova tentativa; o indicador de saúde apenas informava a indisponibilidade. |
| Ajuda contextual | 2 | O texto explicava a prévia, mas parte das pendências não indicava como prosseguir. |

A ficha original recebeu **21/40**. A pontuação é um julgamento de design dos revisores, sem teste com funcionários da escola.

## Impacto no uso diário

Quem conhece a secretaria conseguia abrir uma proposta em um clique, mas precisava reler os dias em todas as linhas. Para uma pessoa recém-chegada, “Escolher turma no perfil” podia parecer uma segunda etapa obrigatória. Quem usa teclado encontrava cinco controles antes das turmas.

## Evidência instrumental

Dois agentes independentes examinaram a ficha original no navegador do Orca. A varredura estática dos três componentes retornou zero ocorrências. O detector no navegador apontou a legenda de 11 px e uma hierarquia estreita de 13, 16 e 19 px. Os 11 px pertenciam a um metadado. Os achados sobre a escolha da turma vieram do fluxo e da comparação visual.

## Critério para a revisão do resultado

A equipe deve conseguir identificar o pedido, encontrar um horário adequado e explicar o que acontece ao clicar nele. O botão de voltar deve levar à posição anterior da fila, e a revisão de uma proposta deve permitir cancelar sem gravar.
