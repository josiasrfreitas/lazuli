# Performance: issue #227

A meta é **p95 < 300 ms** do clique na navegação interna até a tela funcionalmente pronta. A
aplicação medida em staging é a revisão `da8b3b11`; não houve novo deploy na rodada de diagnóstico.
O [mapa empírico por módulo](staging-module-costs-2026-11-04.md) reúne os marcos de RSC, JS,
chamadas de API e pintura, com amostras brutas sanitizadas.

| Tela       | Primeira navegação em staging              | Limite do número                                                                |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Painel     | p95 **1.184 → 709 ms** após as otimizações | [Comparação válida de 20 amostras por imagem](staging-interaction-benchmark.md) |
| Alunos     | p95 **981 ms**                             | Espera tabela **e scores**; o seletor anterior media apenas a tabela            |
| Turmas     | p95 **428 ms**                             | 20 amostras da imagem atual, sem baseline p95 equivalente                       |
| Recebíveis | p95 **480 ms**                             | 20 amostras da imagem atual, sem baseline p95 equivalente                       |
| Financeiro | p95 **396 ms**                             | 20 amostras da imagem atual, marco do gráfico                                   |
| Aulas      | 456 ms no p50                              | Oito amostras do calendário; p95 não estabelecido                               |

O [gráfico do painel](staging-panel-first-navigation-comparison-2026-11-04.svg) compara duas
séries com o mesmo protocolo, navegador, conta e estado do Colima. O [gráfico das seis rotas](staging-navigation-smoke-comparison-2026-11-04.svg)
mostra um smoke por imagem e **não** representa p95. Os números históricos de 829 ms do painel
usaram um marcador de pintura diferente e não entram na comparação válida. O [baseline original de
p99 da API](staging-general-2026-11-03.md) mede chamadas sob carga, não clique até tela pronta.

O maior custo demonstrado nesta rodada é a segunda chamada de dados dos scores de alunos:
`students.healthBatch` inicia após o JS da lista e termina antes de a tela inteira ficar pronta.
Nas outras telas, RSC, descoberta tardia de scripts e renderização dividem o caminho crítico; o
mapa distingue medidas de hipóteses de otimização. Nenhuma mudança de produto foi aplicada nesta
investigação. O [plano e medições locais](local-optimization-action-plan-2026-11-04.md) preserva
as otimizações já publicadas, inclusive o trabalho anterior em [recebíveis](receivables-benchmark.md)
e [alunos](students-list-diagnosis-2026-11-03.md).
