# Revisão da ficha do aluno na formação de turmas

19 de novembro de 2026 · Lazuli · Secretaria e coordenação pedagógica

A ficha atende a duas decisões da equipe. A primeira é escolher uma turma que atenda ao pedido do aluno. A segunda é identificar o que precisa ser resolvido antes de confirmar a alocação. Na tela original, cinco controles com pesos visuais semelhantes apareciam antes dos horários. No celular, a equipe precisava rolar a página até para ver a primeira opção.

## O que mudou na ficha

| Ponto da revisão | Mudança entregue |
| --- | --- |
| Escolha de turma | **Escolher turma** ganhou o botão primário do Lazuli quando há um destino a definir. **Motivo da troca** fica perto das opções. Cada opção destaca dias e horários, identifica a turma e o professor e oferece a ação **Revisar**. |
| Situação do aluno | **Situação do aluno** reúne **Saúde do vínculo**, **Média no estágio** e **Presença**. O alerta **Antes de confirmar** reúne as pendências. A equipe pode abrir **Revisar notas** ou **Conferir chamadas** quando a situação pede esse acompanhamento. |
| Texto e destaque visual | Instruções repetidas sobre escolher turma deram lugar a uma única ação. Botões, alertas e etiquetas de situação usam os componentes do design system. A cor vem acompanhada de texto para identificar cada estado. |
| Cabeçalho e navegação | O avatar começa na mesma coluna da proposta. O retorno à fila fica fora da ficha, na barra superior, pelo link **Formação de turmas**. Na ida e na volta, a transição conecta o nome do aluno na fila ao cabeçalho da ficha. |

A disponibilidade registrada pelo aluno continua visível para comparação pela equipe. Clicar em **Revisar** abre a proposta com aquela turma selecionada. A equipe ainda pode cancelar ou salvar a escolha.

## O que foi observado no navegador

| Cenário | Resultado |
| --- | --- |
| Celular de 390 × 844 px | A primeira opção passou de 900 para 595 px do topo, **305 px acima** da posição original. O primeiro horário e o botão **Revisar** ficaram visíveis antes de rolar. |
| Alinhamento | Avatar e proposta começaram a 16 px da borda esquerda no celular de 390 px e a 192 px no desktop de 1440 px. O link de retorno ficou visível na barra superior nos dois tamanhos. |
| Revisão de uma proposta | A opção de terça e quinta às 19h abriu a turma correspondente. Foi possível cancelar com Escape e retornar à ficha. |
| Teclado e movimento | Ao abrir a ficha, o foco foi para o nome do aluno. Ao voltar, retornou à linha de origem. Com a preferência por movimento reduzido, a navegação manteve esse comportamento sem animar a transição. |

Dois revisores avaliaram a tela original de forma independente. A nota de **21/40** pertence à avaliação heurística inicial. As medidas acima documentam o resultado observado no navegador. O tempo de atendimento da secretaria ainda não foi medido com a equipe. [Revisão original com as evidências e os critérios](critique/2026-11-19T14-15-41Z__ures-class-organization-queue-details-tsx-6f33b7ea.md)
