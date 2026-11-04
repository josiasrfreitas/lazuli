# Reuso do formatador de datas em recebíveis

A construção repetida de `Intl.DateTimeFormat` foi eliminada no helper privado
`localDateTimeParts` em `packages/domain/src/session-time.ts`. A instância é criada
sob demanda e reutilizada por fuso, com o mesmo locale e as mesmas opções anteriores.
Os caminhos públicos atuais usam somente `America/Sao_Paulo`, portanto retêm uma
instância por processo. Resultados de datas, instantes, saldos e snapshots não são
armazenados em cache. Cada chamada continua executando `formatToParts` no instante
recebido, inclusive para datas históricas e instantes diferentes no mesmo processo.

Escolheu-se essa mudança por ser pequena e corresponder ao custo isolado no
[diagnóstico](receivables-residual-2026-11-03.md), sem ampliar as interfaces de ledger
para receber um contexto adicional de calendário. Converter o mesmo `now` uma única
vez por snapshot continua sendo uma oportunidade, mas seu benefício incremental
precisa ser medido depois desta correção.

## Comparação da alteração real de produto

Banco local com 2.640 parcelas, Node 26.3.0/macOS arm64, pool quatro, 20 amostras
por concorrência, duas chamadas de aquecimento e cinco perfis seriais. As capturas
antes/depois usaram o benchmark normal, sem hooks de diagnóstico ou interceptação
Intl; o agrupamento de ajustes/alocações já estava aplicado em ambas as versões.

| Métrica                         |       Antes |    Depois | Variação |
| ------------------------------- | ----------: | --------: | -------: |
| p50, concorrência 1             |   379,24 ms |  93,24 ms |  −75,41% |
| p99, concorrência 1             |   462,70 ms | 152,10 ms |  −67,13% |
| CPU por chamada, concorrência 1 |   380,72 ms |  92,00 ms |  −75,84% |
| p50, concorrência 4             | 1.545,51 ms | 283,26 ms |  −81,67% |
| p99, concorrência 4             | 1.926,62 ms | 356,59 ms |  −81,49% |
| CPU por chamada, concorrência 4 |   413,05 ms |  82,60 ms |  −80,00% |
| Consultas por chamada           |          11 |        11 |       0% |

Os seis totais financeiros ficaram iguais entre as duas versões e em todas as
chamadas de cada captura. Com 20 amostras, p99 coincide com o máximo; esta rodada
não permite estimar uma cauda estável nem prever o ganho em staging. A máquina
apresentou variação entre corridas no diagnóstico anterior. A redução de CPU e
latência concorda com o experimento causal, mas os percentuais são desta coleta.

O tempo SQL observado inclui transporte, cliente e execução de callbacks no Node.
Sua redução não demonstra que o executor PostgreSQL ficou mais rápido; as consultas
são as mesmas e o event loop passou a ter menos trabalho síncrono.

Artefatos sem PII: [antes](receivables-formatter-2026-11-03-before.json),
[depois](receivables-formatter-2026-11-03-after.json) e
[comparação](receivables-formatter-2026-11-03-comparison.json).
Uso reproduzível em [benchmark de recebíveis](receivables-benchmark.md).

## Validação

O teste de reuso executa instantes alternados de virada de ano/mês, ano bissexto
e transição histórica de horário de verão. Antes da mudança, falhou com 60
construções para 60 conversões; depois passou com uma construção. As datas esperadas
são literais independentes, protegendo contra armazenar a primeira data formatada.

Os testes existentes de calendário e ledger cobrem vencimentos, estados financeiros,
faixas de atraso, limites do mês em São Paulo e horários históricos ambíguos ou
inexistentes. Os testes de integração usam banco temporário para validar o snapshot,
a lista de inadimplência e as partes contratuais.

A comparação em staging e os gates completos de entrega continuam pendentes.
O gráfico original de p99 de staging não foi alterado por esta medição local.
