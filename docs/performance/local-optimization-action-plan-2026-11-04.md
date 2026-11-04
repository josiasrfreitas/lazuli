# Plano de ação e medições locais — painel e cliente

Objetivo: executar as correções sustentadas pelos dois diagnósticos e comparar o antes/depois
localmente. A meta do produto continua sendo p95 de até 300 ms entre interação e tela pronta
na navegação interna. Contagem de consultas, tamanho comprimido e latência de um endpoint
não comprovam essa meta isoladamente. Não adicionar cache.

O benchmark oficial de staging fica para o final. As medições abaixo são experimentos locais
focados; desenvolvimento e produção, navegação inicial e interna, e carga fria e aquecida
precisam ser identificados separadamente.

## Achados e execução

| ID  | Achado confirmado ou hipótese                                                                                       | Ação e critério de aceite                                                                                                                                                                                | Estado e evidência local                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Prévias de aulas expandem relações completas mesmo sem resultados.                                                  | Buscar a página e carregar somente as relações necessárias dos resultados. Preservar totais, ordem, responsável histórico e links.                                                                       | Implementado; prévia 13→2 consultas, histórico 13→7. Hashes iguais na mesma base/data. Ganho agregado de `home` medido abaixo.                                                                              |
| P2  | Agenda expande identidades repetidas e turmas sem ocorrência no dia.                                                | Compartilhar a leitura de identidades e recortar turmas com slot do dia **ou sessão materializada**. Preservar projeção, exceções, substituições, desligamentos e datas.                                 | Implementado; 19→14 consultas e 147→84 linhas. Hash igual; mediana local 5,54→4,49 ms.                                                                                                                      |
| P3  | `business` aguardava a resposta de `home` no navegador.                                                             | Iniciar a partir da permissão da identidade já resolvida no servidor; manter autorização no endpoint. Aceite: ambos começam na primeira carga sem depender da resposta um do outro.                      | Implementado; `home` e `business` passaram a iniciar no mesmo batch tRPC. O experimento controlado confirma a ordem, sem medir ganho de pintura.                                                            |
| P4  | A tela também consulta `pendingLessons`, fora do custo de `home`.                                                   | Recortar sua projeção, carregar identidades em lote e manter agrupamento por professor, estágio/PPT e responsabilidade histórica. Incluir o endpoint na medição da página.                               | Implementado; resultado final 12→7 consultas e 770→754 linhas, hash igual. Medianas c1/c4 33,38→26,05 / 114,27→89,29 ms. Não atribuir essa diferença às 88→66 consultas de `home`.                          |
| P5  | `overdueContracts` monta depois de `home` e `business`.                                                             | Verificar quando o detalhe é necessário e preservar a abertura sem duplicar pedidos.                                                                                                                     | Após o experimento de primeira carga, a leitura passou para a abertura do detalhe. O smoke da imagem publicada mostra só `home`, `business` e `pendingLessonSummaries` no lote inicial.                     |
| P6  | No painel publicado, o lote das três leituras visíveis começa cerca de 379 ms após o clique.                        | Ler `home`, `business` e `pendingLessonSummaries` em paralelo na rota e entregar os resultados iniciais juntos. Se uma leitura falhar, manter seu fetch cliente. Medir p95 antes de publicar como ganho. | Candidato local implementado; tipos passaram. Navegação Alunos → Início no Orca mostrou indicadores, gráfico e pendências, sem chamada tRPC do painel após o clique. Ainda não está em staging nem tem p95. |
| F1  | Na visão financeira, `contractClosings` aguardava a montagem cliente, embora `analytics` já fosse lido no servidor. | Ler ambas em paralelo na rota e usar o resultado inicial apenas para o mesmo ano. Preservar erro e troca de ano; comparar a primeira navegação em staging.                                               | Publicado em staging; smoke de uma amostra: 499→383 ms e nenhuma chamada tRPC após o clique. Troca de ano e tipos validados localmente. Ganho de p95 ainda não medido.                                      |
| C1  | Agenda fechada do perfil importa calendário e diálogos antecipadamente.                                             | Separar trigger e corpo; carregar calendário/diálogos ao abrir. Preservar deep link de atendimento, foco e fechamento. Comparar JS inicial e tempo da abertura.                                          | Implementado e smoke aprovado: abrir, Escape, reabrir e foco; 4 scripts / 207.768 bytes decodificados carregados ao abrir. Ganho conjunto C1–C3 abaixo; latência sem comparação válida.                     |
| C2  | Abas do perfil têm imports antecipados de componentes pesados.                                                      | Dividir por aba com carregamento sob demanda e os estados de loading existentes. Preservar navegação, dados, permissões e ações. Comparar bytes iniciais e prontidão da primeira troca de aba.           | Implementado; skeletons extraídos, abas validadas em produção. Redução conjunta C1–C3 de 37,5% Brotli; economia individual e latência não isoladas.                                                         |
| C3  | Foto importa captura de documento antes de editar.                                                                  | Carregar a captura apenas no modo edição. Preservar visualização, edição e cancelamento. Comparar módulos do carregamento inicial e funcionamento da captura.                                            | Implementado; edição e cancelamento validados sem upload. Efeito incluído na redução conjunta C1–C3, sem atribuição individual.                                                                             |
| M1  | O build disponível inicialmente era de 23/outubro e o dev tem espera deliberada de 1,8 s.                           | Gerar baseline e versão corrigida atuais de produção local, com a mesma configuração/dados. Usar dev apenas para localizar causas.                                                                       | Duas builds atuais de produção concluídas; mesma configuração. IDs, assets e fingerprints no relatório do cliente.                                                                                          |
| M2  | Brotli e código não executado não medem CPU nem provam que um módulo pode ser removido.                             | Separar bytes bruto/comprimido, módulos iniciais, tarefas longas, respostas a interações e prontidão funcional. Medir a abertura tardia para não esconder custo transferido.                             | Bytes iniciais e primeira abertura medidos; 4 scripts/207.768 bytes decodificados foram adiados para abrir a agenda. Runtime comparável e Coverage ficaram limitados pelo navegador Orca.                   |

**A1 — primeira navegação de Alunos.** No smoke da imagem publicada, o lote tRPC começou em
401 ms e a tela ficou pronta em 623 ms. Um candidato local entrega a lista padrão e as opções
iniciais de turma na resposta da rota. No Orca, `/alunos` mostrou 25 linhas sem chamada tRPC da
lista ou das opções; buscar e recarregar a URL filtrada consultaram a API e preservaram o estado
vazio correto. Tipos passaram. Ainda falta publicar e medir o p95.

**T1 e R1 — primeiras navegações de Turmas e Recebíveis.** Na imagem publicada, os smokes
mostraram 542 e 640 ms, respectivamente. As rotas locais agora entregam as listas padrão na
resposta inicial; Turmas também entrega as opções dos filtros. Após o rebase com `main`, o Orca
mostrou 16 turmas e 25 recebíveis sem chamadas cliente das listas. URLs com busca continuaram
consultando a API. O typecheck passou. Ainda falta publicar e medir a latência comparável.

**L1 — primeira navegação de Aulas.** O smoke publicado mostrou 805 ms. A rota local agora lê
em paralelo aulas, atendimentos e sessões experimentais da semana atual; a agenda
cliente só usa esses dados quando a data e os filtros coincidem. No Orca, a semana padrão ficou
pronta sem repetir essas leituras no cliente; uma semana escolhida na URL voltou a consultá-las.
O typecheck passou. Ainda falta publicar e medir a latência comparável.

## Evidência inspecionada

A comparação final de API alternou baseline/corrigido/corrigido/baseline, com cinco aquecimentos
por endpoint e 20 amostras em cada execução: 40 por variante e concorrência. Mesma base local,
data de negócio `2026-11-03T18:00:00.000Z`, pool máximo de quatro conexões e modo somente leitura.
Todas as amostras mantiveram os hashes de resposta. O [relatório do painel](admin-home-optimization-2026-11-04.md)
e seu [artefato sanitizado](admin-home-optimization-2026-11-04.json) preservam a comparação;
os quatro arquivos originais `/tmp/admin-local-20261104-{1-baseline,2-current,3-current,4-baseline}.json`
foram conferidos nesta sessão.

| Chamada                    | Concorrência | Mediana antes → depois (ms) | p95 amostral antes → depois (ms) |
| -------------------------- | ------------ | --------------------------- | -------------------------------- |
| `dashboard.home`           | 1            | 20,55 → 16,96               | 23,43 → 20,29                    |
| `dashboard.home`           | 4            | 75,47 → 62,50               | 90,49 → 86,18                    |
| `dashboard.pendingLessons` | 1            | 33,38 → 26,05               | 66,01 → 30,29                    |
| `dashboard.pendingLessons` | 4            | 114,27 → 89,29              | 164,14 → 133,60                  |

São tempos locais das chamadas internas de API, sem rede/browser; não são o p95 de interação
nem o p99 de staging. Os testes focados do painel passaram: 11 unitários e 16 de integração.

As capturas iniciais abaixo têm uma amostra por componente: provam redução de consultas/linhas
e equivalência na base exercitada, mas foram substituídas pela rodada acima para latência.

| Captura local                         | `home`: consultas / linhas | Observação                                                                   |
| ------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `/tmp/admin-cost-before.json`         | 88 / 914                   | Baseline do código anterior aos cortes do painel.                            |
| `/tmp/admin-cost-after2.json`         | 66 / 846                   | P1 e P2; hash `0e6d4684b883` igual ao baseline.                              |
| `/tmp/admin-cost-before-lessons.json` | 66 / 846                   | `pendingLessons`: 12 consultas / 770 linhas.                                 |
| `/tmp/admin-cost-after-lessons.json`  | 66 / 846                   | `pendingLessons`: 10 consultas / 770 linhas; hash `0965350b0f8a` preservado. |

Os caminhos em `/tmp` são evidências temporárias desta sessão. Os relatórios e JSONs no repositório
preservam apenas métricas, hashes e inventários sem respostas com dados pessoais, parâmetros SQL,
tokens ou cookies.

O baseline atual do perfil contém 36 chunks, totalizando 2.446.420 bytes de JavaScript bruto e
612.186 bytes após compressão Brotli local (`/tmp/lazuli-client-bundle-before.json`, build
`tmIngeOLP0nTjgej9UbGf`). Isso mede o conjunto de assets identificado, não CPU ou bytes
necessariamente transferidos em cada navegação. O marcador `data-ready` existente indica
somente que o perfil básico chegou; a coleta precisa também aguardar o conteúdo funcional
da seção. Amostras com prontidão nula são inválidas para comparar interação até tela pronta.

A versão com C1–C3 compilou em produção (`o2MzbfW8sPypWyGXGayqu`): 26 chunks,
1.489.871 bytes brutos e 382.842 bytes Brotli, reduções de 39,1% e 37,5%, respectivamente.
As somas dos assets nos dois JSONs foram conferidas. O smoke funcional passou e a primeira abertura da agenda carregou quatro scripts adiados; o ganho de bytes não
é evidência de cumprimento dos 300 ms. A coleta de runtime encontrou perda de foco nativo e
throttling de frames mesmo com a aba marcada ativa. Essas amostras são descartadas para
comparação de interação até pintura, preservando a limitação explícita.

## Critérios de fechamento

- Cada achado tem ação executada e medição comparável, ou uma limitação concreta registrada.
- Comparações de código usam a mesma configuração, base e data de negócio; alterações de outras
  frentes são mantidas constantes. Registrar as árvores/arquivos efetivamente comparados.
- Backend: hashes e regressões cobrem calendário, históricos, soft deletion e permissões;
  medir chamadas com concorrência 1 e 4 sem sobrepor compilação ou testes pesados.
- Cliente: baseline atual de produção, versão corrigida, bytes por rota e interações reais via
  Orca; distinguir carregamento inicial de navegação interna e primeira abertura de componentes.
- TBT de carregamento, tarefas longas e amostras de interações devem manter seus nomes e
  limites. Não chamar uma amostra de laboratório de INP de campo nem de p95 do app inteiro.
- Revisar diffs e executar checks focados. Suítes completas permanecem no gate de entrega/CI.

## Relatórios finais e horizonte

- [Painel: implementação, latências locais e sequência de requisições](admin-home-optimization-2026-11-04.md), com [artefato das chamadas](admin-home-optimization-2026-11-04.json) e [artefato do experimento no navegador](admin-home-request-gates-2026-11-04.json).
- [Cliente: implementação, bundle e smoke](student-client-cost-2026-11-04.md), com [artefato sanitizado](student-client-cost-2026-11-04.json). A economia é conjunta de C1–C3.
- A comparação confiável de interação até tela pronta continua pendente por instabilidade de foco/agendamento do navegador. Coverage não foi obtido; não há ganho declarado de INP ou TBT.
- O diálogo de novo aluno importado na visão geral é candidato residual a investigar. Nenhuma economia foi presumida ou mudança adicional aplicada nesta rodada.
- O benchmark oficial de staging e os checks completos de entrega permanecem para a etapa combinada.
