# Auditoria visual de staging do Lazuli

**Lotes público e autenticado concluídos para os estados alcançados.** Revisão `c4d3a9247e049c34a2ba3c55def30fd3837b4782`, com deploy verificado em 20/11/2026 às 15:08:53 UTC. Coleta iniciada após essa verificação no navegador embutido do Orca em https://staging.lazuli.fisklagarto.com.br. 1440 × 900 no desktop e 390 × 844 com emulação móvel/touch. [Execução de deploy](https://github.com/josiasrfreitas/lazuli/actions/runs/44758961056)

## Arquivos e retomada

| Arquivo                                                             | Uso                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [rotas.txt](rotas.txt)                                              | Inventário inicial com 54 entradas, 42 estáticas e 12 parametrizadas                             |
| [matriz.md](matriz.md) · [matriz-diretoria.md](matriz-diretoria.md) | Visão anônima e cobertura autenticada incremental                                                |
| [relatorio.html](relatorio.html) · [relatorio.md](relatorio.md)     | Relatório navegável e fonte editável                                                             |
| [RETOMADA.md](RETOMADA.md)                                          | Fluxos dependentes de dados ou links adicionais                                                  |
| [relacoes-diretoria.md](relacoes-diretoria.md)                      | Achados relacionais da exploração autenticada                                                    |
| [cobertura-anonima.tsv](cobertura-anonima.tsv)                      | Destino e título efetivamente exibidos em cada navegação anônima                                 |
| `publico/`                                                          | PNGs de viewport e medições da interface pública. Sufixos `-d` e `-m` indicam desktop e estreito |
| `privado/`                                                          | Pasta prevista para capturas autenticadas de acesso local restrito, se houver acesso             |

## Checkpoint 1 · acesso público

- A confirmação do deploy precede as capturas. O arquivo de cobertura anônima está sendo preenchido por navegação no staging.
- Login padrão e recuperação já têm pares de screenshots. Outros estados públicos e as rotas restantes estão em coleta.
- O perfil Default e os 11 perfis isolados preexistentes do Orca redirecionaram a raiz de staging para `/login` na checagem inicial. A exploração autenticada aguarda acesso de QA. A observação pré-deploy serviu apenas para preparar a sessão, sem fundamentar o relatório.
- As próximas verificações deste checkpoint abrangiam link de acesso, solicitação de senha, cadastro sem token, 403, teclado e validação vazia. Depois, verificar as rotas estáticas de presença, projeção e prévia conforme os destinos efetivamente exibidos.
- Nenhum email foi disparado. Dados pessoais e credenciais ficam fora do relatório e da matriz. Só serão adotados IDs de registros acessíveis a partir da navegação autenticada no staging.

Para retomar, leia a última seção deste manifesto, a matriz e as conclusões do lote correspondente em `relatorio.md`. Conte redirecionamento como teste de acesso da rota, com o conteúdo interno pendente. Confirme que o perfil Orca utilizado está no staging antes de produzir nova evidência.

## Checkpoint 2 · estados de acesso e destinos anônimos

- As 42 rotas estáticas foram abertas anonimamente. Nove mantiveram a URL e 33 redirecionaram ao login. As 12 parametrizadas aguardam IDs observados em sessão autorizada. A planilha tem uma linha por entrada.
- Capturados os quatro modos de login, validação vazia, revelação da senha, cadastro sem token e 403. O formulário estreito de cadastro sem token tem sobreposição confirmada entre o aviso e seu único CTA. A tentativa de clique foi interceptada pelo aviso. Prosseguir repetindo após dispensar/aguardar o aviso, e registrar o retorno ao formulário de solicitação no estreito.
- As telas públicas de documentos e presença também já têm captura inicial nos dois viewports. O lote seguinte trataria de revisar as quatro superfícies de presença, testar busca da prévia com dados fictícios, e comparar as duas superfícies de documentos sem link.
- Acesso autenticado continua pendente. Se chegar durante este lote, preservar o perfil anônimo e usar uma sessão de QA em perfil separado.

## Checkpoint 3 · família pública de QR e documentos

- Todas as quatro telas de presença e as duas telas de documentos sem link foram abertas e comparadas no desktop e no estreito. O texto e as medidas estão no relatório em seções próprias.
- O QR da projeção de prévia foi decodificado do próprio screenshot e leva a `https://staging.lazuli.fisklagarto.com.br/presenca/previa`. A confirmação real, a projeção real e o envio de documentos foram vistos somente em entrada sem QR. Links reais dependem de percurso autenticado ou de um link de QA.
- A prévia de presença foi exercitada no desktop com duas letras, busca vazia de correspondência, opção fictícia e clique. A opção não apresentou seleção e o botão de envio continuou desabilitado. A mesma sequência está em verificação no estreito.
- A checagem de fundo em `/login` distinguiu as capturas de chegada, ainda no fundo marinho, da fotografia já carregada. A seção de login foi corrigida e tem os dois estados. Capturar os demais modos após carregamento para fechar a família.
- O lote seguinte trataria de anotar a saída do cadastro sem token após o aviso, o destino ao voltar da 403 e foco/teclado, terminar a prévia estreita e verificar acesso de QA.

## Checkpoint 4 · lote público encerrado

- A prévia de presença foi exercitada nas duas larguras. O CTA permaneceu desabilitado ao clicar na opção fictícia, sem seleção visível. O relatório registra a diferença de foco no estreito e as capturas antes/depois.
- A recuperação de link após o aviso de cadastro expirado foi verificada no desktop e no estreito. A ação da 403 retorna ao login no perfil anônimo. O JSON `publico/teclado-e-retorno.json` registra o percurso de Tab e o destino.
- As 54 entradas constam da matriz. O relatório cobre as 9 rotas públicas, com 33 redirecionamentos registrados e 12 detalhes aguardando IDs autorizados.
- Quando houver sessão de QA, abrir a raiz interna e fazer o lote alunos × turmas × professores no mesmo papel e nas duas larguras. A [retomada](RETOMADA.md) enumera telas e verificações de cada lote. O [relatório HTML parcial](relatorio.html) reúne achados, cobertura e evidências públicas.

## Checkpoint 5 · entrada autenticada e primeiro lote

- Uma sessão autorizada de diretoria passou a abrir a raiz do staging. As capturas autenticadas guardam uma composição com textos e imagens de registros cobertos antes do screenshot. Os JSONs conservam posição, dimensões e tipografia, com rótulos conhecidos da interface e sem identificadores de cadastros.
- Alunos, turmas e professores abriram em listas. O detalhe de aluno foi aberto acionando a linha da tabela. Os de turma e professor têm links nas listas. A sessão de diretoria abriu também a rota de entrada `/professor`. O responsável confirmou que a mesma conta passa aos dois contextos. A próxima verificação abre o seletor Administração / Professor e percorre a agenda docente.
- No estreito surgiu o diálogo “Administração no celular”, com a advertência oficial de suporte. O primeiro par de capturas estreitas pode mostrar essa sobreposição. O percurso continua após “Entendi, continuar” para evidenciar as telas sob o aviso.
- Próxima ação no lote de entidades é exercitar as abas visíveis dentro de cada detalhe, com a mesma leitura de título, resumo, ações e densidade nas duas larguras. Os lotes de atendimento e professor já estão iniciados em abas separadas da mesma sessão.

## Checkpoint 6 · relações iniciais entre entidades

- As três visões gerais foram observadas. A primeira tabela comparativa está em [relações da diretoria](relacoes-diretoria.md), com medidas de títulos e abas e diferenças de conteúdo entre as três entidades.
- O clique na linha de Alunos é o percurso observado para o detalhe. O agente fechou o aviso responsivo para capturar o detalhe abaixo da sobreposição.
- A varredura inicial mantém capturas anonimizadas da operação pedagógica e financeira. Vários caminhos do inventário chegam a outra rota visual. Confirmar a aba efetiva em cada um antes de interpretar como página duplicada.
- Próxima ação é fechar a coleta de abas por entidade e verificar as rotas dinâmicas de agenda, ocorrência, intervenção e atendimento pelos controles visíveis.

## Checkpoint 7 · listas, navegação e contextos

- Registrei os destinos de dez entradas internas que convergem para outras superfícies. Ajustes/Localização mantém um recorte pela URL. As demais convergências verificadas abrem a superfície de destino sem parâmetro de seção.
- Exercitada a entrada inicial de cadastro de aluno, quatro filtros da lista, as quatro abas de detalhe e a abertura de Anotações. A comparação de tabelas incluiu a largura horizontal da área interna em 390 px, com recomendação por tarefa em `relacoes-diretoria.md`.
- Identificado o menu de contexto com Administração e Professor. A mesma conta foi confirmada para ambos. A exploração da agenda docente e a confirmação da troca de contexto continuam pelo menu.
- Próximas ações em andamento abrangem abas adicionais de turma e professor, calendário do dia/semana, busca da chamada por evento, filtros financeiros e rotas dinâmicas de atendimento/acompanhamento.

## Checkpoint 8 · agenda, formulários e segurança das capturas

- A agenda docente mudou de Dia para Semana e avançou para o período seguinte. Um evento de aula abriu “Registrar aula” e o formulário de chamada nas duas larguras. A URL permaneceu `/professor/agenda`. A captura termina no formulário aberto.
- A matriz incremental guarda a comparação Administração / Professor com o mesmo acesso. O menu oferece os dois contextos. Selecionar Administração no desktop devolveu à última página administrativa observada. O fluxo estreito ainda está em conferência.
- A primeira máscara cobria o conteúdo principal, mas uma camada do menu de conta apareceu acima dela com identidade visível. Retirei as capturas candidatas, passei a ocultar texto e mídia também nos próprios elementos durante a captura e usei OCR local para verificar as imagens. O relatório usa somente a nova evidência desse menu.
- Aberturas de filtros, formulários e abas já estão registradas. Faltam confirmar caminhos parametrizados sem link visível, completar a seleção de professor na agenda administrativa e fazer a conferência final de links e evidências no HTML.

## Checkpoint 9 · consolidação

- Registrei o resultado das 54 entradas do inventário. As nove públicas têm capturas nas duas larguras. Das 45 internas, 27 abriram sua superfície, 10 chegaram a outra entrada, duas mostraram 404 e Perfil chegou a 403. Cinco padrões parametrizados ficaram sem endereço observável em um percurso da interface, com os estados equivalentes documentados onde apareceram.
- A mesma conta abriu Administração e Professor. A agenda administrativa ofereceu seleção de professor nas duas larguras. A agenda docente mostrou mudança de período e abriu o formulário de chamada para uma aula existente. A observação terminou antes do envio.
- As comparações de detalhe, tabelas, agenda, formulários, avisos e erros estão em [relações autenticadas](relacoes-diretoria.md). A [matriz autenticada](matriz-diretoria.md) reúne rotas, abas, filtros, menus e seus links.
- Os estados dependentes de QR, token válido ou link parametrizado de QA estão no [registro de continuidade](RETOMADA.md). O [relatório HTML](relatorio.html) reúne os achados e as matrizes.
