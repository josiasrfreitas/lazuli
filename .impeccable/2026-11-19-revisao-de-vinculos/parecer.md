# Revisão de vínculos

19 de novembro de 2026 · Formação de turmas · Secretaria

## Decisão de produto

A secretaria passa de **Grade semanal → Revisar vínculos** para uma coleção de turmas de destino. A ficha de uma turma abre o grupo correspondente nessa mesma revisão. O usuário pediu a retirada da tabela e do botão “Por turma” da fila. A tela começa em **Todos**, inclui quem confirmou permanência e oferece o filtro **Confirmados**. [Entrada pela grade](../../apps/web/src/features/class-organization/page-view.tsx) · [Agrupamento da revisão](../../apps/web/src/features/class-organization/review-groups.tsx)

## O que as duas visões mostravam

- A antiga tela **Pendências por turma** reunia os alunos pela turma de origem. Isso ajudava a acompanhar a turma antiga, mas os alunos de uma coorte podem seguir para destinos diferentes. Na revisão, o cabeçalho identifica o destino em que a alocação será feita. O filtro de origem permite seguir a mesma coorte. Quem ainda precisa escolher uma turma tem um grupo próprio. [Regras de agrupamento](../../apps/web/src/features/class-organization/review-group-model.ts)
- A revisão individual repetia o estágio e “Permanece na turma”. No recorte inicial de 2027.1, havia 223 propostas em revisão e 60 prontas. As 16 primeiras linhas escondiam a turma e a vigência. Ao abrir o caso de troca de horário no celular, uma das duas pendências ficava abaixo do rodapé. [Lista anterior em desktop](lista-desktop.webp) · [Troca de horário no desktop](troca-desktop.webp) · [Troca de horário no celular](troca-celular.webp)
- A ficha da turma tinha uma ação que publicava todos os prontos, inclusive os ocultos pelos filtros do elenco. Na antiga revisão por aluno, mudar a busca podia reduzir o lote ou substituir marcações anteriores. Agora a secretaria marca alunos individualmente ou os prontos da turma exibida. O rodapé conta todos os marcados e indica quantos estão fora do filtro. **Ver lote** permite conferir os destinos antes da publicação. [Seleção e confirmação](../../apps/web/src/features/class-organization/review.tsx)
- **Confirmados** segue o estado de confirmação usado na ficha. Uma resposta “Fica na turma” pode confirmar permanência mesmo com uma aprovação pedagógica pendente. **Alocados** consulta as propostas publicadas. A linha do aluno mostra a vigência e o impedimento ou resultado da alocação. [Regra de confirmação](../../packages/domain/src/period-confirmation.ts) · [Filtros da revisão](../../apps/web/src/features/class-organization/review-filters.ts)

## Validação

Três agentes confrontaram a navegação da grade, o agrupamento e a publicação. No Orca, a revisão abriu pelo cabeçalho da grade. Foram exercitados filtro, seleção de uma turma e de um aluno, lote com duas turmas, remoção de uma turma do lote e retorno das fichas de turma e lead. Em 2026.2, os grupos do filtro **Confirmados** somaram 217 alunos. O filtro **Alocados** mostrou 221. Em 320 px, a seleção individual deixou o grupo parcialmente marcado e o botão final permaneceu visível.

No caso de troca de horário, a turma de origem estava em Essentials 1 e o estágio previsto era Essentials 2. As duas pendências e suas ações ficaram visíveis no celular. Com respostas de gravação simuladas só na aba do navegador, salvar outra turma moveu a proposta para o grupo de destino. Em outro caso, quatro alunos selecionados em duas turmas geraram dois envios de dois vínculos, uma mensagem de conclusão e o esvaziamento do lote. A suíte de testes também cobre a falha após a conclusão da primeira turma. [Cenários de regressão](../../apps/web/test/features/formation-review.unit.test.ts)
