# Handoff · Refactor da Revisão de vínculos

## Pedido do usuário

Redesenhar a página **Revisão de vínculos**, dentro de Formação de turmas. O usuário entendeu a finalidade depois de uma explicação, mas não conseguiu deduzi-la usando a interface. Considera a página feia, estática e muito parecida com a ficha individual. Quer mudar a composição visual, aproveitar a largura disponível e trabalhar filtros e ordenação. Aprova poder abrir um aluno, escolher e confirmar em lote. A direção visual e os controles exatos estão em aberto.

Trabalhar em `/Users/josiasribeiro/orca/lazuli`. Há alterações locais de várias frentes, inclusive na formação. Partir da interface presente nesse diretório. O usuário fornecerá as skills na nova sessão e pode acrescentar observações antes de começar.

## Para que a página existe

Na preparação do semestre, a secretaria propõe uma turma para cada aluno. Algumas propostas ficam prontas imediatamente. Outras dependem de uma resposta da família, de outro horário ou da resolução de um impedimento. A revisão reúne essas situações para a equipe decidir **quais alunos já podem ter a turma confirmada, qual será a turma e a partir de quando**. A equipe pode concluir um aluno por vez ou selecionar vários prontos.

Há três acontecimentos que a interface precisa tornar distinguíveis. **Registrar resposta** guarda o que o aluno informou. **Salvar proposta** guarda o destino escolhido para revisão. **Confirmar alocação** efetiva ou agenda o vínculo com a turma conforme a vigência. “Fica na turma”, “Pré-confirmado” e “Pronto para alocar” respondem a perguntas diferentes. Um selo “Confirmado” ao lado de um botão de confirmação pode deixar a pessoa sem saber o que ainda falta fazer.

A ficha aberta pela grade dá acesso às ações individuais e encaminha para a revisão. Na revisão, marcar um aluno inclui aquele registro na seleção. O botão do rodapé aplica a confirmação. O usuário precisou perguntar várias vezes onde a escolha passa a valer. A nova composição deve deixar esse efeito evidente antes do clique.

## Casos que a composição precisa comportar

| Situação | O que a secretaria precisa enxergar ou decidir |
| --- | --- |
| Acompanha a turma no próximo semestre | Reconhecer a continuidade do grupo e conferir estágio previsto, turma e vigência antes de confirmar. O grupo pode avançar junto de Essentials 1 para Essentials 2. |
| Avança de estágio e pede outro horário | Ver que o estágio previsto continua sendo Essentials 2. Consultar o motivo, comparar uma regular compatível e uma PPT ou criar uma turma vazia. Depois de salvar o destino, voltar à revisão sabendo o que mudou. |
| Repete o estágio | Identificar a decisão pedagógica e conferir se o destino comporta o estágio previsto. Um pedido de horário não implica repetência. |
| Nova entrada | Ler o destino e a vigência mesmo quando não existe uma turma de origem. |
| Sem resposta, sem destino ou com impedimento | Identificar qual informação falta e a ação que permite avançar. Hoje a ausência de resposta, isoladamente, não impede a seleção se houver destino e nenhum bloqueio. Preservar a regra de elegibilidade vigente. |
| Possível saída ou saída registrada | Distinguir acompanhamento de uma saída já registrada. Uma sinalização de possível saída deixa o aluno fora da seleção para alocar. |
| Alocação já confirmada ou transferência | Mostrar qual destino foi confirmado e a vigência. Uma transferência pode ter efeito futuro. Períodos encerrados servem para consulta. |

## Problemas de layout e direção de trabalho

Hoje a linha expandida monta o mesmo componente de detalhe usado na ficha individual. Segundo o usuário, origem e proposta ficam à esquerda, a situação do aluno fica deslocada à direita e sobra um grande vazio abaixo da origem. Quem veio comparar muitos alunos acaba lendo várias fichas completas. O problema persiste mesmo que se melhorem cores e espaçamentos isoladamente.

Desenhar a revisão a partir da tarefa coletiva. Com a lista fechada, deve ser possível comparar destinos, identificar quem pode ser confirmado e localizar quem exige atenção. Ao abrir um caso, aproximar a pendência da informação e da ação que a resolvem. Reutilizar controles e dados da ficha onde fizer sentido. Explorar uma composição própria para a revisão e preservar o acesso à ficha para investigação aprofundada.

Seguir o padrão de exploração de `docs/frontend/README.md`. Comparar três alternativas estruturais com os mesmos alunos. Possibilidades para o workshop incluem uma tabela comparável com expansão compacta, uma lista com painel lateral para o aluno em foco e uma fila agrupada pela próxima ação. Avaliar cada uma com seleção individual e múltipla, conteúdo curto e longo e largura estreita. Registrar a escolha do usuário antes de tratar uma direção como aprovada. “Estática” é a percepção relatada. Investigar hierarquia, densidade e resposta visual ao abrir, selecionar e confirmar antes de propor animação.

## Filtros e ordenação

Já existem busca por nome, escolha de período e recortes para propostas pendentes, alocados e todos. Investigar quais perguntas continuam difíceis. Exemplos para testar com a secretaria: “Quem posso confirmar hoje?”, “Quem ainda precisa de outra turma?”, “Quais alunos vão para esta turma?” e “Quais mudanças começam primeiro?”.

Avaliar filtros de prontidão ou pendência, turma de destino e estágio, e ordens por nome, destino ou vigência. São hipóteses. Definir a ordem inicial pelo trabalho mais frequente e testar como filtros, quantidade exibida e seleção interagem. Antes de confirmar, a pessoa precisa saber quantos alunos serão afetados, inclusive depois de mudar um filtro.

## Como avaliar no navegador

- Abrir a revisão pelo percurso normal e pedir a alguém que identifique o que pode fazer ali e o que acontece ao confirmar, sem explicar a página antes.
- Localizar um aluno pronto, um sem destino e um já alocado. Comparar o que cada linha mostra fechada, abrir o detalhe e retornar à lista.
- Percorrer o caso Essentials 1 → Essentials 2 com troca de horário. Conferir que registrar o pedido, salvar a proposta e confirmar a alocação têm consequências visivelmente distintas.
- Selecionar um aluno e depois vários. Alterar busca, filtro e ordenação. Conferir seleção, contagem, impedimentos e retorno após confirmar.
- Usar o navegador embutido do Orca com o servidor do workspace. Conferir em desktop e largura estreita a distribuição de espaço, foco de teclado e acesso à ação final. O pedido anterior foi de validação no navegador, sem checks estáticos.

## Pontos de entrada

Em `apps/web/src/features/class-organization/`, começar por `page-view.tsx` (entrada e controles), `review.tsx` (recortes, elegibilidade e seleção), `review-view.tsx` (lista e confirmação), `review-row.tsx` e `review-detail.tsx` (expansão e conteúdo compartilhado). `confirmation.ts` define a elegibilidade usada na interface. `review-publish.ts` envia a seleção por turma e informa quantos vínculos foram aplicados. O efeito da confirmação sobre os vínculos está em `packages/api/src/semester-organization/publish.ts`.

O [handoff da troca de turma](2026-11-19-handoff-alterar-turma.md) descreve os problemas anteriores dessa operação. A troca foi trabalhada depois daquele documento. Usar a versão local atual ao percorrer o caso. Esta entrega prepara o refactor da revisão; a escolha do novo layout continua aberta.
