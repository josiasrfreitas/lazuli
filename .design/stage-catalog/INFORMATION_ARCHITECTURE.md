# Arquitetura da informação · Estágios

**Direção escolhida em 19/11/2026 · Alternativa 2, editor dedicado ao estágio.** Em **Pedagógico → Estágios**, a coordenação organiza o catálogo. Ao abrir um estágio, passa a trabalhar em uma página própria com a programação e as lições do livro. A escolha foi feita a partir da comparação em texto. [Brief de design](DESIGN_BRIEF.md) · [Tarefas de implementação](TASKS.md)

## Três maneiras de editar o mesmo livro

Imagine que você abriu o _Essentials 1_ para inserir uma atividade das páginas 18–21 entre duas atividades já previstas. Os dados abaixo ilustram o percurso.

### 1. Catálogo e programação lado a lado

À esquerda ficam a busca e as tracks com seus estágios. Selecionar uma track abre seus dados e sua sequência de estágios à direita. Selecionar _Essentials 1_ abre a programação nesse mesmo painel. Você escolhe Regular ou PPT, localiza a hora-aula e insere a atividade entre as duas vizinhas. Ao salvar, vê a sequência atualizada e ainda tem as outras tracks à vista.

Essa composição facilita alternar entre livros. O custo aparece numa aula com títulos longos, páginas e várias atividades, porque o catálogo ocupa parte da largura. No celular, catálogo e detalhe passam a ser duas vistas sucessivas. Voltar recupera a track expandida e a posição na lista.

### 2. Catálogo com editor dedicado ao estágio

O catálogo serve para criar tracks, ordenar seus estágios e escolher o livro. Abrir _Essentials 1_ leva a uma página própria. No topo ficam o estágio, sua track e a programação selecionada. A área principal mostra as unidades e suas horas-aula. **Inserir aqui** abre os campos na posição escolhida e mantém as duas atividades vizinhas à vista. Depois de salvar, você já está no ponto certo para fazer a próxima correção. **Lições** dá acesso à lista do livro para cadastrar ou corrigir uma lição.

Essa composição dá mais espaço para transcrever e revisar uma sequência inteira. Trocar de livro exige voltar ao catálogo. No celular, o editor conserva a mesma ordem de leitura e abre a unidade escolhida. O retorno ao catálogo recupera a busca e a seleção anteriores.

### 3. Editor organizado pelas lições do livro

Ao abrir _Essentials 1_, você vê o índice de lições. Selecionar **Lição 4** mostra em quais horas-aula ela aparece na programação escolhida. Você abre uma dessas horas, vê todas as atividades vizinhas e escolhe onde inserir o trecho das páginas 18–21. A ação de salvar devolve você à lição. Uma atividade que abrange duas lições pode ser encontrada pelas duas referências e editada como um único item.

Essa composição encurta o caminho de quem começa pela lição impressa. Para conferir a sequência didática completa, é preciso abrir **Por aula**. Essa vista também dá acesso direto à prova que encerra a unidade, inclusive quando ela não tem lição ou páginas associadas. No celular, escolher uma lição abre seu detalhe e a ação de voltar recupera o ponto do índice.

## Comparação da rotina

| Tarefa                        | 1 · Lado a lado                                                                          | 2 · Por estágio                                                                    | 3 · Por lição                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Montar uma track              | Criar na lista e incluir o primeiro estágio pelo painel ao lado.                         | Criar no catálogo, adicionar os estágios ali e abrir um deles para editar o livro. | Criar e ordenar no catálogo. Ao abrir um estágio novo, começar pelo cadastro da primeira lição.             |
| Reordenar                     | Mover a track na lista ou o estágio dentro da track, acompanhando o detalhe selecionado. | Organizar as duas sequências no catálogo antes de entrar no editor.                | Organizar as duas sequências no catálogo e usar o índice para navegar pelo livro.                           |
| Incluir uma prova sem páginas | Abrir a unidade no painel e escolher a hora-aula que contém a prova.                     | Localizar o encerramento da unidade na página do estágio e editar ali.             | Acessar **Por aula**, abrir o encerramento da unidade e editar a prova.                                     |
| Consultar Legacy              | Marcar pelo menu da track ou do estágio e recuperar o item pelo filtro na lista lateral. | Marcar no contexto da track ou do estágio e reencontrar no catálogo com o filtro.  | Marcar no catálogo ou no cabeçalho do estágio. O filtro no catálogo recupera o livro inteiro para consulta. |

## Mapa de conteúdo e ações

- **Pedagógico → Estágios** abre o catálogo administrativo. Busca por track, estágio ou código e filtro **Mostrar Legacy** vêm antes dos resultados. As tracks aparecem em ordem de apresentação. Cada track pertence a uma linha de produto e contém seus estágios em ordem de progressão.
  - **Track** apresenta nome, classificação e estágios. **Nova track** parte do catálogo. Ao confirmar, a track já aparece vazia com **Adicionar estágio**. Mover um estágio mostra sua nova posição dentro da track. As ações de ordenação precisam funcionar pelo teclado.
  - **Estágio** apresenta nome, código, track, lições do livro e programações disponíveis. O título acompanha a pessoa durante a edição. Uma lição pode ocupar várias horas-aula. Uma hora-aula pode trabalhar mais de uma lição.
    - **Lições** reúne os títulos na ordem do livro. Cadastrar uma lição e editar seu título são operações individuais. A alternativa 3 também usa essa lista como entrada principal.
    - **Programação** identifica Regular/PPT e carga semanal. A visão por aula segue a ordem **unidade → hora-aula → atividade**. A prova pertence à unidade e pode ocupar horas consecutivas. O filtro **Provas** facilita a consulta.
    - **Atividade** mostra título, duração, referências ao livro e páginas quando informadas. A inserção identifica a hora-aula exata, mesmo que a consulta agrupe horas com conteúdo igual. Os campos de página aceitam uma página, um intervalo ou ficam vazios.

### O que acontece ao confirmar

- **Adicionar ou editar.** Uma confirmação grava toda a operação. A atividade reaparece na posição escolhida. Se o salvamento falhar, os campos continuam preenchidos e a falha aparece junto da ação.
- **Inserir em uma hora cheia.** Exemplo ilustrativo: uma hora tem atividades de 30 e 30 minutos. Para inserir 10 minutos entre elas, o editor permite ajustar a primeira para 20 e conferir a sequência de 20, 10 e 30. Uma confirmação salva a distribuição completa. Essa interação é uma proposta para atender à regra vigente das horas de 60 minutos. [Regras da programação](../../packages/api/src/teaching-programs/README.md)
- **Marcar como Legacy.** A confirmação identifica se o efeito alcança um estágio ou os estágios de toda a track. Ao confirmar, a escolha sai das opções para novas turmas. A turma em andamento mantém acesso. Com **Mostrar Legacy**, o catálogo exibe por escrito o estado do item ou a condição herdada da track.

## Navegação, endereços e crescimento

A entrada existente é `/estagios`, no menu **Pedagógico**, com acesso administrativo. Hoje a seleção e a busca ficam na memória da página. Propõe-se identificar o estágio e guardar busca e filtro no endereço para que **Voltar** restaure o contexto. Conta, ajuda e demais destinos continuam no menu do aplicativo.

| Alternativa | Endereços propostos                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| 1           | `/estagios?track={id}` abre a track. `/estagios?estagio={id}` abre seu detalhe no painel.                     |
| 2           | `/estagios` concentra o catálogo. `/estagios/{id}` abre o editor com a sequência de aulas.                    |
| 3           | `/estagios/{id}` abre o índice. `?licao={id}` seleciona uma lição e `?visao=aulas` abre a sequência completa. |

A busca reduz listas longas e mantém a track identificada em cada resultado. **Mostrar Legacy** fica desligado na entrada padrão. Quando o catálogo cresce, é possível recolher tracks e unidades. Uma busca sem resultados oferece limpar os filtros. Uma track vazia oferece o primeiro cadastro. Um estágio com o livro cadastrado e sem programação ainda permite consultar e editar suas lições.

## Estruturas compartilhadas e escolha

O menu **Pedagógico**, a busca, o selo Legacy e os controles Regular/PPT já existem. As três alternativas precisam de navegação por track vazia, comandos de ordenação e um formulário contextual para editar a atividade. O mapa de unidades e horas-aula atual pode servir à leitura em todas elas. Na terceira, a lista de lições precisa também mostrar as ocorrências de cada lição na programação. [Catálogo atual](../../apps/web/src/features/stage-catalog/stages-page.tsx) · [Detalhe da programação](../../apps/web/src/features/stage-catalog/detail.tsx)

Com a alternativa 2, a tela principal do estágio prioriza a edição de aulas em sequência. O catálogo fica a um retorno, com busca e seleção preservadas. A escola confirmou que o formato corresponde à própria programação do livro. Regular/PPT e carga semanal identificam a programação selecionada.
