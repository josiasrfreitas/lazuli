# Information Architecture: Lazuli — Display de Parcelas

> Complementa `DESIGN_BRIEF.md`. Este slice cobre somente a consulta operacional de parcelas; ações
> financeiras e navegação para contratos permanecem fora do escopo.

## Recorte #52

Somente Todas e Pagas estão habilitadas nesta entrega; Vencidas mostra o contador da API, mas sua
ativação e agrupamento pertencem à #57. Os fluxos agrupados abaixo descrevem essa entrega futura.
Na #52, `status=vencidas` é removido junto de `pagina`, preservando `busca`. Valores inválidos
usam defaults seguros. Busca (máximo de 80 caracteres, debounce de 300 ms) e troca de tab removem
`pagina`. Sem `status`, a API recebe `view=all`; `status=pagas` recebe `view=paid`.
Todas e Pagas oferecem 10, 25 ou 50 parcelas por página, com 25 como padrão. Ao exceder o total, a URL volta à última página
válida (ou à primeira se vazia). Navegação externa cancela qualquer busca pendente.

O header e os controles dividem a faixa de `DataTablePage` e quebram em linhas quando necessário.
`TableContainer` ocupa o restante do viewport, com cabeçalho fixo, scroll interno e rodapé.
A rota exige ADMIN no servidor; o AppShell continua encaminhando visitantes sem sessão ao login.
Início mantém Alunos como destino de ADMIN.

## Recorte #57 — arquitetura confirmada em 2026-09-15

Vencidas passa a ser uma tab habilitada e `status=vencidas` passa a consultar `view=overdue`.
As decisões do brief de 2026-09-15 governam a composição abaixo. Esta seção descreve o resultado
planejado; a implementação ainda não foi realizada. A #54 mantém o acabamento ampliado, e a revisão
formal de design continua separada.

## Site Map

- Início `/` — redireciona para a primeira vertical disponível ao papel autenticado
- Alunos `/alunos` — vertical existente
- Financeiro — seção não clicável da navegação
  - Parcelas `/parcelas` — consulta do ledger, disponível somente para `ADMIN`

`/parcelas` é a única rota deste slice. Tabs, busca e paginação são estados da mesma view; não há
rota de detalhe, painel lateral, modal ou destino associado às linhas.

## Navigation Model

- **Navegação primária:** a sidebar do `AppShell` mantém Início e Alunos no primeiro nível e
  acrescenta a seção não clicável **Financeiro**, com Parcelas como seu primeiro item. A seção
  prepara o crescimento futuro para destinos relacionados sem prometer links ainda inexistentes.
- **Controle de acesso:** a seção Financeiro só é renderizada quando possui ao menos um destino
  permitido. Neste slice, Parcelas e, portanto, a seção aparecem somente para `ADMIN`, espelhando a
  autorização do backend.
- **Navegação secundária:** tabs **Todas**, **Vencidas** e **Pagas** dentro de `/parcelas` filtram a
  mesma view e atualizam a URL; não são sub-rotas.
- **Navegação utilitária:** identidade e papel permanecem no rodapé da sidebar; data de trabalho
  permanece na topbar. A vertical não acrescenta busca global nem ações utilitárias.
- **Navegação mobile:** reutiliza o menu já entregue abaixo de 640 px e a sidebar nas larguras
  maiores. A #57 preserva a integridade básica e não altera esse modelo.

## Content Hierarchy

### `/parcelas`

1. **Orientação da página:** título “Parcelas” e subtítulo “Mensalidades e vencimentos” deixam claro
   que a consulta representa o ledger completo, sem mês implícito.
2. **Controles de consulta:** busca por pagador ou beneficiário à esquerda e tabs Todas, Vencidas e
   Pagas à direita, seguindo a composição existente de Alunos.
3. **Resultado principal:** tabela de parcelas com as colunas Parcela, Pagador, Beneficiário(s),
   Vencimento, Valor e Status. Todas é a tab padrão e oferece a visão geral do ledger.
4. **View operacional dominante — Vencidas:** preserva a mesma estrutura tabular, mas intercala um
   resumo por pagador antes de suas parcelas. É onde se concentra o trabalho de priorizar cobranças
   por atraso e saldo, embora não seja o estado inicial da página.
5. **Continuidade da consulta:** paginação abaixo da tabela mantém busca e tab na URL. Loading,
   vazio, ausência de resultados e erro ocupam o mesmo frame estrutural dos dados.

### Estrutura de Vencidas

Cada pagador ocupa um grupo sempre aberto, com borda, cantos arredondados e tabela própria.
O refinamento aprovado em 2026-09-15 substitui a proposta inicial de uma única tabela de seis colunas.

- Resumo: nome do pagador, quantidade de parcelas vencidas, quantidade de alunos e maior atraso.
  À direita, “Saldo em aberto” e o total coletável. A contagem de contratos foi retirada.
- Cinco cabeçalhos apenas para tecnologia assistiva por grupo: Parcela, Beneficiários, Vencimento, Em aberto e Atraso.
  Beneficiários usam nomes completos e recebem a largura restante depois das colunas numéricas.
- Cada parcela aparece uma vez com todos os beneficiários do pedido, inclusive pacotes conjuntos.
  Não há subgrupo por aluno. Atraso usa “1 dia” / “N dias”.
- O saldo coletável da API é o valor principal da parcela. Se difere do original, a variação líquida aparece ao lado
  com ↓ ou ↑ e o original fica no tooltip. Isso vale para pagamentos parciais e ajustes, sem recalcular o saldo na UI.
- Grupos são ordenados pelo maior atraso, com `payerId` crescente como desempate. Parcelas seguem
  `dueDate` crescente e `installmentId` crescente no empate, conforme a API.
- Não há expansão, seleção, menus ou linhas clicáveis.
- Quando a busca efetiva não estiver vazia, uma orientação discreta entre controles e tabela diz:
  “Exibindo todas as parcelas vencidas dos pagadores encontrados.” Não há destaque de nomes ou linhas.
- O rodapé permanece fora da região de rolagem, com fundo transparente, e conta pagadores:
  “1–10 de 23 pagadores”. O contador da tab continua representando parcelas vencidas.

### Associação acessível e composição

- Cada seção tem um `h2` com o nome do pagador; sua tabela nativa usa `aria-labelledby` apontando
  para esse título e `aria-describedby` apontando para o resumo de parcelas, alunos e atraso.
- Os cinco cabeçalhos usam `th` com `scope="col"` e IDs únicos. Cada célula aponta, via `headers`,
  para o cabeçalho da respectiva coluna na mesma tabela, sem células mescladas.
- IDs de associação e chaves derivam da identidade do pagador, não do nome; homônimos permanecem
  grupos distintos. Não expor UUIDs como rótulos para o operador.
- A composição permanece em `OverduePayerGroupCard`, na feature, reutilizando os primitivos de tabela.
  Não foi necessário criar um novo primitivo compartilhado.
- Os cabeçalhos ficam visualmente ocultos em cada grupo; não há cabeçalho único fixo ou resumo fixo nesta composição.

## User Flows

### Consultar o ledger completo

1. O administrador abre `/parcelas`.
2. A tab Todas aparece selecionada porque `status` está ausente da URL.
3. O administrador lê as parcelas na ordem operacional definida no brief.
4. Se necessário, pagina; a URL registra `pagina` e preserva os demais filtros.

### Localizar parcelas de um pagador ou beneficiário

1. O administrador digita um nome na busca.
2. Após o debounce, `busca` é atualizado na URL e `pagina` volta ao padrão.
3. O servidor busca tanto pelo pagador quanto pelos beneficiários.
4. Em Todas e Pagas, aparecem somente parcelas correspondentes. Em Vencidas, a correspondência
   qualifica o pagador e a tabela mostra seu grupo vencido completo, preservando contagem e saldo.
   A orientação explica por que outros beneficiários aparecem. Parcelas a vencer não são incluídas.
5. A tabela apresenta os resultados ou orienta a ajustar o termo quando não houver correspondência.

### Priorizar cobranças vencidas

1. O administrador seleciona Vencidas; a URL passa a conter `status=vencidas` e limpa `pagina`.
2. A camada web traduz a tab para `view=overdue` no input da procedure.
3. A tabela apresenta grupos de pagadores, ordenados pelo maior atraso e por `payerId` em empate.
4. O administrador lê primeiro o resumo do pagador: quantidade vencida, beneficiários, atraso mais
   antigo e saldo coletável.
5. Em seguida, confere as parcelas do grupo, da mais antiga para a mais recente, com desempate por
   `installmentId`.
6. Se houver mais de dez pagadores, pagina sem dividir um grupo entre páginas.

### Alternar a unidade de paginação

1. O administrador escolhe 50 parcelas por página em Todas; a URL registra `porPagina=50`.
2. Ao abrir Vencidas, `pagina` volta a 1. A consulta e o rodapé usam 10 pagadores, sem seletor.
3. `porPagina=50` permanece na URL como preferência das views planas, sem influenciar a consulta
   vencida. Assim, não é necessário criar estado local adicional para lembrar a preferência.
4. Ao voltar a Todas ou Pagas, a página volta a 1 e o seletor retoma 50 parcelas.
5. Um acesso direto a Vencidas sem `porPagina` usa 10 pagadores; ao mudar para uma view plana,
   aplica o padrão de 25 parcelas.

### Consultar parcelas pagas

1. O administrador seleciona Pagas; a URL passa a conter `status=pagas` e limpa `pagina`.
2. A camada web traduz a tab para `view=paid` no input da procedure.
3. A tabela plana apresenta as parcelas integralmente pagas, das mais recentes para as mais antigas,
   com desempate por `installmentId`.
4. A paginação mantém tab e busca na URL.

## Naming Conventions

| Conceito                        | Label na UI     | Notas                                                                        |
| ------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| Área financeira                 | Financeiro      | Seção não clicável da sidebar; só aparece quando contém um destino permitido |
| Installment                     | Parcela         | Rota plural `/parcelas`; sequência exibida como `06/12`                      |
| Visão completa                  | Todas           | Tab padrão; ausência de `status` na URL                                      |
| Installment vencida e coletável | Vencidas        | Tab agrupada por `payerId`; `status=vencidas`                                |
| Installment integralmente paga  | Pagas           | Tab plana; `status=pagas`                                                    |
| Payer                           | Pagador         | Pessoa responsável pela cobrança                                             |
| Aluno vinculado ao pedido       | Beneficiário    | Pode haver mais de um por parcela                                            |
| Valor ainda coletável           | Saldo em aberto | Derivado do ledger; nunca persistido                                         |
| Installment dispensada          | Dispensada      | Aparece somente em Todas                                                     |

## Component Reuse Map

| Componente                               | Usado em                                   | Diferenças de comportamento                                               |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `AppShell`                               | `/alunos`, `/parcelas` e futuras verticais | Sem diferença estrutural; sidebar recebe a seção Financeiro               |
| `SidebarNav` / configuração de navegação | Todas as rotas autenticadas                | Renderiza agrupamento não clicável e omite seções sem destinos permitidos |
| Header e container de página             | `/alunos`, `/parcelas`                     | Parcelas não possui ação primária                                         |
| `Input` + `Tabs`                         | Controles de Alunos e Parcelas             | Busca e valores de tabs específicos da vertical                           |
| Primitivos de tabela                     | Todas as tabs de Parcelas                  | Vencidas acrescenta resumo por pagador dentro da tabela                   |
| `Pagination`                             | Todas, Vencidas e Pagas                    | 10/25/50 parcelas (padrão 25); 10 pagadores sem seletor em Vencidas       |
| `TableSkeleton` / `EmptyState`           | Loading, vazio, sem resultados e erro      | Conteúdo textual específico de Parcelas; erro oferece retry               |

## Content Growth Plan

- O ledger cresce continuamente, portanto busca, filtros e paginação são server-side desde a primeira
  entrega; a página nunca depende de materializar todo o conjunto no cliente.
- Todas e Pagas paginam 10, 25 ou 50 parcelas por vez, com 25 como padrão.
- Vencidas pagina 10 grupos de pagadores por vez. O grupo é a unidade de paginação e nunca é dividido
  entre páginas.
- Dez pagadores não limitam a quantidade de linhas a dez: grupos longos permanecem inteiros e
  usam a rolagem interna existente. Não truncar parcelas nem introduzir virtualização nesta fatia.
- A seção Financeiro pode receber Contratos, Analytics ou outros destinos quando essas verticais
  existirem. Até lá, contém somente Parcelas e não exibe placeholders.
- Uma futura rota de contrato ou detalhe poderá introduzir navegação nas linhas, mas nenhuma reserva
  visual ou URL é criada neste slice.

## URL Strategy

- **Pattern:** rota em pt-BR, substantivo plural: `/parcelas`.
- **Dynamic segments:** nenhum neste slice.
- **Query parameters:** gerenciados com `nuqs`, em pt-BR, opcionais e com defaults removidos da URL:
  - `status=vencidas|pagas`; ausente significa Todas;
  - `busca=<texto>`; ausente significa busca vazia;
  - `pagina=<inteiro>`; ausente significa página 1;
  - `porPagina=10|50`; ausente significa preferência de 25 parcelas nas views planas.
- Alterar `status` ou `busca` remove `pagina`, reiniciando a consulta na primeira página.
- Alterar `pagina` preserva `status`, `busca` e `porPagina`.
- Alterar o tamanho nas views planas remove `pagina`; escolher 25 remove `porPagina`.
- Em Vencidas, `porPagina` preserva apenas a preferência das views planas. O tamanho efetivo da
  consulta, cálculo de páginas e rodapé é sempre 10 grupos, inclusive com URL `porPagina=50`.
- URLs inválidas ou valores não reconhecidos retornam aos defaults seguros da listagem.
- **Contrato da procedure:** o input tRPC usa o campo `view=all|overdue|paid`, separado do parâmetro
  localizado da URL. A camada web faz o mapeamento: `status` ausente → `view=all`,
  `status=vencidas` → `view=overdue`, `status=pagas` → `view=paid`.
- Os identificadores internos continuam em inglês (`search`, `page`, `pageSize`). A preferência de
  tamanho das views planas e o tamanho efetivo da consulta vencida são conceitos distintos.

## Estados da consulta agrupada

- Loading inicial, vazio e erro usam o mesmo frame de seis colunas; não exibem grupos fictícios como
  dados reais. Erro oferece “Tentar de novo”. A #54 mantém o acabamento ampliado desses estados.
- Trocar de tab ou busca não reaproveita linhas do filtro anterior. Paginar/refazer a mesma busca
  e tab pode preservar grupos anteriores com indicação de atualização, como nas views planas.
- Corrigir página fora do intervalo somente após uma resposta efetiva, usando o total de grupos.
- Busca continua com debounce de 300 ms e limite de 80 caracteres; navegação externa cancela uma
  busca pendente. Não há estado de expansão ou seleção a sincronizar com a URL.

## Ajuste mínimo do shell aprovado na #52

A verificação em 375 px encontrou a sidebar fixa de 240 px comprimindo os controles. Nesta entrega,
o shell passa a mostrar um menu nativo de navegação abaixo de 640 px e mantém a sidebar em larguras
maiores. O menu reutiliza os destinos e filtros por papel, fecha ao navegar ou pressionar Escape
e devolve o foco ao acionador. A data utilitária do topo aparece a partir de 640 px. O acabamento
ampliado de responsividade continua na #54.
