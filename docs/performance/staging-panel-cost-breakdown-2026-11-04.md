# Custos da primeira navegação ao painel em staging

Na revisão `d33c7fdd`, 20 navegações internas autenticadas para `/` foram associadas aos logs do
servidor pelo `x-request-id`. A coleta ocorreu em 04/11/2026 (horário de Maceió; logs em UTC).
Cada navegação carregou as três fontes iniciais (`loaded_count: 3`), sem erro. Os números abaixo
descrevem **onde se gasta tempo**, não uma comparação entre versões. O navegador mediu do clique
até a tela pronta após dois frames; os logs Pino mediram trechos dentro do web. Percentis usam
nearest rank sobre as 20 amostras. As etapas paralelas e os percentis individuais não são somáveis.

| Marco da navegação no navegador |    p50 |    p95 |
| ------------------------------- | -----: | -----: |
| Clique → primeiro byte do RSC   | 151 ms | 156 ms |
| Primeiro byte → fim do RSC      | 212 ms | 278 ms |
| Fim do RSC → último JavaScript  | 162 ms | 179 ms |
| Último JavaScript → tela pronta | 119 ms | 154 ms |
| Clique → tela pronta            | 645 ms | 715 ms |

Os três scripts da rota transferiram 144,5 KB em cada amostra. Houve uma tarefa longa por
navegação, de 70 ms na mediana e 92 ms no p95. Os intervalos depois do RSC incluem descoberta,
transferência e execução de JS, React e pintura; estes dados não atribuem todos os 119 ms finais
à tarefa longa.

| Trecho no servidor (mesmo request ID do RSC) |    p50 |    p95 | Observação                          |
| -------------------------------------------- | -----: | -----: | ----------------------------------- |
| Identidade da página                         |  11 ms |  16 ms | Fora do gargalo principal           |
| Criação do contexto tRPC                     |   3 ms |   5 ms | Fora do gargalo principal           |
| Três cargas iniciais em paralelo             | 196 ms | 259 ms | Termina quando a mais lenta termina |
| `dashboard.home`                             | 186 ms | 255 ms | Inclui grupos e agenda em paralelo  |
| `dashboard.business`                         | 195 ms | 259 ms | `business_analytics` domina         |
| `dashboard.pendingLessonSummaries`           | 172 ms | 208 ms | Às vezes termina por último         |
| `home_groups`                                | 185 ms | 250 ms | 12 grupos de pendências em paralelo |
| `home_agenda`                                | 154 ms | 175 ms | Sobreposta a `home_groups`          |
| `business_analytics`                         | 192 ms | 254 ms | Quatro etapas em série no código    |

`readAnalytics` executa, em sequência, parcelas por mês, vencidos, pagamentos e aging. São seis
consultas no total porque a etapa de pagamentos faz três leituras. Cada consulta do ledger recompõe
suas agregações; ainda não há medida por consulta para dizer qual delas domina. `home_groups`
dispara os 12 grupos ao mesmo tempo, com uma segunda leitura de histórico para aulas e
atendimentos. O web em staging usa o limite padrão de **4 conexões**; o limite 2 configurado no
deploy pertence ao worker.

Para testar o efeito da concorrência sem nova publicação, fizemos chamadas **somente leitura**
às mesmas procedures na mesma instância. Os 12 grupos separados (três amostras por grupo)
levaram 2–10 ms cada no servidor; isso não reproduz a concorrência do painel. Em três chamadas
isoladas, `dashboard.home` levou 55–80 ms e `dashboard.business` 60–69 ms. Em três conjuntos
paralelos de `home`, `business` e `pendingLessonSummaries`, `home` levou 155–188 ms e `business`
159–213 ms. O aumento é compatível com espera pelo pool de quatro conexões, mas os logs atuais não
medem a aquisição de conexão diretamente; CPU ou contenção no PostgreSQL também podem contribuir.
Não seria correto atribuir os 185 ms de `home_groups` a um grupo específico a partir dessas
chamadas isoladas.

O próximo diagnóstico de maior valor é medir **tempo de espera por conexão** durante uma única
navegação e separar as seis consultas de `business_analytics`. Isso decide se vale reduzir o
fan-out de pendências, simplificar uma consulta do ledger ou rever o tamanho do pool dentro do
limite de conexões da role. No caminho observado, a chegada dos scripts e a montagem até a tela
pronta ocupam mais ~280 ms depois do RSC; isso exige um experimento de cliente separado.

As capturas brutas e os IDs das requisições ficaram somente em `/tmp` nesta máquina. Este
registro conserva apenas agregados e nomes de operações, sem dados de alunos.
