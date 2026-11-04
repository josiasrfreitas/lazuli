# Performance: estado do trabalho

Recorte da [issue #227](https://github.com/josiasrfreitas/lazuli/issues/227), atualizado em 04/11/2026.
O baseline de staging e as comparações locais têm ambientes e métodos distintos; seus tempos
absolutos não devem ser comparados como antes/depois.

O [plano de execução e medições locais](local-optimization-action-plan-2026-11-04.md) acompanha
os achados atuais do painel e do cliente, com ação, critério de aceite e evidência por item.

| Frente                         | Estado                                                                 | Evidência e trabalho restante                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Composição de recebíveis       | Implementada e validada localmente                                     | Agrupamento por parcela elimina varreduras repetidas. Mediana local melhorou 14–17%, totais iguais. [Método e resultados](receivables-benchmark.md).                                                                                                                                                                                                                                                                                                                                                                                       |
| CPU restante de recebíveis     | Correção implementada e validada localmente                            | Reuso do formatter aplicado: p50 local c4 1.545,51 → 283,26 ms, CPU/chamada 413,05 → 82,60 ms, totais iguais. [Comparação real de produto](receivables-formatter-2026-11-03.md); [diagnóstico](receivables-residual-2026-11-03.md).                                                                                                                                                                                                                                                                                                        |
| Frequência na lista de alunos  | Implementada e validada localmente                                     | Consultas 51/90/162 → 27/27/27 para páginas de 10/25/50; respostas completas iguais. [Validação e limites](students-attendance-batch-2026-11-03.md).                                                                                                                                                                                                                                                                                                                                                                                       |
| Painel administrativo          | Cortes publicados; nova leitura inicial candidata local                | `home` 88→66 consultas, mediana 20,55→16,96 ms com concorrência 1; `pendingLessons` 12→7, mediana 33,38→26,05 ms. A imagem publicada carrega `home`, `business` e pendências no primeiro lote, e lê detalhes de contratos vencidos ao abrir. Um candidato local entrega as três leituras visíveis na resposta da navegação; falta p95. [Plano e evidência](local-optimization-action-plan-2026-11-04.md).                                                                                                                                  |
| Visão financeira               | Segunda espera removida e publicada em staging                         | `contractClosings` é lido em paralelo com `analytics` na resposta inicial do servidor. A troca de ano foi validada localmente; no smoke de staging, a primeira navegação não fez chamada tRPC adicional e ficou em 383 ms, contra 499 ms em uma amostra da imagem inicial. Falta p95. [Comparação](staging-interaction-benchmark.md).                                                                                                                                                                                                      |
| Comparação em staging          | Nova imagem publicada; smoke comparativo concluído                     | Seis rotas passaram com o mesmo protocolo de primeira navegação. [Gráfico por rota](staging-navigation-smoke-comparison-2026-11-04.svg) e [caminho do painel](staging-panel-smoke-waterfall-2026-11-04.svg) comparam uma amostra por versão; não representam p95. A meta é p95 < 300 ms. A série oficial permanece para o fim das otimizações. [Protocolo](staging-interaction-benchmark.md).                                                                                                                                              |
| Prontidão/interação do cliente | Bundle reduzido; medição corrigida, primeira navegação em investigação | Perfil do aluno em duas builds atuais de produção: 612.186→382.842 bytes Brotli estimados (−37,5%). A automação antiga atrasava a marcação da pintura; seus p95 do painel são provisórios. O script agora marca indicadores, gráfico e pendências visíveis dentro do Chrome, mas falta uma série comparável com Colima parado. O pré-carregamento no servidor foi experimentado e revertido enquanto não há essa comparação. [Método e limites](staging-interaction-benchmark.md) e [análise do aluno](student-client-cost-2026-11-04.md). |
| Memória                        | Acompanhar                                                             | Houve OOM durante coleta adicional de planos; ainda não há causa demonstrada nem prova de vazamento.                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Um candidato adicional para a rota padrão de Alunos já foi validado localmente: a lista e as
opções de turma chegam na resposta da navegação, enquanto URLs filtradas seguem consultando a API.
Ele ainda não está em staging nem tem p95 medido.

As ações sustentadas pelos diagnósticos anteriores foram aplicadas e implantadas em staging para o
experimento. A primeira navegação ainda precisa de otimização e de um critério que inclua todas as
pendências do painel; o benchmark
oficial de staging fica para o final das otimizações, conforme combinado. Os checks completos de
entrega ficam para PR/CI.

O [baseline de staging](staging-general-2026-11-03.md) registra escopo, números e limites da coleta
original. O N+1 do painel do professor é acompanhado separadamente na issue #226 e em mudanças
locais anteriores a este recorte.

## Diagnósticos concluídos nesta rodada

- [Recebíveis: benchmark ampliado](receivables-expanded-2026-11-03.md): 1.200 observações por
  concorrência em três repetições; quantifica a variação da cauda e separa probes do baseline.
- [Alunos: custo após leitura em lote](students-list-diagnosis-2026-11-03.md): decompõe as
  27 consultas, volume de frequência/financeiro, redundâncias e próximos experimentos.

Estes diagnósticos locais não são novos resultados do gráfico de p99 de staging.
