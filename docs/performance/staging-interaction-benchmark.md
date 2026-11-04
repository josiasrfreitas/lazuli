# Benchmark de navegação interna em staging

A meta é p95 **abaixo de 300 ms** entre o clique na navegação e a tela funcionalmente pronta. O
script mede a rota de origem já pronta, clica no link real da barra lateral e marca, dentro do
Chrome, quando cada elemento de prontidão aparece mais dois frames. No painel, os marcos são os
**indicadores**, o gráfico e a parte visível das pendências. `fullReady` é o maior desses três
tempos. As medições históricas abaixo foram feitas antes de adicionar `fullReady`, então ainda não
comprovam a meta para o painel inteiro. Dados de detalhes fechados não entram nessa medida.
As amostras são sequenciais em um único Chrome, sem teste de carga. O JSON guarda navegador,
viewport, perfil, rota, seletor de prontidão, tempos de rede e long tasks. Não contém dados de
alunos ou respostas da API.

O perfil padrão é **primeira navegação**: cada amostra abre um contexto autenticado novo, espera
a rota de origem ficar pronta e a rede estabilizar, e mede o primeiro clique para o destino. Isso
inclui JavaScript e dados ainda não carregados no destino. `--profile repeat` mede o retorno ao
destino na mesma aba depois de uma ida e volta de aquecimento; dados que o app já mantém em memória
podem tornar a tela pronta sem nova chamada à API. Os dois perfis respondem perguntas diferentes e
não devem ser misturados na mesma série.

Um login de staging deve ser preparado uma vez. Salve o link mágico autorizado num arquivo privado
e execute `node scripts/benchmark-staging-session.mjs CAMINHO_DO_ARQUIVO`. A sessão fica em
`~/.cache/lazuli/staging-benchmark-session.json` com permissão `0600`; também é possível informar
`LAZULI_PERF_STORAGE_STATE`. O comando exige Google Chrome instalado, mas não exige Docker nem
build local.

```sh
pnpm bench:staging:home --smoke
pnpm bench:staging:home
pnpm bench:staging:home --profile repeat
node scripts/benchmark-staging-interaction.mjs --all --samples 20
```

O padrão usa 20 amostras apenas no painel; `--all` percorre as seis rotas instrumentadas. `--smoke`
usa uma amostra por rota selecionada e serve somente para validar o fluxo. O resultado completo vai
para um JSON no diretório temporário do sistema; o terminal mostra o caminho e um resumo. O script
só calcula p95 com pelo menos 20 amostras e usa o posto mais próximo. No smoke, o resumo também
mostra quando começou a primeira chamada da API, quando terminou a última e quando chegou o último
arquivo JavaScript; esses marcos ajudam a escolher o próximo diagnóstico, sem atribuir causalidade
a uma consulta isolada. Para comparar versões, mantenha rota, perfil, conta, navegador, viewport
e número de amostras iguais e
anote a imagem publicada em staging. Pare Colima e não execute builds ou testes concorrentes durante
a coleta neste Mac de 8 GB: com a VM de 5 GB ativa, long tasks do Chrome chegaram a vários segundos
e contaminaram o resultado. O script bloqueia séries cronometradas no macOS enquanto Colima estiver
ativo; `--smoke` continua disponível e `LAZULI_PERF_ALLOW_COLIMA=1` permite uma exceção explícita.
Não compare este método com benchmarks diretos de API.

Em 04/11/2026, com Colima parado, duas séries de **20 primeiras navegações** compararam a mesma
conta e o mesmo navegador. Esses números usaram o protocolo anterior, que esperava a automação
detectar o elemento antes de marcar o tempo. Uma validação pontual encontrou 372 ms entre a
marcação dentro do Chrome e a marcação da automação; por isso os p95 abaixo são **históricos e
provisórios**, não um baseline válido para comparação com o protocolo atual:

| Imagem em staging                                                         | Estratégia                             | Indicadores p50 / p95 | Gráfico p50 / p95 |
| ------------------------------------------------------------------------- | -------------------------------------- | --------------------: | ----------------: |
| `sha256:5d346733b11c7f526abd0c9e1cfc7ed5ff37eb505eb0a51dda5eb886e9ddebd2` | Busca da API no cliente                |          822 / 879 ms |      855 / 912 ms |
| `sha256:2f6de8fc421648d899bed38ed986afb24df0f7badc4fb6d985df36e3d9c9c8e7` | Dados iniciais na resposta do servidor |          822 / 829 ms |      856 / 862 ms |

Esses tempos vão do clique à renderização no Chrome: incluem navegação, rede, consultas, JavaScript
e pintura; **não são duração de queries**. Na primeira imagem, a chamada inicial da API começou
com mediana de 356 ms após o clique e terminou em 706 ms. Na segunda, a primeira resposta RSC
terminou em 261 ms de mediana, mas a mediana de prontidão medida pelo protocolo anterior não mudou.
Esses dados não provam ganho do pré-carregamento nem ausência de ganho; staging voltou à primeira
imagem até que o método corrigido permita uma comparação confiável.

Uma validação pontual com o método corrigido mostrou o efeito da estratégia no fluxo completo:
na imagem sem pré-carregamento, o painel visível terminou em **959 ms**; com pré-carregamento de
`home` e `business`, os indicadores apareceram em **841 ms**, mas as pendências terminaram em
**1.189 ms**. Nessa segunda imagem, o RSC com os dados iniciais terminou em 554 ms; a requisição
separada de `pendingLessonSummaries` e `overdueContracts` só começou em 838 ms e terminou em
1.163 ms. O pré-carregamento parcial criou uma segunda espera. Ambas as medições foram de **uma
amostra** com Colima ativo: demonstram a ordem das requisições, mas não estabelecem p95 nem um
antes/depois de latência. A imagem sem pré-carregamento permaneceu em staging até a publicação de
04/11 descrita abaixo.

O marcador das pendências foi validado com um smoke de uma amostra na imagem atual. Ele não é uma
nova série de performance: Colima estava ligado, e p95 da tela completa ainda não foi coletado.
No mesmo diagnóstico pontual, a chamada agrupada do painel começou cerca de 360 ms após o clique;
o primeiro byte da resposta chegou cerca de 505 ms depois e a tela pintou aproximadamente 90 ms
mais tarde. A transferência da resposta durou cerca de 1 ms. Esses tempos localizam o caminho
crítico desse clique, mas não são um p95 nem identificam qual procedimento do lote o atrasou.

Uma medição anterior da primeira imagem com a VM ativa deu p95 de 1.495 ms nos indicadores e
1.850 ms no gráfico. A pressão de memória local invalida a comparação desse valor com as séries
acima. Uma validação pontual de **cinco** repetições na mesma aba deu 225–265 ms nos indicadores e
258–298 ms no gráfico, sem nova chamada da API. É sinal de uso contínuo rápido, mas não substitui
a primeira navegação na meta.

Em outro smoke sequencial de **uma primeira navegação por rota** em 04/11, com Colima ativo, a
prontidão foi 1.036 ms no painel, 589 ms em alunos, 551 ms em turmas, 647 ms em recebíveis,
499 ms no financeiro e 703 ms em aulas. O primeiro pedido tRPC começou entre 322 e 489 ms após
o clique; a última resposta JavaScript chegou entre 158 e 431 ms. No painel, o lote tRPC começou
em 489 ms, terminou em 949 ms e a tela visível terminou em 1.036 ms. Uma chamada isolada de
`dashboard.home` levou 769 ms na primeira tentativa e 228 ms na segunda; as demais leituras do
painel levaram 172–326 ms em duas rodadas sequenciais. Essa variação não permite atribuir os 460 ms
do lote a um único procedimento. O smoke mostra que as seis rotas ainda podem exceder 400 ms na
primeira navegação; não estabelece o p95 de nenhuma delas nem mede o código local ainda não
implantado.

Após a publicação da imagem `sha256:0d20eedd26791cdf885cfaa87da6a6f75193a7d4a98672c53288df13dd3c6ad7`,
um novo smoke repetiu as seis rotas com o **mesmo protocolo, perfil e conta** do smoke anterior.
O Colima default de 2 GiB estava ativo nos dois. O [comparativo por rota](staging-navigation-smoke-comparison-2026-11-04.svg)
agora inclui também o smoke da imagem final; o [caminho do painel](staging-panel-smoke-waterfall-2026-11-04.svg)
mostra apenas as duas primeiras imagens. Os [dados agregados](staging-navigation-smoke-comparison-2026-11-04.json) e
[gerador](../../scripts/plot-staging-navigation.mjs) permitem refazer os gráficos. O financeiro
foi de 499 para 383 ms e deixou de fazer a chamada tRPC após o clique; o painel foi de 1.036 para
1.154 ms, com o lote da API de 460 para 689 ms. Alunos, turmas, recebíveis e aulas ficaram em
623, 542, 640 e 805 ms na nova amostra. **Cada barra representa uma navegação, não p95 nem
estimativa causal de ganho.** Na imagem final, as seis rotas ficaram em 895, 599, 424, 480, 382 e
514 ms, respectivamente, em uma amostra cada. As outras cinco rotas ainda precisam de séries
de 20 amostras para qualquer comparação de p95. Os gráficos antigos de p99 da API permanecem um baseline separado, pois
medem chamadas sob carga e não o clique até a tela pronta.

Uma série de **20 primeiras navegações do painel** na imagem
`sha256:0d20eedd26791cdf885cfaa87da6a6f75193a7d4a98672c53288df13dd3c6ad7`, com o
protocolo `in-page-paint-marks-v2` e Colima default de 2 GiB ativo, estabeleceu o baseline
comparável da **tela inteira**: p50 de 980 ms e p95 de 1.184 ms. O lote tRPC começou em 503 ms
de mediana, terminou em 886 ms e a tela ficou pronta em 980 ms; são medianas independentes,
não uma soma de durações. Houve long tasks em 14 das 20 amostras, sem atribuição causal a uma
consulta específica. O [JSON bruto sanitizado](staging-panel-first-navigation-baseline-2026-11-04.json)
preserva as amostras. A medição seguinte usou esse mesmo protocolo, perfil,
rota, navegador, viewport, conta e estado do Colima; os 829 ms históricos não são comparáveis.
As outras cinco rotas continuam apenas com smoke de uma amostra, sem p95.
O [comparador](../../scripts/compare-staging-interaction.mjs) recusa arquivos com protocolo,
perfil, navegador, rota ou quantidade de amostras diferente e compara `fullReadyMs` diretamente:

```sh
node scripts/compare-staging-interaction.mjs docs/performance/staging-panel-first-navigation-baseline-2026-11-04.json CAMINHO_DO_NOVO_JSON
```

O deploy ad hoc da revisão `da8b3b11` publicou a imagem
`sha256:9d7cfadac316b3ac027beb5a8dc36827360b003c1d5078eea775e0b1b33f5883` em staging.
Um smoke das seis rotas passou. A [série final de 20 primeiras navegações](staging-panel-first-navigation-after-2026-11-04.json)
usou a mesma conta, Chrome `156.0.8078.80`, viewport, protocolo e Colima default de 2 GiB do
baseline. O [comparativo da tela inteira](staging-panel-first-navigation-comparison-2026-11-04.svg)
mostra p50 de **980 → 620 ms** e p95 de **1.184 → 709 ms**: menos 475 ms no p95, ou cerca de
40%. A meta p95 < 300 ms permanece distante.

Na mediana, o primeiro RSC terminou mais tarde (**172 → 350 ms**), como esperado ao incluir as
consultas no servidor, mas o lote tRPC do painel deixou de ocorrer após o clique. O último JS
chegou em **450 → 509 ms**, e a tela ficou pronta em **980 → 620 ms**. Esses marcos são medianas
independentes; não devem ser somados nem tratados como duração de queries. O primeiro RSC ainda
terminou em 433 ms no p95 e a tela em 709 ms, então uma nova redução até 300 ms requer investigar
separadamente a resposta inicial e o trabalho do navegador. O gráfico é reproduzível com:

```sh
node scripts/plot-staging-panel-comparison.mjs docs/performance/staging-panel-first-navigation-baseline-2026-11-04.json docs/performance/staging-panel-first-navigation-after-2026-11-04.json docs/performance/staging-panel-first-navigation-comparison-2026-11-04.svg
```
