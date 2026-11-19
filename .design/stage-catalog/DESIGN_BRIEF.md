# Edição do catálogo de estágios

**Direção aprovada em 19/11/2026.** O catálogo organiza tracks e estágios. Cada estágio abre em um editor próprio. A escolha foi feita na [arquitetura da informação](INFORMATION_ARCHITECTURE.md).

## Para quem e para quê

Com o livro em mãos, a coordenação precisa conseguir abrir um estágio, conferir a sequência de lições e corrigir a programação que a escola usa como base. Hoje, em **Estágios**, ela consegue procurar uma track, abrir um estágio e ler a programação Regular ou PPT. Quando encontra uma atividade faltando ou recebe um livro novo, o trabalho para ali. [Issue #238](https://github.com/josiasrfreitas/lazuli/issues/238) e [pedido de origem #281](https://github.com/josiasrfreitas/lazuli/issues/281).

## Decisões de produto

| Trabalho                   | Resultado esperado                                                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizar o catálogo       | Criar uma track e conseguir abri-la ainda vazia para adicionar o primeiro estágio. Reordenar as tracks para apresentação. Dentro de cada track, inserir, editar e reordenar os estágios na sequência pedagógica.                                                                                |
| Retirar um item de uso     | Marcar uma track ou um estágio como **Legacy**. O catálogo abre com os ativos e oferece **Mostrar Legacy**. Uma track Legacy tira todos os seus estágios das escolhas para novas turmas. Um estágio Legacy pode sair de uso individualmente. Turmas em andamento mantêm acesso ao que utilizam. |
| Editar o conteúdo do livro | No estágio, a coordenação organiza as **lições**. Na programação-base, distribui pelas horas-aula as atividades e as avaliações previstas no livro. Uma lição pode ocupar várias horas-aula, e uma hora-aula pode incluir trabalho de mais de uma lição.                                        |
| Indicar o trecho previsto  | Na atividade, informar opcionalmente uma página ou um intervalo. “Págs. 18–21” indica o trecho e permite saber que são quatro páginas. A atividade também pode ser salva com as páginas em branco.                                                                                              |
| Confirmar uma alteração    | Cada ação confirmada é gravada por inteiro e fica visível no contexto em que foi feita. Se falhar, a pessoa vê o motivo, mantém o que digitou e pode tentar novamente. Rascunho, publicação e versionamento ficam fora desta entrega.                                                           |

O conteúdo vem do livro, inclusive as provas. Atividades extras criadas pela escola e adaptações sob medida para uma turma ou um aluno ficam para um trabalho futuro. **Lição** é o termo usado na interface.

## Critérios para o desenho

1. **Saber onde se está editando.** Antes de confirmar, a pessoa identifica a track, o estágio e, quando aplicável, a programação e a hora-aula afetadas. Na reordenação, consegue ver quem vem antes e depois.
2. **Conseguir seguir trabalhando no mesmo lugar.** Depois de inserir uma atividade, a pessoa vê a atividade salva entre as vizinhas e pode continuar naquele trecho do livro. Campos curtos, como código e páginas, deixam espaço para ler os títulos.
3. **Dar destaque à ação em curso.** Uma track vazia oferece **Adicionar estágio**. Durante a edição de uma atividade, a ação principal confirma aquela atividade. Marcar como Legacy fica em uma ação contextual que explicita o alcance da mudança.

## Direção visual e componentes

A direção proposta é a de uma ferramenta de trabalho tranquila e compacta, com espaço para ler a sequência do livro. Usar a tipografia do produto (Cambria para texto e títulos), os tokens semânticos de cor e a escala de espaçamento de 4 px. Se editar vários itens em sequência exigir uma interação própria, ela pode ser construída com as primitivas do Lazuli. A fase separada de tokens foi dispensada. [Guia de frontend](../../docs/frontend/README.md).

| Peça                          | Ponto de partida                                                              | O que explorar                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Navegação do catálogo         | Busca por track, estágio ou código e agrupamento por track em `stage-catalog` | Dar à track uma presença própria, inclusive quando vazia. Expor a ordem e o filtro Legacy.                           |
| Consulta da programação       | Seleção Regular/PPT e mapa de unidades, horas-aula e provas                   | Mostrar qual hora-aula será alterada, inclusive quando a consulta agrupa horas consecutivas com conteúdo igual.      |
| Editor de lições e atividades | Nova composição com os campos e botões de `@lazuli/ui`                        | Experimentar como inserir no ponto certo com o livro aberto e conferir o resultado logo após salvar.                 |
| Reordenação e estado Legacy   | Novo comportamento de ordenação e selo Legacy existente                       | Tornar a mudança de posição operável pelo teclado e distinguir o alcance de desativar um estágio ou a track inteira. |

Em tela estreita, a pessoa deve conseguir focar no trecho que está editando e voltar ao mesmo ponto do catálogo. Nos dois tamanhos, a ordem de foco acompanha a leitura, os campos têm rótulos, e o resultado de salvar ou mover um item é anunciado a leitores de tela. O estado Legacy aparece por escrito. [Padrão de formulários](../../docs/frontend/forms.md).

## Cenários para comparar as três alternativas

- Criar uma track, adicionar seu primeiro estágio e inserir um segundo. Trocar a posição dos dois estágios e depois mover a própria track na lista.
- Abrir _Essentials 1_, localizar uma lição e inserir uma atividade do livro entre duas existentes. Informar as páginas 18–21. Registrar também uma avaliação prevista no material com as páginas em branco. Conferir posição, conteúdo e programação após cada ação. Os trechos de página deste cenário são ilustrativos.
- Marcar um estágio como Legacy, encontrá-lo com **Mostrar Legacy** e verificar quais estágios da track continuam disponíveis. Repetir com a track inteira e conferir o acesso da turma que já utiliza o material.

## Pontos para resolver no desenho

A escola esclareceu que alterar o formato significa editar a própria programação do livro. Regular/PPT e a carga semanal identificam a programação aberta.

O catálogo atual exige que as atividades de cada hora-aula somem 60 minutos. A arquitetura descreve como inserir uma atividade em uma hora já preenchida e ajustar a distribuição em uma única confirmação. Na implementação, conferir também o efeito de editar uma atividade já referenciada em planos e registros existentes. [Regras atuais da programação](../../packages/api/src/teaching-programs/README.md).
