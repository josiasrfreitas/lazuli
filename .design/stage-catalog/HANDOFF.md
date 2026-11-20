# Editor de estágios · issue 238

## Entrega no worktree

**Programação** mostra todas as unidades em sequência. O seletor Regular/PPT usa o controle segmentado compacto compartilhado com alto contraste. **Nova hora-aula (+60 min)** é a ação principal e permite escolher a unidade.

Cada hora tem uma linha **Adicionar atividade**. Clicar abre o formulário no fim. Arrastar a linha escolhe outra posição. As atividades existentes podem ser movidas pela alça. Pelo teclado, as setas movem a atividade ou escolhem a posição da linha de adição.

O formulário recebe uma página, uma faixa ou texto livre. A faixa traz as lições e atividades cadastradas no livro. A duração da nova atividade e das anteriores é editável na mesma tela. O salvamento exige soma de 60 minutos.

**Lições do livro** usa lição → página → atividade. No próprio índice da lição, o campo de páginas aceita um número ou um intervalo inclusivo como `1-15`. A inclusão preserva páginas existentes e seus exercícios. O lápis permite renumerar uma página na própria linha. A migração transferiu as páginas existentes para as lições e preservou os dados de origem. Títulos importados podem conter o termo “parte”.

No Orca, foram conferidos o seletor de programação, as duas unidades, a seleção de destino para a nova hora, a inserção por arraste e por teclado, a página 12 de Essentials 1 com duas atividades e a validação de minutos. Em desktop e celular o conteúdo rola dentro da área da página. Os testes focados cobrem a gravação das referências, reordenação, duração e proteção contra alterações concorrentes.

| Tela                | Desktop                                        | Celular                                        |
| ------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Programação         | [Ver matriz](review/programacao-desktop.png)   | [Ver matriz](review/programacao-celular.png)   |
| Adicionar atividade | [Ver linha](review/hora-desktop.png)           | [Ver linha](review/hora-celular.png)           |
| Faixa de páginas    | [Ver formulário](review/atividade-desktop.png) | [Ver formulário](review/atividade-celular.png) |

<details>
<summary>Handoff anterior à implementação do livro e dos diálogos</summary>

## Onde retomar

**A “página da track” é a tela onde se cadastram as lições.** No Orca, abrir **Estágios → Adultos / English Main → Essentials 1 → Lições do livro**. A aba **Programação** fica na mesma tela. No código, a rota é `/estagios/[id]`, o parâmetro é o ID do estágio e o componente é `StageEditor`. [Abrir Essentials 1 no banco local](http://lazuli.lazuli.localhost/estagios/4494ce00-32a5-42b2-9f64-94c43ab0fcac) · [Editor](../../apps/web/src/features/stage-catalog/detail.tsx)

A última rodada de acabamento foi aplicada à lista de entrada em `/estagios`. No editor, estão pendentes o cadastro completo do livro, a escolha desse conteúdo na programação e os modais da hora-aula. O pedido de `$impeccable polish` e `$impeccable typeset` continua valendo para as abas e os diálogos dessa tela.

**Checkout em 19/11/2026.** O trabalho está em `/Users/josiasribeiro/orca/lazuli`, branch `workspace/ec2-lazuli`, HEAD `6d43052e`. Há alterações sem commit na interface e na API, além de arquivos novos como a migração em rascunho e o CSS do catálogo. Retomar neste worktree. O arquivo `docs/development/pr305-lint-progress.md` tem alterações independentes.

## Entrega pedida

1. **Cadastrar o livro.** Em **Lições do livro**, abrir uma lição, cadastrar suas partes, as páginas de cada parte e as atividades de cada página. A hierarquia **lição → parte → página → atividade** pertence ao livro do estágio e é compartilhada por Regular e PPT.
2. **Abrir uma hora da matriz.** Selecionar a célula abre o modal da hora-aula. Inserir ou editar uma atividade abre o formulário em um diálogo, com uma única janela visível por vez. Salvar ou cancelar volta à hora. Fechar a hora devolve o foco à célula de origem e conserva unidade, filtro e rolagem.
3. **Usar o conteúdo cadastrado.** No formulário da atividade programada, cada escolha filtra a próxima. Por exemplo, **Lição 3 → Parte B → Página 18 → Exercício 2**. Trocar a parte limpa páginas e atividades incompatíveis. O vínculo deve reaparecer ao salvar, recarregar e reabrir a hora.

A atividade da página é conteúdo do livro. A atividade programada tem posição e duração na hora-aula. Os registros existentes aceitam várias referências a lições, partes em texto livre e páginas opcionais ou em intervalo. Preservar sua leitura e edição, a gravação atômica e o total de 60 minutos. **Ficou em aberto** se uma nova escolha pode terminar em nível intermediário ou incluir várias páginas ou atividades de uma vez.

## Estado real da implementação

| Frente          | Estado encontrado e ponto de retomada                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Banco           | O rascunho liga `BookLessonPage` diretamente a `BookLesson` e `BookPageActivity` à página. Falta representar a parte como entidade da lição e fazer cada página pertencer à sua parte. Em consulta somente leitura ao banco local, `20261119220000_edit_stage_catalog` consta como aplicada. `20261119233000_book_lesson_pages` está sem commit, sem registro em `_prisma_migrations` e as tabelas do rascunho estão ausentes. [Schema](../../packages/db/prisma/schema.prisma) · [Migração em rascunho](../../packages/db/prisma/migrations/20261119233000_book_lesson_pages/migration.sql)                                                                               |
| API             | `teachingPrograms.detail` devolve ID, sequência e título de cada lição. `editCatalog` cria e renomeia lições. Faltam o cadastro e a leitura dos níveis abaixo da lição. Em `editProgram`, persistir o vínculo da atividade programada com o conteúdo escolhido e validar no servidor a cadeia completa e o estágio. Manter compatibilidade com `ProgramActivityLesson.part`, `pageStart/pageEnd` e o controle de edição concorrente por `expectedChange`. [Leitura](../../packages/api/src/teaching-programs/read.ts) · [Catálogo](../../packages/api/src/teaching-programs/catalog-editor.ts) · [Programação](../../packages/api/src/teaching-programs/program-editor.ts) |
| Lições do livro | A aba `Lessons` lista títulos. **Adicionar lição** e o lápis abrem um diálogo para o título. Falta abrir a lição e percorrer suas partes, páginas e atividades. [Aba de lições](../../apps/web/src/features/stage-catalog/detail.tsx) · [Diálogo atual](../../apps/web/src/features/stage-catalog/catalog-dialog.tsx)                                                                                                                                                                                                                                                                                                                                                      |
| Hora-aula       | `UnitHours` e `HourRow` expandem a hora dentro da matriz. `ActivityForm` ainda passa `inline` a `EditorForm`. A variante padrão de `EditorForm` já usa o diálogo compartilhado. Ao trocar o fluxo, revisar também a proteção de troca de programação em `StageWorkspace`, que hoje procura um formulário dentro do painel da matriz. [Matriz](../../apps/web/src/features/stage-catalog/program-map.tsx) · [Formulário](../../apps/web/src/features/stage-catalog/activity-form.tsx) · [Diálogo compartilhado pelos editores](../../apps/web/src/features/stage-catalog/editor-form.tsx)                                                                                   |
| Testes          | O contrato atual usa renderização inline para inspecionar os campos. A integração cobre referências antigas, páginas livres e a distribuição de 60 minutos. Acrescentar cobertura da nova hierarquia, da rejeição de vínculos incompatíveis e da leitura após salvar. O fluxo de foco e de troca entre diálogos precisa ser exercitado na página real. [Contrato dos formulários](../../apps/web/test/features/stage-catalog-form-contract.unit.test.tsx) · [Integração do editor](../../packages/api/test/teaching-programs/editor.integration.test.ts)                                                                                                                   |

## Aceite no navegador

- Cadastrar uma lição com partes A e B, duas páginas em A e duas atividades em uma dessas páginas. Acrescentar uma página em B. Recarregar e percorrer o cadastro.
- Na matriz, inserir ou editar uma atividade no modal da hora. Conferir as opções da parte A, trocar para B e verificar a limpeza da seleção anterior. Salvar, recarregar e reabrir para conferir o vínculo, a posição e os 60 minutos. Exercitar também uma atividade antiga com páginas livres e uma hora com código de origem como **B.Y.S.**
- No Orca, em desktop e celular, abrir uma célula por teclado e testar Salvar, Cancelar e Escape. Conferir uma janela por vez, retorno à hora e, ao fechar, foco na célula e a mesma posição na matriz. Repetir com o filtro **Provas** ativo. O usuário reservou lint e typecheck ao agente na nuvem.

## Evidência já disponível

**Matriz.** Em Essentials 1, Unidade 2, a matriz mostrou 20 horas em cinco colunas em 1280 × 800. Em 390 × 844, mostrou duas colunas e 14 horas antes de rolar. O filtro de provas percorreu as duas unidades. Essas capturas registram a matriz que deve ser preservada ao mudar a abertura da hora. [Desktop](review/matriz-desktop.png) · [Celular](review/matriz-celular.png)

**Catálogo de entrada.** A lista em `/estagios` recebeu a revisão tipográfica de 19, 16 e 13 px para track, estágio e detalhes. A busca por E1, a volta do editor e o retorno do foco ao menu foram verificados. Em 390 × 844, os sete estágios de English Main ficaram visíveis antes de rolar. Em Essentials 1, a lista exibiu 4 turmas e 29 alunos. Com o texto a 200% em 768 px, o cabeçalho global empurrou o menu da conta para fora da tela. [Desktop](review/track-desktop.png) · [Celular](review/track-celular.png)

Na última revisão do catálogo, passaram os três testes de contrato dos formulários existentes, `test:styles`, `test:component-lines` e `git diff --check`. O checkpoint anterior também registrou três testes de integração do catálogo/editor. O aceite do novo fluxo do livro e dos modais continua pendente.

</details>

## Histórico de revisões

<details>
<summary>Capturas e observações das versões anteriores</summary>

### Lista de estágios após o feedback de hover

A busca e as tracks compartilham o contêiner de tabela do Lazuli. O fundo do sistema aparece nas margens. O cabeçalho de cada track recebe o destaque de ponta a ponta. No Orca, o ponteiro passou pela margem, nome, contagem e menu. Clicar na contagem recolheu a track, clicar na margem reabriu e o menu abriu suas ações mantendo os estágios visíveis.

Na tabela compacta, nome, código e lições identificam o estágio. A coluna Programação traz os formatos e horas-aula disponíveis. Em Essentials 1, foram exibidos Regular com 40 h e PPT com 50 h. A tabela coube na largura de 390 px. A confirmação visual do usuário segue aberta.

[Hover no desktop](review/catalogo-hover.png) · [Lista no celular](review/catalogo-celular.png)

### Revisão anterior do catálogo e dos formulários

A revisão inicial recebeu **21/40** nas dez heurísticas. As duas leituras independentes apontaram que o gradiente dificultava a leitura das linhas e que os campos de duração ocupavam espaço desproporcional. O catálogo agora tem fundo sólido e linhas de track de 44 px no desktop. A atividade continua editável na própria hora. Título e tipo dividem uma linha quando há espaço, as páginas formam um intervalo opcional e os minutos ficam alinhados em uma coluna curta.

No Orca, em `http://lazuli.lazuli.localhost`, o formulário foi aberto em 1280 × 800 e 390 × 844. A edição recebeu foco no título. Um intervalo inválido enviado por Enter manteve os campos e focou a página final. Escape devolveu o foco a Editar. Recolher e reabrir a hora preservou o texto digitado. A cor secundária medida na listagem teve contraste de 8,6:1 sobre o fundo sólido. A aprovação visual pelo usuário continua aberta.

[Formulário no desktop](review/form-desktop.png) · [Formulário no celular](review/form-mobile.png) · [Avaliação inicial](../../.impeccable/critique/2026-11-19T22-41-01Z__apps-web-src-features-stage-catalog.md)

### Checkpoint anterior à revisão

**Estado em 19/11/2026.** O checkpoint continha as operações de catálogo e a edição de atividades na própria hora. O usuário viu a interface e preferiu a anterior. Rejeitou expressamente o fundo transparente, o contraste e a legibilidade. Esse feedback é posterior à escolha da alternativa 2 registrada na arquitetura. Naquele momento, a revisão visual ficou aberta e a referência de comparação foi a versão de `f0f0bfe2`, que mostrava o catálogo ao lado da programação.

[Desktop anterior](review/desktop.png) · [Celular anterior](review/mobile.png) · [Critérios funcionais](TASKS.md) · [Arquitetura discutida](INFORMATION_ARCHITECTURE.md)

### Feedback da revisão inicial

Ao rever a lista de “Estágios” com as cinco tracks recolhidas, o usuário ponderou que “isso não tá tão ruim”. A composição geral do catálogo pode servir de base. A versão anterior continua sendo sua referência preferida.

- O fundo transparente incomoda. O usuário descreveu a tela como “sem alma” e apontou perda de contraste e legibilidade.
- Há espaço demais entre as informações. Na lista de tracks, é difícil percorrer as linhas rapidamente e encontrar o que interessa.
- O usuário achou os formulários feios. A captura comentada mostra a lista recolhida. Para avaliar os formulários, é preciso abri-los e observar os campos durante a edição.
- Os componentes e tokens do Lazuli podem ser reaproveitados onde funcionam. O usuário pediu liberdade para ajustar o que prejudicar a experiência.

O usuário também questionou a validação visual. A retomada deve verificar no navegador se é fácil localizar uma track, conferir seus estágios e preencher ou corrigir uma atividade do livro. A leitura rápida da lista, a hierarquia dos campos e o contraste continuam em aberto.

### O que preservar

- Criação e ordenação de tracks e estágios. Legacy sai da seleção de novas turmas, continua consultável pelo filtro e mantém o acesso das turmas existentes.
- A programação é a base da escola para as atividades e avaliações do livro. O termo escolhido é **lição**. Inserções e correções são atômicas, sem versionamento. Páginas são opcionais e aceitam página única ou intervalo.
- A edição funciona em `/estagios/[id]`. O ponto de entrada da consulta é `/estagios`. A versão anterior pode ser lida com `git show f0f0bfe2:apps/web/src/features/stage-catalog/stages-page.tsx` e pelos componentes e CSS do mesmo diretório naquele commit.

### Como usar as reviews

A revisão de acabamento verificou especificamente dois ajustes em desktop e celular. Preservar os códigos de origem como B.Y.S. na hora recolhida e a contagem em **Provas (2)**. O parecer “ship” se restringiu a esses dois pontos.

A avaliação A inspecionou capturas e código. Destacou a sequência curso → unidade → hora e a inserção no lugar escolhido. Identificou dois controles “Inserir aqui” difíceis de distinguir, baixa descoberta do lápis, navegação horizontal de unidades no celular e risco de perder texto ao recolher a hora ou trocar de unidade. Este último é uma hipótese a testar digitando em um formulário. A nota provisória foi 19/32 nas oito heurísticas avaliadas. O usuário pediu duas leituras independentes com modelo menor. A prioridade expressa por ele é recuperar a leitura da composição anterior, dar fundo sólido ao conteúdo e conferir contraste na tela real. Não foi solicitado protótipo.

A avaliação B observou nas capturas que os metadados perdem contraste sobre o azul, o gradiente dificulta distinguir os limites das linhas e o painel expandido em carvão parece desconectado da hora selecionada. No celular, o título da lição quebra e disputa espaço com os controles de unidade. O revisor sugeriu recuperar as superfícies e a tipografia do catálogo anterior e manter os controles de edição. O detector automático retornou zero ocorrências. O contraste ainda precisa ser medido no navegador.

### Verificações do checkpoint anterior

No checkpoint passaram 14 testes focados, a verificação de tipos do recorte web/API, os testes de estilos e limite de linhas e o lint do frontend alterado. O fluxo de salvar, recarregar e recuperar páginas, referência à lição e minutos foi exercitado no Orca. A migração daquele editor foi `20261119220000_edit_stage_catalog`. As fixtures temporárias foram removidas e a ordem original das tracks locais foi restaurada.

O lint focado da API apontou complexidade preexistente em `preparationPlan` e `preparedPlacementData`, em `packages/api/src/semester-organization/prepare.ts`. A suíte completa fica para integração. O arquivo local `docs/development/pr305-lint-progress.md` já tinha alterações independentes desta tarefa. Conferir o estado dele e o lote ativo ao retomar o lint.

</details>
