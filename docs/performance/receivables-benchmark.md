# Benchmark de recebíveis

O script [`benchmark-receivables.mts`](../../scripts/benchmark-receivables.mts) mede somente
`finance.receivablesSnapshot`, pelo `createCaller` público. Não inclui HTTP, sessão de navegador,
renderização ou JavaScript do cliente. Não escreve no banco nem executa `EXPLAIN`.

## Capturar antes e depois

Use o mesmo banco congelado, máquina, versão de Node e dia de negócio em `America/Sao_Paulo`.
Evite outras cargas durante as duas medições. O valor de `--dataset` é uma declaração do operador,
não uma verificação de identidade dos dados. Uma cópia local sem escritas é preferível a um banco
compartilhado que possa mudar entre as execuções.

Na versão anterior à alteração, execute na raiz:

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \
  --label before --dataset frozen-local-copy --output /tmp/receivables-before.json
```

Depois de aplicar a alteração, no mesmo ambiente:

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \
  --label after --dataset frozen-local-copy --output /tmp/receivables-after.json

node --import tsx scripts/benchmark-receivables.mts \
  --before /tmp/receivables-before.json --after /tmp/receivables-after.json \
  --output /tmp/receivables-comparison.json
```

Sem `--output`, o JSON vai para stdout. Um arquivo existente não é sobrescrito. `--help` e a
comparação offline não precisam de configuração de banco. `--samples N` substitui as 100 amostras
por concorrência **em cada repetição**; `--repetitions N` controla as repetições (padrão três).
`--smoke` usa três chamadas por concorrência e uma repetição, somente para verificar o harness.
Para uma cauda empírica maior, use `--samples 400 --repetitions 3` (1.200 observações por
concorrência). Cada repetição mantém seus próprios quantis/CPU/throughput em `repetitions`,
e `variability` descreve a dispersão entre repetições. `runs` agrega as observações por concorrência.
A comparação mantém o suporte aos artefatos v1 históricos e recusa métodos/configurações diferentes,
inclusive uma captura histórica com uma captura ampliada.

O [diagnóstico do custo restante](receivables-residual-2026-11-03.md) documenta os
hooks locais opcionais de CPU, event loop, pool e construção de `Intl.DateTimeFormat`,
incluindo um experimento temporário de reutilização de formatter somente no harness.
Esses modos alteram a medição e são identificados em `method.diagnostics`; a comparação
recusa métodos diferentes. Eles não constituem uma alteração de produto.

Capturas locais aceitam apenas hostname `localhost`, `127.0.0.1` ou `[::1]`, com `LAZULI_ENV`
ausente ou `local`. Capturas remotas exigem `LAZULI_ENV=staging` e a configuração normal do ambiente;
produção é recusada. O suporte a staging não executa nem autoriza uma carga remota por si só.

## O que é medido

O pool é limitado a quatro conexões, como no
[benchmark geral de staging](staging-general-2026-11-03.md). Uma leitura estabelece os valores
esperados e duas aquecem o caminho antes dos lotes. Cada lote faz 100 chamadas no padrão,
não 100 por consumidor. A ordem alterna entre repetições: c1/c4, c4/c1, c1/c4.
É um gerador fechado, sem pausas: um consumidor inicia outra chamada após concluir a anterior.
Não simula taxa de chegada externa e não mede espera na fila anterior ao caller.

O JSON guarda amostras individuais de latência, p50/p95/p99, mínimo/máximo, média, desvio
padrão populacional descritivo e coeficiente de variação, tempo total, chamadas por segundo e CPU
do processo. A CPU por chamada é a CPU total do lote dividida pelo número de chamadas, inclusive
com concorrência quatro; não atribui CPU individualmente a chamadas sobrepostas.

Cinco chamadas seriais adicionais medem CPU e eventos de consulta Prisma/Kysely por chamada.
Os eventos SQL são habilitados no cliente durante toda a execução, mas somente são retidos no
perfil separado. O somatório de durações SQL pode incluir transporte e espera por conexão, e
consultas paralelas podem se sobrepor; não corresponde ao tempo do executor PostgreSQL. A CPU
é do processo Node, não da máquina inteira nem do banco. Nenhum SQL, parâmetro, credencial,
identificador de aluno ou dado de contato é gravado nos artefatos.

Cada resposta deve ser exatamente igual ao snapshot inicial, inclusive nas chamadas de aquecimento
e perfil. A comparação exige mesmos parâmetros, runtime, ambiente, rótulo de dataset e dia de
negócio, e falha se o snapshot divergir. A implementação atual usa `new Date()` internamente;
o harness não fixa esse relógio e recusa capturas que atravessem a meia-noite em São Paulo.

A igualdade comprova somente os seis totais agregados retornados por `receivablesSnapshot`.
Não comprova identidade do dataset nem equivalência de todos os estados individuais das parcelas;
esses contratos precisam dos testes de domínio/persistência apropriados. O resultado não deve
ser apresentado como comprovação de ausência de regressões financeiras em toda a API.

Os percentis usam o método nearest rank. Com 100 amostras, p99 é a segunda maior observação;
com 20 ou menos, coincide com o máximo e tem pouca estabilidade. Compare também CPU e throughput,
e repita em condições controladas antes de tirar conclusões sobre caudas em produção.
Com 1.200 observações, p99 usa o rank 1.188 e deixa 12 observações acima dele. Isso melhora
sua resolução empírica; não certifica p99 populacional. As chamadas se correlacionam pelo pool,
event loop, JIT/GC e estado da máquina. Não é publicado intervalo de confiança que suponha
amostras independentes, e a dispersão entre três repetições não substitui repetições em outros dias.

## Diagnóstico separado do baseline

Use poucas chamadas e `--repetitions 1 --diagnostic-prefix /tmp/prefixo`. O diagnóstico
acrescenta hooks e deve ser uma captura separada; nunca trate sua latência como baseline.
`--diagnostic-no-cpu` desativa o sampling profiler, preservando os outros hooks.
Sem essa opção, os perfis ficam em `prefixo-r1-c1.cpuprofile` e `prefixo-r1-c4.cpuprofile`.

O wrapper dos delegates Prisma executa os mesmos quatro `findMany` reais do produto e registra
quantidade de linhas, duração até resolução e contagens das relações materializadas. Esse intervalo
inclui transporte, espera por pool/banco, callbacks e hidratação/composição Prisma. As 11 consultas
SQL observadas ficam dentro desses quatro spans; os dois níveis **não devem ser somados**.
O restante da chamada inclui agrupamento, ledger, calendário, beneficiários/WhatsApp, agregação,
orquestração e overhead dos probes. A subtração de CPU é publicada somente em c1, pois CPU
por janela de uma requisição c4 incluiria as outras. Não mede CPU nem tempo exclusivo do executor SQL.

`--intl-probe observe-parts` intercepta `formatToParts` inclusive no formatter já aquecido,
contando chamadas/instantes e tempo diretamente dentro da formatação. `reuse-parts` é um
experimento apenas no processo: reutiliza o array de partes para o mesmo formatter e timestamp,
somente durante uma requisição. Não altera ledger nem consulta, e verifica os mesmos seis totais.
A economia isola conversão Intl; extração de partes/data continua no produto. Ambos têm metadados
próprios e não entram na comparação normal como melhoria de produto.

Memória é observada nas duas extremidades de cada lote (RSS, heap e memória externa), além do
máximo de RSS **de toda a vida do processo**. Esses valores não estimam bytes alocados por chamada,
pico do lote nem vazamento: GC, JIT, módulos carregados e retenção dos próprios probes influenciam.
O event loop e o pool são medidos somente no diagnóstico. Nenhum registro financeiro/pessoal
é persistido pelo wrapper; cardinalidades são contagens.

A [captura ampliada local](receivables-expanded-2026-11-03.md) registra o produto após reuso
do formatter, com amostra longa e decomposição curta separada.

## Medição local em 3 de novembro de 2026

O agrupamento de ajustes e alocações por parcela foi medido antes e depois no banco local com
2.640 parcelas, em Node 26.3.0, macOS arm64. Foram 20 amostras por concorrência, duas chamadas
de aquecimento, cinco perfis seriais e pool de quatro. Esta medição não representa staging.

| Métrica                         |       Antes |      Depois | Variação |
| ------------------------------- | ----------: | ----------: | -------: |
| p50, concorrência 1             |   429,51 ms |   371,48 ms |  −13,51% |
| p99, concorrência 1             |   487,28 ms |   432,40 ms |  −11,26% |
| CPU por chamada, concorrência 1 |   425,96 ms |   374,62 ms |  −12,05% |
| p50, concorrência 4             | 1.735,48 ms | 1.445,48 ms |  −16,71% |
| p99, concorrência 4             | 2.298,11 ms | 1.827,66 ms |  −20,47% |
| CPU por chamada, concorrência 4 |   442,98 ms |   383,48 ms |  −13,43% |
| Consultas por chamada no perfil |          11 |          11 |       0% |

Os seis totais financeiros permaneceram iguais em todas as chamadas e entre as duas versões.
A duração SQL somada mediana no perfil passou de 58,73 para 65,76 ms; o ganho observado não veio
de menos consultas. O processamento ainda consome a maior parte do tempo, e o p99 desta amostra
curta corresponde ao máximo. Uma única corrida antes/depois não isola toda a variação do ambiente.

Artefatos sem PII: [antes](receivables-local-2026-11-03-before.json),
[depois](receivables-local-2026-11-03-after.json) e
[comparação](receivables-local-2026-11-03-comparison.json). A configuração usada foi
`--samples 20 --dataset local-2026-11-03`, com rótulos `before-grouping` e `after-grouping`.

## Correção do formatador

A comparação da alteração real de produto, posterior ao diagnóstico, está em
[Reuso do formatador de datas](receivables-formatter-2026-11-03.md). Os resultados
do agrupamento acima continuam registrados como uma etapa independente.
