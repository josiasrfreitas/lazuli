# Diagnóstico de `students.list` após frequência em lote

A frequência em lote removeu o crescimento de consultas por aluno: a página sem filtros
executa 27 consultas nos tamanhos 10, 25 e 50. O custo restante cresce principalmente com o
volume de aulas/presenças e parcelas carregadas. O próximo trabalho recomendado é reduzir
esse volume e a materialização das relações, preservando as regras de frequência e cobrança.
Este diagnóstico não aplica outra otimização ao produto.

## Evidência e reprodução

- [Captura principal](students-list-diagnosis-2026-11-03.json): 60 chamadas por tamanho e
  concorrência, pool máximo quatro; dez chamadas por componente isolado e cenário com filtro.
- [Captura Intl](students-list-diagnosis-intl-2026-11-03.json): três chamadas por cenário,
  observação de formatadores e mais 60 chamadas seriais de página 50 com profiler habilitado.
- [Comparação anterior](students-attendance-batch-2026-11-03.md): antes/depois da frequência
  em lote, incluindo equivalência das respostas e validação dos contratos de frequência.
- [Harness](../../scripts/diagnose-students-list.mts): `createCaller` real, data de negócio
  fixa em `2026-11-03T15:00:00Z`, PostgreSQL local em modo somente leitura, sem HTTP/browser.

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/diagnose-students-list.mts --samples 60 --max-list-queries 27 --output /tmp/students-list.json
pnpm exec dotenv -e .env -- node --import tsx scripts/diagnose-students-list.mts --samples 3 --observe-intl --cpu-profile /tmp/students-list.cpuprofile --output /tmp/students-list-intl.json
```

Os arquivos de saída precisam ser novos: o harness usa escrita exclusiva para evitar sobrescrever
uma captura. `--max-list-queries` protege as páginas sem filtros; filtros podem acrescentar consultas.
As capturas persistem contagens, hashes, nomes de tabelas e métricas; não persistem respostas,
parâmetros SQL, nomes de pessoas ou credenciais. O perfil opcional fica fora do repositório.

## De onde vêm as 27 consultas

| Bloco                       | Consultas | Mediana isolada, página 50 | Linhas retornadas, página 50 |
| --------------------------- | --------: | -------------------------: | ---------------------------: |
| Alunos e relações da página |        10 |                   12,82 ms |                          234 |
| Contadores das abas         |         3 |                    1,80 ms |                            3 |
| Cabeçalho                   |         2 |                    1,19 ms |                            2 |
| Total da paginação          |         1 |                    0,99 ms |                            1 |
| Situação financeira         |         6 |                   16,08 ms |                        1.074 |
| Frequência                  |         3 |                   26,40 ms |                        2.095 |
| Pendências cadastrais       |         1 |                    3,12 ms |                            0 |
| Resolução do semestre       |         1 |                    0,71 ms |                            2 |
| **Total**                   |    **27** |                          — |                    **3.411** |

Cada componente foi chamado separadamente, com as funções reais exportadas. Seus tempos não
somam a duração da rota: a implementação executa blocos em paralelo, com dependências entre
eles. Linhas são a soma das linhas retornadas pelo driver em cada consulta, não alunos únicos.

| Página | Matrículas / turmas | Aulas / presenças / compensações | Pedidos / parcelas |
| ------ | ------------------: | -------------------------------: | -----------------: |
| 10     |               9 / 7 |                    237 / 305 / 0 |           18 / 108 |
| 25     |             22 / 14 |                    468 / 724 / 0 |           44 / 264 |
| 50     |             46 / 17 |                  581 / 1.514 / 0 |           92 / 552 |

Na página 50 também vieram 189 ajustes e 195 alocações de pagamento. A quantidade de consultas
está controlada, mas a quantidade de dados e objetos processados continua dependente das turmas,
matrículas e pedidos daquela página.

## Prioridades sugeridas

1. **Frequência: reduzir materialização, medir antes de substituir.** É o maior componente
   isolado observado: 26,40 ms e 16,71 ms de CPU média na página 50. O código já agrupa aulas
   por turma e presença por matrícula, evitando leituras por aluno. O próximo experimento é
   comparar uma projeção/agregação que retorne os minutos necessários por matrícula, sem montar
   todos os objetos de presença. A hipótese é reduzir linhas transferidas, decodificação e heap.
   Risco: perder aulas sem presença individual no denominador ou duplicar minutos por joins.
   A ausência de compensações neste dataset limita o que essa captura comprova.
2. **Financeiro: uma derivação por pedido e contexto temporal por chamada.** O componente leva
   16,08 ms e 11,98 ms de CPU média na página 50. `studentOverdueTotals` filtra os beneficiários
   novamente por aluno e deriva o ledger por vínculo/parcela. Agrupar vínculos e derivar cada
   pedido uma vez pode evitar repetição em pedidos compartilhados; o ganho depende de quantos
   beneficiários compartilham pedidos. Também cabe comparar a leitura apenas das parcelas
   pertinentes ao atraso, mantendo a distinção entre ausência de pedido e pedido em dia.
   Não assumir ganho expressivo sem comparação de resultados e medição.
3. **Relações da página e contadores: eliminar redundâncias com escopo da chamada.** O bloco
   da página tem dez consultas para dados do aluno, matrícula, turma, horários e professores.
   A captura registra três execuções SQL idênticas excedentes por chamada sem filtro. As formas
   SQL mostram três contagens iguais de `Student` (abas, cabeçalho e total: duas redundâncias)
   e duas leituras de `TeacherProfile` (uma redundância). Revisar a projeção de responsabilidade
   do professor e reutilizar contagens compatíveis pode reduzir viagens ao banco. O custo
   isolado dos contadores é pequeno; priorizar simplicidade. Cabeçalho, abas e total têm escopos
   distintos com filtros: nunca reutilizar contagens sem demonstrar equivalência dos predicados.
4. **Datas: oportunidade pequena nesta rota após a correção compartilhada.** A captura Intl
   encontra zero construções de `Intl.DateTimeFormat` durante as chamadas. Na página 50 são
   651 `formatToParts`, somando aproximadamente 3,09 ms; 552 vêm do financeiro (~2,53 ms).
   Reutilizar o dia atual por chamada é candidato mensurável, mas não explica a maior parte do
   custo restante. A instrumentação só conta construtores durante cada captura, após imports
   e aquecimento; não mede inicialização do processo.

As prioridades são hipóteses de implementação sustentadas pelos volumes e componentes observados.
Não houve experimento de agregação SQL, projeção alternativa ou remoção de contadores nesta rodada;
portanto não há estimativa de ganho validada para essas propostas.

## Comportamento com carga e filtros

| Página | p50 serial | p50 com concorrência 4 | Máximo com concorrência 4 | CPU média por chamada, concorrência 4 |
| ------ | ---------: | ---------------------: | ------------------------: | ------------------------------------: |
| 10     |   40,75 ms |               95,18 ms |                 132,72 ms |                              22,92 ms |
| 25     |   44,40 ms |              152,41 ms |                 239,57 ms |                              34,39 ms |
| 50     |   65,88 ms |              223,41 ms |                 619,76 ms |                              54,01 ms |

A página 50 teve soma média de esperas por aquisição do pool de 312,09 ms com concorrência
quatro, contra 10,80 ms serial. Essas esperas se sobrepõem entre consultas e requisições:
não são uma parcela a subtrair da latência. Os tempos SQL observados também incluem espera,
transporte e resposta ao driver; não são tempos de execução exclusivos do PostgreSQL.
Há evidência de fila sob carga nesse pool limitado; isso não demonstra que aumentar o pool
seja a solução, nem que índices estejam faltando. Não foram coletados planos de execução.

Na página 25, os cenários adicionais produziram 30 consultas com busca sintética `a`, 27 com
filtro de turma, 33 com filtro de professor e 24 com status inativo. Logo 27 não é um teto
universal da rota. A seleção de turma/professor usa a primeira opção local disponível;
não cobre todas as distribuições ou combinações de filtros.

## Contratos que qualquer otimização deve preservar

- Frequência: semestre, entrada inclusiva e saída exclusiva de cada matrícula; apenas aulas
  confirmadas elegíveis; aula sem presença individual no denominador; compensação somente de
  reposição concluída vinculada à ausência original; minutos, arredondamento e sinalização
  produzidos por `computeCompensatedAttendance`.
- Financeiro: cancelamentos, isenções, ajustes e alocações; valor em atraso derivado pelo domínio;
  vínculo por contrato ou beneficiário; diferença entre sem pedido e em dia; datas de São Paulo.
- Lista: ordem estável, paginação, matrícula vigente, responsabilidade temporal do professor,
  bolsa e maioridade; exclusão lógica; contadores com seus escopos atuais.
- Fronteiras: dados pessoais não entram nos artefatos e a API mantém o contrato da resposta.

## Limites da conclusão e validação

Os hashes das respostas completas para páginas 10/25/50 coincidem com os hashes posteriores à
otimização anterior. A captura principal mantém um único hash por cenário e tamanho, em ambas
as concorrências. Isso demonstra estabilidade deste dataset e instante fixo; não substitui testes
de bordas, compensações, pedidos compartilhados ou mudança de período.

O ambiente local estava sob pressão de memória (observação operacional de cerca de 8,5 GB de
swap, não capturada no JSON). Não é correto comparar estas latências com a medição anterior
como uma regressão ou melhora: o estado da máquina não foi isolado. Snapshots de memória do
processo também não medem pico de heap nem comprovam vazamento.

O p99 empírico de 60 chamadas é essencialmente o máximo da amostra, sujeito a outliers e
instrumentação; não valida o p99 de staging do gráfico da issue #227. A captura Intl com três
amostras e concorrência configurada em quatro executa no máximo três chamadas simultâneas.
O perfil opcional e o observador Intl adicionam custo e não devem ser comparados diretamente
à captura principal. A CPU é do processo Node; a divisão por chamada sob concorrência é uma
média do lote, não atribuição individual de CPU.

Nesta retomada, revisaram-se o harness, a composição dos componentes e a consistência dos
artefatos offline. Não foi gerada outra carga no banco local durante o deploy experimental.
Passaram a execução de `--help`, a formatação dos dois arquivos desta retomada, `git diff --check`
e uma verificação offline dos JSONs: 60 amostras por cenário principal, 27 consultas, três
repetições SQL excedentes, soma dos volumes/componentes e igualdade dos hashes atuais com o
histórico nos tamanhos 10/25/50. O script tem 453 linhas, dentro do limite de 650.
O próximo gate é o smoke em staging e, para afirmar ganho de p99, repetir o mesmo cenário do
baseline com carga, volume, pool, máquina e versão registrados. Checks completos do repositório
permanecem no gate de entrega/CI.
