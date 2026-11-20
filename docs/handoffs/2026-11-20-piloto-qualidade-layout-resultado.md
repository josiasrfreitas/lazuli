# Piloto de regressão de layout do Lazuli

## Ambiente e reprodução

- EC2 `orca-lazuli-adhoc`, hostname do sistema `ip-172-31-2-5`. Checkout
  `/home/ubuntu/workspaces/lazuli`, branch `feat/catalogo-estagios`, revisão de partida
  `697610715cdbc223cfab7aba5feeea7e9a02a1ee`.
- Node 22.23.5, pnpm 11.6.0, Orca 1.4.255, Chromium desktop 150. Usamos o Next em execução
  em `localhost:3000`, Storybook em `localhost:6006`, zoom de página e DPR 1, tema claro,
  fontes resolvidas e rolagem da janela e da tabela zeradas.
- **Produto.** `/alunos`, primeira página sem filtros, 252 alunos na base sintética existente.
  Para o estado filtrado sem resultados, `/alunos?busca=zzzxq-piloto-sem-resultado`.
  A sessão usada pertencia ao `SYSTEM_ADMIN` sintético. Para autenticar uma sessão local limpa, use
  `dev@lazuli.local` e o link recebido no Mailpit conforme o README.
- **Storybook.** `Patterns/LayoutQualityPilot`, história `Reference` e suas variantes. A história
  combina `Dialog`, `FormSection`, `FormRow`, `Input`, `Select` e `SegmentedControl` reais com
  dados sintéticos. Cidade e UF seguem a composição de campos curtos que também existe na etapa
  de endereço de Novo aluno. A escolha única, o carregamento em runtime e o vínculo com o endereço
  são da história. A cobertura automatizada desse modal se limita à história.
- Estado inicial registrado em `test-results/layout-pilot/initial-checkout.txt`, com patches e
  hashes de confirmação ao lado. O piloto é executado manualmente, fora dos package scripts e do CI.

Com o navegador Orca disponível no checkout e a sessão do Lazuli autenticada no mesmo perfil:

```bash
# Em outro terminal, se o Storybook ainda não estiver rodando.
pnpm storybook

# Controles íntegros e sete regressões determinísticas mais S1, uma alteração por vez.
LAYOUT_ARTIFACTS=test-results/layout-pilot/repro node scripts/test/layout-pilot/run.mjs matrix

# Uma mutação, com saída de diagnóstico, reversão automática e verificação da falha esperada.
node scripts/test/layout-pilot/run.mjs mutant H2

# Comparação do mesmo conjunto de telas com e sem asserções.
node scripts/test/layout-pilot/run.mjs bench

# Controles da versão íntegra. Use check modal-narrow para rodar só esse estado.
node scripts/test/layout-pilot/run.mjs check
```

`LAYOUT_PAGE` pode fixar uma aba já autenticada pelo ID de `orca tab list --json`.
`LAYOUT_WEB_URL` e `LAYOUT_STORY_URL` ajustam a origem caso os serviços usem outras portas.
`matrix` e `mutant` aplicam a modificação no código servido pelo dev server. Execute um
desses comandos por vez. Cada linha JSON registra cenário, URL, viewport e duração, com o
esperado e o observado nas falhas. O comando retorna 1 se um controle reprovar, se uma mutação
escapar ou acusar o motivo errado, ou se houver falha de execução.

## Critérios congelados

Os limites, as expectativas e as mutações foram registrados antes da avaliação em
`test-results/layout-pilot/frozen-criteria.md`, com horário em `frozen-at.txt` e hashes em
`frozen.sha256`. O viewport de 1100 × 760 e C3 foram reservados para avaliação.

| Check          | Contrato avaliado                                                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primeira linha | Início até 240 px em desktop e 380 px em viewport de até 480 px de largura. As referências foram 165 px e 335 px, com folgas de 75 px e 45 px. Também registramos o topo útil, a altura do cabeçalho e o espaço até a tabela.                                                                           |
| Vazio filtrado | Título do vazio até 325 px em desktop. Referência de 277,5 px e 47,5 px de folga para a composição com ilustração.                                                                                                                                                                                      |
| Escolha única  | Dropdown a partir de quatro opções, contado após a estabilização. Até três podem usar segmentado em uma linha se o texto couber. Tolerância geométrica de 2 px. Apenas o campo Local de atendimento entra nesta regra.                                                                                  |
| Cidade e UF    | Com pelo menos 320 px internos, Cidade recebe o espaço restante (mínimo de 228 px), UF fica entre 76 e 84 px e o gap é de 12 ± 2 px. O mínimo parte de 228 + 12 + 80 px, com 80 px para o rótulo curto e o exemplo de dois caracteres. Abaixo de 320 px, empilham em ordem e ocupam a largura do grupo. |
| Campo longo    | Nome do responsável ocupa a largura da seção, com discrepância de até 2 px.                                                                                                                                                                                                                             |
| Agrupamento    | Em Outro local, submeter sem endereço, localizar o erro e decidir se o campo está junto da decisão que o tornou obrigatório. Julgamento por capturas, fora da sensibilidade geométrica.                                                                                                                 |

A proposta para `docs/frontend/forms.md` é atualizar a regra de cinco opções com quebra de linha
para até três rótulos curtos, em uma linha, com dropdown a partir de quatro ou quando os rótulos
não couberem. A proposta se aplica a escolhas únicas de formulário. Abas, navegação e filtros têm
contratos próprios. A orientação em vigor ainda permanece como referência de produto.

## Resultados

A primeira rodada detectou **6 de 7** defeitos pelo check esperado (85,7%) e reprovou **0 de 12**
controles válidos. A segunda rodada detectou **7 de 7** (100%) e reprovou **0 de 12** controles.
S1 foi avaliado à parte. As duas rodadas concluídas têm zero casos bloqueados.

| Defeito       | Sinal esperado | Rodada 1                     | Rodada 2                    | Evidência da rodada 2                                                                                 |
| ------------- | -------------- | ---------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| H1            | Primeira linha | Reprovou, 4,036 s            | Reprovou, 4,319 s           | y=405 px, limite 240. Toolbar cresceu de 32 para 272 px.                                              |
| H2            | Primeira linha | Reprovou, 3,806 s            | Reprovou, 4,172 s           | y=405 px. Toolbar ficou em 32 px e o espaço até o conteúdo da tabela subiu de 16 para 256 px.         |
| C1            | Escolha única  | Reprovou, 3,823 s            | Reprovou, 3,950 s           | Cinco itens segmentados, a partir de quatro requer dropdown.                                          |
| C2            | Escolha única  | Reprovou, 4,114 s            | Reprovou, 4,081 s           | Começou com dois segmentos, terminou com seis. Os itens também excederam a largura disponível.        |
| F1            | Cidade e UF    | Reprovou, 4,075 s            | Reprovou, 4,631 s           | UF passou de 80 a 462 px, 66 px abaixo de Cidade.                                                     |
| F2            | Cidade e UF    | Reprovou, 4,201 s            | Reprovou, 5,438 s           | Grupo de 230 px, campos lado a lado, Cidade comprimida a 138 px. O contrato nessa largura é empilhar. |
| C3, reservado | Escolha única  | Escapou desse check, 3,134 s | Reprovou, 5,460 s           | Dois itens em uma linha, mas o segmentado excedeu a seção de 462 px.                                  |
| S1            | Revisão visual | Geometria aprovada, 4,088 s  | Geometria aprovada, 5,342 s | Campo obrigatório e erro separados da escolha por Município, Cidade e UF.                             |

Em C3, o segmentado de dois rótulos longos expandiu a trilha do grid na primeira rodada. Medir
o segmentado contra o próprio campo já expandido produziu aprovação indevida. O check de
largura do campo longo reprovou por efeito colateral (813,8 px contra uma seção de 462 px), o que
não conta como detecção de C3. C2 também acusou esse efeito secundário (466,25 px contra
462 px), além da falha correta de contagem. Na segunda rodada, o campo de escolha recebeu
`min-w-0` para conter o efeito sobre a trilha, e o detector passou a usar a interseção dos
limites do campo e da seção. C2 e C3 então reprovaram apenas em escolha única. Os mesmos limites
numéricos e casos foram usados nas duas rodadas. O ajuste foi registrado às 15:45:06 UTC,
com os resultados anteriores preservados em `round-1.jsonl`.

| Controle válido                | Observação na rodada 2                                                                 | Rodada 1 (s) | Rodada 2 (s) |
| ------------------------------ | -------------------------------------------------------------------------------------- | -----------: | -----------: |
| Alunos, 1280 × 800             | Primeira linha y=165 px                                                                |        5,218 |        4,153 |
| Alunos, 390 × 800              | Primeira linha y=335 px                                                                |        3,957 |        3,648 |
| Vazio filtrado                 | Mensagem y=277,5 px                                                                    |        3,742 |        3,430 |
| Modal desktop / campo longo    | Modal 512 px, grupo 462 px, Nome do responsável ocupa a seção, Cidade 370 px, UF 80 px |        6,407 |        3,137 |
| Modal em viewport de 390 px    | Modal 358 px, grupo 308 px, Cidade/UF empilhados                                       |        5,071 |        2,925 |
| Modal estreito em janela larga | Modal 280 px, grupo 230 px, Cidade/UF empilhados                                       |        4,465 |        3,684 |
| Seis opções assíncronas        | Dropdown com seis opções após estabilização                                            |        4,597 |        4,050 |
| Duas opções curtas             | Segmentado em uma linha, dentro dos limites                                            |        4,333 |        4,193 |
| Dois rótulos longos            | Dropdown aceito                                                                        |        3,609 |        4,948 |
| Erro multilinha                | Quatro linhas, foco no endereço, Cidade/UF empilhados                                  |        3,489 |        4,722 |
| Viewport reservado, 1100 × 760 | Primeira linha y=207 px, toolbar 74 px                                                 |        3,842 |        3,466 |
| Controle visual de S1          | Endereço obrigatório junto da escolha, erro com duas linhas                            |        3,226 |        4,311 |

Na sondagem do **modal de produto**, abri Novo aluno pela listagem e naveguei à etapa Endereço
sem gravar cadastro. No desktop, modal de 896 px, grupo de 846 px e Cidade/UF/CEP de
598/80/144 px na mesma linha. A 390 px, modal de 358 px e grupo de 308 px com os três campos
empilhados. Usei essa observação para ancorar a história no padrão do produto. A etapa de
endereço tem CEP no mesmo grupo e a busca de rua é um componente de busca. Os checks de escolha
única e de Cidade/UF com apenas dois campos exercitam a composição da história. Capturas e DOM
da sondagem em `product-address-1280.png`, `product-address-390.png` e
`product-address.jsonl`.

## Diagnóstico e revisão visual

- **Reparo H2.** A saída identificou Alunos/DataTablePage, primeira linha em 405 px, toolbar
  de 32 px e espaço de 256 px depois da toolbar. Comparei com os 16 px de referência e localizei
  `marginTop: 240` no componente com uma busca textual. Removi só o estilo experimental.
  A localização e edição automatizadas levaram 3 ms após a saída vermelha. Com a confirmação
  em navegador, foram 3,864 s. O novo resultado foi y=165 px e espaço de 16 px. O ensaio usou
  a saída, a medição íntegra de referência e a leitura do componente. O tempo de 3 ms mede
  automação de busca e edição, sem estimativa de leitura humana.
- **S1.** Executei a tarefa de escolher Outro local e enviar sem endereço. Na captura A, o
  campo obrigatório estava abaixo de Município, Cidade e UF. O foco no erro ajudava depois
  do envio, mas a ordem separava a decisão da ação que ela exigia. Na captura B, decisão, campo
  e erro estavam no mesmo grupo. Abri a chave após gravar as notas e confirmei que A era S1 e B era o controle. A revisão identificou 1 de 1 defeito qualitativo e 0 de 1 falso alarme.
  Uma melhoria seria manter o campo condicional imediatamente após a seleção, junto da mensagem.
- **Infraestrutura.** Na sondagem preliminar houve timeout e queda da ponte do desktop
  (`desktop_browser_bridge_unavailable`). Instalei bibliotecas do Chromium na EC2 e tentei o backend local do Orca em uma sessão
  isolada. O processo iniciou, a navegação expirou e encerrei a sessão isolada. Quando a ponte retornou, repeti a matriz
  completa no Orca desktop. As tentativas incompletas estão em `calibration.jsonl` e
  `matrix-bridge-unavailable.jsonl`. Elas ficam fora da sensibilidade e dos falsos positivos.

## Custo e estabilidade

A mesma sequência em cada repetição foi Alunos desktop, Alunos vazio, modal estreito e
modal com seis opções assíncronas. O runner fez a mesma navegação, preparação de controles,
espera por dados, fontes e geometria com o detector ligado e desligado. A versão desligada
suprime a leitura final dos retângulos e as comparações. As cinco duplas aquecidas alternaram
qual configuração rodava primeiro. Cada execução a frio abriu uma nova aba no mesmo perfil,
com navegador e servidores já em execução. O ensaio mede partida a frio no nível da aba, com os processos compartilhados aquecidos.

| Configuração        | Repetições | Mediana ponta a ponta | Pior tempo | Mediana das asserções | Pior tempo das asserções |
| ------------------- | ---------: | --------------------: | ---------: | --------------------: | -----------------------: |
| Aba nova, desligado |          1 |              15,137 s |   15,137 s |                  0 ms |                     0 ms |
| Aba nova, ligado    |          1 |              15,033 s |   15,033 s |                0,5 ms |                   0,5 ms |
| Aquecido, desligado |          5 |              15,507 s |   16,332 s |                  0 ms |                     0 ms |
| Aquecido, ligado    |          5 |              14,791 s |   16,755 s |                0,6 ms |                   0,8 ms |

A diferença observada entre as medianas aquecidas foi −0,716 s. As diferenças por par foram
+0,423, −0,329, +0,731, −0,723 e −0,824 s, com mediana de −0,329 s. O sinal variou entre
repetições. A diferença ponta a ponta ficou abaixo do ruído de navegação e transporte. Medido
diretamente no navegador, o custo incremental foi **0,6 ms na mediana e 0,8 ms no pior caso**
por passagem de quatro estados. A abertura de aba levou 347–423 ms, e a preparação depois
de navegar levou cerca de 4,1–4,3 s por passagem na mediana. O restante do tempo ponta a ponta
inclui navegação e chamadas à CLI do Orca. O banco sintético já estava disponível. Nenhum
carregamento de fixtures integra esses tempos.

Todas as 12 passagens concluíram sem divergência de aprovação ou erro de execução. Nas seis
com detector ligado, repetiram-se y=165 px (dados), y=277,5 px (vazio), grupo de 230 px
(modal estreito) e seis opções assíncronas no grupo de 462 px. As mutações confirmam repetição
do sinal em rodadas distintas. Os tempos brutos em milissegundos estão em `benchmark.jsonl`.

## Recomendação

| Check                                    | Decisão                                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primeira linha com dados                 | Pode bloquear mudanças na página Alunos nas faixas calibradas. H1 e H2 confirmam detecção pelo início dos dados com e sem mudança da altura do cabeçalho.                                     |
| Escolha única                            | Pode bloquear no campo exercitado na história, após incorporar a regra à orientação de formulários. Para cada tela de produto, calibre seu campo real e confirme os tipos de dados esperados. |
| Cidade e UF                              | Pode bloquear a composição testada na história. Para aplicar ao cadastro real, valide o grupo Cidade/UF/CEP e seus próprios limites.                                                          |
| Vazio e largura do campo longo           | Manter como diagnóstico na calibração. Os controles passaram, mas faltou uma regressão isolada para cada contrato.                                                                            |
| Agrupamento e ordem do campo condicional | Exigir revisão visual da tarefa com erro. S1 preserva as métricas e quebra a sequência da pessoa operadora.                                                                                   |

Os limites foram calibrados em uma listagem, uma composição modal e três viewports de uma
sessão Chromium. Esse recorte sustenta bloqueios locais, com casos para as mesmas superfícies.
O piloto continua opt-in durante a calibração.

## Evidências e integridade do checkout

A pasta `/home/ubuntu/workspaces/lazuli/test-results/layout-pilot/` contém o estado inicial,
os critérios datados, dados brutos, capturas por rodada, o ensaio de reparo, a chave e as notas
da revisão visual, e a execução final da versão íntegra. Os patches de alterações preexistentes
foram comparados byte a byte e os arquivos já não rastreados foram verificados por SHA-256.

Depois de reorganizar o runner na pasta de testes do repositório, a matriz de verificação
repetiu 7/7 detecções, 0/12 falsos positivos e S1 aprovado em geometria
(`verification.jsonl`). Os 12 controles também passaram na execução final sem mutações
(`intact.jsonl`). Ficaram aprovados o lint e a formatação dos arquivos do piloto, o typecheck
do Storybook e `git diff --check`. As suítes gerais de CI e o build ficam para a entrega da
branch. A listagem de arquivos e os hashes confirmam que as alterações preexistentes foram
preservadas.
