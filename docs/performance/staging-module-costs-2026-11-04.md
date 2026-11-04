# Custos da primeira navegação por módulo em staging

Todas as medições desta rodada usaram a aplicação publicada na revisão `da8b3b11`, Chrome
`156.0.8078.80`, viewport 1440×900, sessão autenticada nova por amostra, navegação interna pela
barra lateral e Colima default de 2 GiB ativo. As amostras foram sequenciais, sem build ou deploy.
O protocolo marca a pintura após dois frames. O p95 é o 19º valor ordenado em 20 amostras; não
é uma promessa de latência de produção. Os marcos de rede são tempos desde o clique, não durações
de consultas PostgreSQL.

| Módulo e marco visível                                                                            | Amostras | Pronto p50 | Pronto p95 | RSC completo p50 | Último JS p50 | API cliente no caminho crítico |
| ------------------------------------------------------------------------------------------------- | -------: | ---------: | ---------: | ---------------: | ------------: | ------------------------------ |
| [Painel](staging-panel-first-navigation-after-2026-11-04.json): indicadores, gráfico e pendências |       20 |     620 ms |     709 ms |           350 ms |        509 ms | Não                            |
| [Alunos](staging-students-full-ready-2026-11-04.json): tabela **e scores**                        |       20 |     708 ms |     981 ms |           199 ms |        377 ms | `students.healthBatch`         |
| [Turmas](staging-classes-first-navigation-2026-11-04.json): tabela                                |       20 |     413 ms |     428 ms |           177 ms |        327 ms | Não                            |
| [Recebíveis](staging-receivables-first-navigation-2026-11-04.json): tabela                        |       20 |     458 ms |     480 ms |           239 ms |        390 ms | Não                            |
| [Financeiro](staging-finance-first-navigation-2026-11-04.json): gráfico                           |       20 |     380 ms |     396 ms |           228 ms |        156 ms | Não                            |
| [Aulas](staging-lessons-first-navigation-2026-11-04.json): calendário                             |        8 |     456 ms |          — |          ~200 ms |       ~370 ms | Não para o calendário          |

**Alunos precisa de uma ressalva importante.** O seletor anterior considerava a tabela pronta
assim que `aria-busy=false`, embora os scores ainda exibissem skeletons. Duas séries com esse
seletor parcial deram p95 de [937](staging-students-first-navigation-a-2026-11-04.json) e
[611 ms](staging-students-first-navigation-b-2026-11-04.json), mostrando também a variação na
chegada do JS. O seletor corrigido espera os scores: p95 de **981 ms**. Nesse conjunto, o pedido
`students.healthBatch` começou em 446 ms, terminou em 653 ms e os scores pintaram cerca de 47 ms
depois, em medianas pareadas. A chamada durou 197 ms de mediana incluindo rede; ela só inicia após
o JavaScript da página. Esta segunda rodada é um gargalo comprovado para a tela inteira. A lista
e os filtros padrão já chegam pelo RSC.

Na lista de alunos, sete scripts somaram 195,5 KB transferidos após o clique. Em uma captura de
staging, o maior deles transferiu 110 KB e continha código do cadastro de aluno, embora o diálogo
estivesse fechado. Uma amostra de Coverage registrou execução de cerca de 121 mil dos 654 mil
caracteres decodificados dos sete scripts; no maior chunk, 84 mil de 390 mil. Coverage mostra código
não executado **naquela navegação**, não a economia de adiar seu carregamento. O import antecipado
de `NewStudentDialog` é um candidato verificável para um experimento pequeno.

No painel, o RSC termina em 350 ms e a tela em 620 ms na mediana; o intervalo pareado entre ambos
é 273 ms, e as 20 amostras têm uma long task de 66–74 ms. Três GETs sequenciais e isolados em
staging deram medianas HTTP de 248 ms (`home`), 221 ms (`business`) e 254 ms
(`pendingLessonSummaries`), com apenas três amostras por endpoint. Incluem rede e autenticação,
enquanto a rota executa as três leituras em paralelo. Não identificam uma consulta ou endpoint
como gargalo individual. É preciso perfilar a tarefa longa do navegador e, para repartir os
350 ms do RSC, medir tempos dentro do processo de staging em uma rodada posterior.

Turmas e recebíveis não fizeram chamada tRPC necessária à pintura. Em recebíveis, os quatro
scripts (53,4 KB) começaram após o RSC e levaram aproximadamente outra ida de rede de 150 ms;
a tabela apareceu 69 ms após o último JS. Em turmas, três scripts (54,6 KB) chegaram em 327 ms e
a tabela apareceu cerca de 84 ms depois. Nenhuma das séries teve long tasks. A lista de turmas
importa antecipadamente o diálogo de criação e a área de organização; adiar esses módulos é
hipótese de redução do JS, ainda sem economia medida.

No financeiro, o gráfico ficou visível cerca de 150 ms depois do RSC, apesar de apenas um script
novo de 1,2 KB e de nenhuma chamada tRPC após o clique. Houve uma long task em todas as amostras,
com mediana de 56 ms. O p95 de 396 ms omite a amostra máxima de 670 ms pelo método do posto mais
próximo; uma série de 20 amostras ainda descreve pouco a cauda. O dado sustenta investigar
renderização/hidratação do gráfico, mas não
atribui o custo ao Recharts sem trace de função. Em aulas, os sete scripts somaram ~204 KB; a
chamada `me,sessionGeneration.status` terminou depois de o calendário estar pronto. Ela pode
atrasar um aviso de preparação, mas não explica o marco medido do calendário. Oito amostras não
estabelecem p95.

O primeiro byte do RSC apareceu por volta de 150 ms nas rotas medidas. Onde o navegador precisa
baixar scripts descobertos após o RSC, há uma segunda espera de rede antes da pintura. Isso torna
o alvo p95 < 300 ms difícil com a atual sequência de requisições. A prioridade com evidência mais
direta é eliminar a rodada tardia de `healthBatch` em alunos, preservando o resultado dos scores;
depois medir o efeito de adiar o cadastro fechado. Os demais cortes de bundle, prefetch de código
e refatorações de renderização precisam de um experimento isolado antes de serem tratados como
ganho. Nenhuma otimização de produto foi aplicada nesta rodada.
