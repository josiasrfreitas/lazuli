# Frequência em lote na lista de alunos

A lista de alunos passou a carregar as aulas confirmadas das matrículas selecionadas em lote.
A janela de cada matrícula continua limitada pelo semestre e pela entrada inclusiva/saída exclusiva.
As aulas sem registro individual permanecem no denominador; compensações vêm somente das reposições
concluídas vinculadas à presença original. O cálculo continua em `computeCompensatedAttendance`.

## Comparação local

Medição em 03/11/2026 pelo `createCaller`, com Node 26.3.0, pool de quatro conexões e concorrência
um. Cada tamanho de página teve uma chamada de aquecimento e três amostras sequenciais, usando
`now = 2026-11-03T15:00:00Z`. O banco local não recebeu escritas durante a comparação.

| Alunos por página | Consultas antes | Consultas depois | Mediana antes | Mediana depois |
| ----------------- | --------------: | ---------------: | ------------: | -------------: |
| 10                |              51 |               27 |      22,49 ms |       22,26 ms |
| 25                |              90 |               27 |      38,66 ms |       31,59 ms |
| 50                |             162 |               27 |      66,75 ms |       51,29 ms |

Os hashes SHA-256 das respostas completas serializadas foram iguais em todas as chamadas antes e
depois de cada tamanho de página. Os [resultados agregados](students-attendance-batch-2026-11-03.json)
guardam tempos, contagens e hashes; não contêm respostas ou dados pessoais.
A contagem foi estável nas três repetições de cada página. A amostra de latência é curta e não
estima p99 nem comprova o ganho em staging. A medição inclui API/banco, sem HTTP ou navegador.

O harness temporário usou o mesmo cliente instrumentado Prisma/Kysely de
[`benchmark-receivables.mts`](../../scripts/benchmark-receivables.mts), substituindo o cenário por
`students.list({ page: 1, pageSize })` com data fixa. Não foi criado um segundo benchmark persistente.

## Validação e limites

Os testes unitários protegem uma leitura por lote para páginas de 10/25/50, entrada vazia,
matrículas fora do semestre, separação de turmas, registros ausentes e compensação de minutos.
Os testes de integração executaram em banco temporário com migrations e drift check, cobrindo
`students.list`, percentual de frequência e conclusão/correção de reposições. O cenário adicional
com colegas de turma verifica janelas distintas e exclusão do dia de saída.

Ainda é necessário repetir em staging e observar memória/conexões. A consulta continua trazendo
as aulas pertinentes ao semestre para a página; o volume depende das turmas e das aulas confirmadas.
Não se adicionaram cache, tabela derivada ou mudanças na fórmula de frequência.
