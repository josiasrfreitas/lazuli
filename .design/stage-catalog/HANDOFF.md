# Retomada do editor de estágios · issue 238

**Estado em 19/11/2026.** A implementação funcional está neste checkpoint. O usuário viu a interface e preferiu a anterior. Rejeitou expressamente o fundo transparente, o contraste e a legibilidade. Esse feedback é posterior à escolha da alternativa 2 registrada na arquitetura. A revisão visual continua aberta. A retomada deve começar comparando a tela atual com a versão de `f0f0bfe2`, que mostrava o catálogo ao lado da programação. As mudanças visuais anunciadas depois desse feedback ainda estão por fazer.

[Desktop atual](review/desktop.png) · [Celular atual](review/mobile.png) · [Critérios funcionais](TASKS.md) · [Arquitetura discutida](INFORMATION_ARCHITECTURE.md)

## Feedback mais recente do usuário

Ao rever a lista de “Estágios” com as cinco tracks recolhidas, o usuário ponderou que “isso não tá tão ruim”. A composição geral do catálogo pode servir de base. A versão anterior continua sendo sua referência preferida.

- O fundo transparente incomoda. O usuário descreveu a tela como “sem alma” e apontou perda de contraste e legibilidade.
- Há espaço demais entre as informações. Na lista de tracks, é difícil percorrer as linhas rapidamente e encontrar o que interessa.
- O usuário achou os formulários feios. A captura comentada mostra a lista recolhida. Para avaliar os formulários, é preciso abri-los e observar os campos durante a edição.
- Os componentes e tokens do Lazuli podem ser reaproveitados onde funcionam. O usuário pediu liberdade para ajustar o que prejudicar a experiência.

O usuário também questionou a validação visual. A retomada deve verificar no navegador se é fácil localizar uma track, conferir seus estágios e preencher ou corrigir uma atividade do livro. A leitura rápida da lista, a hierarquia dos campos e o contraste continuam em aberto.

## O que preservar

- Criação e ordenação de tracks e estágios. Legacy sai da seleção de novas turmas, continua consultável pelo filtro e mantém o acesso das turmas existentes.
- A programação é a base da escola para as atividades e avaliações do livro. O termo escolhido é **lição**. Inserções e correções são atômicas, sem versionamento. Páginas são opcionais e aceitam página única ou intervalo.
- A edição funciona em `/estagios/[id]`. O ponto de entrada da consulta é `/estagios`. A versão anterior pode ser lida com `git show f0f0bfe2:apps/web/src/features/stage-catalog/stages-page.tsx` e pelos componentes e CSS do mesmo diretório naquele commit.

## Como usar as reviews

A revisão de acabamento verificou especificamente dois ajustes em desktop e celular. Preservar os códigos de origem como B.Y.S. na hora recolhida e a contagem em **Provas (2)**. O parecer “ship” se restringiu a esses dois pontos.

A avaliação A inspecionou capturas e código. Destacou a sequência curso → unidade → hora e a inserção no lugar escolhido. Identificou dois controles “Inserir aqui” difíceis de distinguir, baixa descoberta do lápis, navegação horizontal de unidades no celular e risco de perder texto ao recolher a hora ou trocar de unidade. Este último é uma hipótese a testar digitando em um formulário. A nota provisória foi 19/32 nas oito heurísticas avaliadas. O usuário pediu duas leituras independentes com modelo menor. A prioridade expressa por ele é recuperar a leitura da composição anterior, dar fundo sólido ao conteúdo e conferir contraste na tela real. Não foi solicitado protótipo.

A avaliação B observou nas capturas que os metadados perdem contraste sobre o azul, o gradiente dificulta distinguir os limites das linhas e o painel expandido em carvão parece desconectado da hora selecionada. No celular, o título da lição quebra e disputa espaço com os controles de unidade. O revisor sugeriu recuperar as superfícies e a tipografia do catálogo anterior e manter os controles de edição. O detector automático retornou zero ocorrências. O contraste ainda precisa ser medido no navegador.

## Verificação e lint

No checkpoint passaram 14 testes focados, a verificação de tipos do recorte web/API, os testes de estilos e limite de linhas e o lint do frontend alterado. O fluxo de salvar, recarregar e recuperar páginas, referência à lição e minutos foi exercitado no Orca. A migração foi aplicada no ambiente local. As fixtures temporárias foram removidas e a ordem original das tracks locais foi restaurada.

O lint focado da API apontou complexidade preexistente em `preparationPlan` e `preparedPlacementData`, em `packages/api/src/semester-organization/prepare.ts`. A suíte completa fica para integração. O arquivo local `docs/development/pr305-lint-progress.md` já tinha alterações independentes desta tarefa. Conferir o estado dele e o lote ativo ao retomar o lint.
