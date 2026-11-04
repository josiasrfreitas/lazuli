# Decomposição dos custos da primeira navegação em staging

Este diagnóstico complementa o [benchmark por módulo](staging-module-costs-2026-11-04.md).
Capturamos traces de Chrome em navegações autenticadas reais na revisão `da8b3b11`, sem build,
deploy ou mudança nos serviços. Os tempos abaixo são de **capturas individuais**, com overhead do
profiler; não substituem os p95 de 20 amostras. Os marcos de prontidão informados na tabela foram
registrados dentro da página após dois frames, para evitar a latência da automação. Tempos de RSC e JS são marcos da
rede desde o clique, não duração de SQL. Eventos de CPU aninhados não devem ser somados.

| Tela       | RSC completo | Último JS |                   Marco pronto | Trabalho identificado depois da rede                                           |
| ---------- | -----------: | --------: | -----------------------------: | ------------------------------------------------------------------------------ |
| Painel     |       356 ms |    519 ms |                              — | Tarefa de 73 ms entre 555–628 ms: roteador Next, React e Recharts              |
| Alunos A   |       203 ms |    506 ms |   Tabela 576 ms; scores 828 ms | `healthBatch` 594–803 ms; reação/pintura ~25 ms                                |
| Alunos B   |       282 ms |    698 ms | Tabela 873 ms; scores 1.166 ms | `healthBatch` 931–1.145 ms; reação/pintura ~20 ms                              |
| Turmas     |       265 ms |    369 ms |                  Tabela 423 ms | 7 ms de avaliação de scripts, ~8 ms de estilo/layout; sem long task            |
| Recebíveis |       248 ms |    395 ms |                  Tabela 468 ms | 40 ms na maior chamada React, ~18 ms de estilo/layout; sem long task           |
| Financeiro |            — |         — |                              — | Uma tarefa React/Recharts de 74 ms nesta captura; 54 medições de texto do eixo |
| Aulas      |       339 ms |    503 ms |              Calendário 585 ms | Maior tarefa 35 ms, incluindo ~12 ms de estilo/layout                          |

**Alunos.** O caminho é `StudentsTable` → `StudentScores` → `students.healthBatch`. O lote de
scores só começa depois que o JS monta a tabela. Nos dois traces, os scores acrescentaram
**253 e 293 ms** à tabela; o pedido durou 209 e 214 ms, quase todo até o primeiro byte. Este
intervalo mistura rede, fila e servidor: sem timing interno, não permite atribuir uma query. Antes
dele, o maior dos sete scripts da rota transfere 110 KB e leva 141–165 ms desde o primeiro byte
até terminar nas duas capturas. Ele contém código de `NewStudentDialog`, importado mesmo fechado.
Carregar esse diálogo só ao abrir é um experimento pequeno e plausível para antecipar **tabela e
início do lote de scores**, mas o chunk também pode conter código compartilhado; 110 KB não são
economia garantida. Embutir `healthBatch` no RSC depois de `students.list` pode simplesmente
serializar as leituras e atrasar a descoberta dos scripts, então não é ganho gratuito.

**Painel.** O RSC completa em 356 ms nesta captura e os três scripts necessários só chegam até
519 ms. A tarefa de 73 ms depois disso contém aproximadamente 20 ms de amostras de CPU no roteador
Next e 16 ms no chunk Recharts, além de React e medidas de layout. Isso explica parte do intervalo
após o RSC, não os 356 ms do próprio RSC. Uma inspeção somente leitura da instância staging via
SSM encontrou nove linhas de log do web nas últimas 24 horas, sem tempos de `home`, `business` ou
`pendingLessonSummaries`; não há grupo CloudWatch. Consultas agregadas do Postgres também não
associariam as três chamadas paralelas a uma navegação específica. Para atribuir o custo de
servidor, uma publicação **futura** precisa registrar, sem PII, os tempos de identidade, contexto
e cada promessa da página sob um identificador opaco. Não há base para priorizar uma query SQL
específica do painel agora.

**Turmas e Recebíveis.** Nas duas capturas, o primeiro byte do RSC chegou em ~150 ms. Os scripts
começaram em 216/249 ms e levaram outra espera de ~145 ms até o primeiro byte; o corpo de
Recebíveis transferiu em poucos milissegundos. Depois do último JS, a prontidão levou 54/73 ms,
com React e layout, sem tarefa longa. A série de 20 amostras mostra o mesmo padrão, embora com
valores absolutos diferentes. O atraso decisivo aqui é a sequência de duas esperas de rede,
seguida da montagem. Reduzir alguns milissegundos de SQL ou do tamanho dos scripts não elimina
essa segunda ida; os imports antecipados dos diálogos de Turmas são candidatos a corte de bytes,
mas ainda não têm ganho medido. Nesta rota e em Recebíveis, p95 < 300 ms neste caminho de rede
provavelmente exigirá evitar uma ida ou reduzir a latência entre navegador e staging.

**Financeiro.** A série de 20 amostras tem RSC completo em 228 ms e gráfico visível em 380 ms na
mediana; o JS novo já havia chegado. O trace identifica uma chamada React/Recharts de 74 ms e
54 chamadas ao `getBoundingClientRect` do elemento de medição de rótulos do Recharts. Essas
chamadas consumiram ~1 ms diretamente, mas coincidiram com ~8 ms de recálculo de estilo e ~4 ms
de layout dentro da tarefa. Isso sustenta que a montagem dos eixos/gráficos participa do custo,
sem atribuir os 152 ms inteiros ao Recharts. A duração da captura com profiler não entra no
benchmark. Simplificar a configuração dos eixos ou o número de gráficos iniciais requer um
experimento visual e de tempo isolado; adiar conteúdo visível só mudaria o critério de pronto.

**Aulas.** Os sete scripts transferiram 204 KB; o maior, 110 KB. Nesta captura, JS e RSC
terminaram em 503 e 339 ms, e o calendário em 585 ms. A maior tarefa levou 35 ms, com ~12 ms de
estilo/layout; a pintura somou cerca de 2 ms. O pedido `me,sessionGeneration.status` começou
próximo ao marcador do calendário e terminou depois, portanto não explica esse marco. Pré-carregar
o status poderia estabilizar o aviso de preparação, mas não demonstrou ganho para o calendário.
É preciso identificar a composição do chunk grande antes de propor um corte de código.

Os traces brutos de Chrome e scripts de captura permanecem apenas em `/tmp/lazuli-*` nesta
máquina por conterem detalhes de execução. Este documento guarda somente tempos agregados e
nomes de código. A prioridade de menor complexidade é testar o adiamento do diálogo fechado em
Alunos; os demais pontos precisam de experimento isolado ou de timing de servidor numa futura
publicação. Nenhuma otimização de produto foi feita nesta rodada.
