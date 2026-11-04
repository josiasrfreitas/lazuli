# Recebíveis: amostra ampliada e diagnóstico após reuso do formatter

Esta captura mede o produto com agrupamento de ajustes/alocações e reutilização de
`Intl.DateTimeFormat` já aplicados. Nenhuma mudança adicional de produto foi feita.
O alvo é o caller público `finance.receivablesSnapshot`, sem HTTP/renderização.
Banco local, somente leituras, pool máximo quatro; não houve staging, fixtures ou `EXPLAIN`.

## Método e alcance da cauda

O baseline usa três repetições de 400 chamadas por concorrência: 1.200 observações em c1
e 1.200 em c4. A ordem alterna c1/c4, c4/c1, c1/c4. As duas chamadas de aquecimento e
cinco perfis seriais adicionais seguem fora dos lotes. Todas as 2.408 respostas devem
ser exatamente iguais ao snapshot inicial. A igualdade abrange os seis totais retornados,
e não todos os estados financeiros individuais.

Os quantis são nearest rank empíricos. No agregado, p95 tem rank 1.140 e p99 rank 1.188,
com 12 observações acima do p99; em cada repetição, p99 usa rank 396 de 400. As amostras
são correlacionadas pelo gerador fechado, pool, event loop e estado da máquina. A medição
descreve esta carga local aquecida: não é um p99 populacional certificado, teste de tráfego
aberto ou previsão de staging. A variação entre repetições faz parte do resultado.
O baseline não instala os novos probes, wrappers de delegates ou sampling profiler.
Como no harness anterior, eventos Prisma estão habilitados no cliente, mas só são retidos
nas cinco chamadas de perfil serial fora dos lotes.

## Resultado do baseline

Node 26.3.0, macOS arm64, 3 de novembro de 2026 em São Paulo. As janelas foram
coordenadas entre agentes, sem builds/testes ou outros benchmarks deliberados durante
a captura. Isso não elimina variação do sistema operacional, banco ou máquina.

| Concorrência |     n |       p50 |       p95 |       p99 |      Máximo | CPU/chamada | Chamadas/s | CV da latência |
| ------------ | ----: | --------: | --------: | --------: | ----------: | ----------: | ---------: | -------------: |
| 1            | 1.200 |  95,22 ms | 191,73 ms | 273,57 ms |   606,70 ms |    91,01 ms |       8,93 |         38,56% |
| 4            | 1.200 | 387,37 ms | 720,80 ms | 970,93 ms | 3.169,01 ms |   112,29 ms |       9,19 |         48,44% |

| Repetição, ordem |   c |       p50 |       p95 |         p99 | CPU/chamada |
| ---------------- | --: | --------: | --------: | ----------: | ----------: |
| 1, c1/c4         |   1 | 114,69 ms | 236,27 ms |   373,51 ms |   108,86 ms |
| 1, c1/c4         |   4 | 458,88 ms | 808,08 ms | 1.045,42 ms |   127,43 ms |
| 2, c4/c1         |   4 | 457,29 ms | 719,82 ms |   961,20 ms |   124,05 ms |
| 2, c4/c1         |   1 |  92,75 ms | 130,11 ms |   156,68 ms |    82,61 ms |
| 3, c1/c4         |   1 |  92,59 ms | 129,49 ms |   164,74 ms |    81,54 ms |
| 3, c1/c4         |   4 | 297,77 ms | 379,64 ms |   410,56 ms |    85,39 ms |

A variação é material: p99 c4 vai de 410,56 a 1.045,42 ms sem mudança de produto.
A última repetição reproduz a ordem de grandeza do p50 anterior de 283,26 ms; o
agregado ampliado mostra uma cauda que 20 chamadas não caracterizavam. Comparar estes
quantis com aquela captura curta como se fossem antes/depois de código seria incorreto.
O baseline terminou com 11 consultas por chamada nos cinco perfis seriais.

## Carregamento versus processamento

Os diagnósticos usam 20 chamadas por concorrência, em processos separados do baseline.
A tabela abaixo mostra **médias em c1**, sem sampling profiler, para as duas observações
A/B e o experimento entre elas. Cada delegate real é awaited sequencialmente; seus
spans abrangem transporte, execução/espera, callbacks, hidratação e composição Prisma.
As 11 consultas SQL estão dentro dos quatro spans e não são somadas a eles.

| Modo, na ordem               | Leitura: parede | Fora da leitura: parede | Leitura: CPU do processo | Fora da leitura: CPU do processo |
| ---------------------------- | --------------: | ----------------------: | -----------------------: | -------------------------------: |
| Observar partes A            |        60,16 ms |                38,38 ms |                 52,14 ms |                         42,02 ms |
| Reutilizar partes no harness |        80,27 ms |                15,64 ms |                 68,23 ms |                         19,08 ms |
| Observar partes B            |        63,83 ms |                38,57 ms |                 50,33 ms |                         46,02 ms |

A duração média total em c1 foi 98,55/95,92/102,41 ms, respectivamente. O carregamento
mais lento durante o experimento mascara parte da redução de processamento; é uma razão
concreta para não prever ganho exato de produto a partir da latência total de uma corrida.
A CPU é do processo Node, inclusive threads/GC, e pode superar a duração de parede de
uma janela. Os hooks também têm custo. Em c4, não se atribui CPU das janelas individuais,
pois as quatro chamadas se sobrepõem.

Na observação A, o primeiro delegate (`installment.findMany` e suas relações) teve
mediana 35,81 ms; ajustes, 10,42 ms; alocações das parcelas, 9,51 ms; recebimentos do mês,
1,92 ms. Essas medianas não são parcelas aditivas de um p50 total. O perfil com sampling,
feito separadamente, identificou cliente de banco em 32,09%/40,70% do tempo amostrado c1/c4,
datas em 23,92%/33,33% e GC em 3,15%/4,47%. Esses percentuais incluem idle e instrumentação:
o inspector ainda aparece com aproximadamente 131/115 ms fora da janela principal do lote.
Não são percentuais exclusivos de CPU, nem medição do executor PostgreSQL.

## Conversões redundantes confirmadas

Cada chamada realiza **5.281 `formatToParts` para um único timestamp**: 2.640 derivações
de ledger, 2.640 verificações do mês e um cálculo dos limites do mês. O formatter já está
aquecido e reutilizado. O probe de partes não observa construções; seus campos de
construtor zerados não constituem uma nova contagem de construtores.

Nas observações A/B, o tempo diretamente dentro de `formatToParts` foi 24,11/24,09 ms
por chamada em c1 e 23,81/25,05 ms em c4. É tempo de parede instrumentado, sem a extração
subsequente de partes. Ao reutilizar partes no harness, cada lote de 20 chamadas manteve
105.620 invocações do wrapper, mas fez só 20 conversões reais e 105.600 reutilizações.
O trabalho fora da leitura caiu de cerca de 38 ms para 16 ms de parede por chamada.
Isso confirma uma economia removível nas conversões; a API do produto não foi alterada.

| Modo                         |   p50 c1 | CPU/chamada c1 |    p50 c4 | CPU/chamada c4 |
| ---------------------------- | -------: | -------------: | --------: | -------------: |
| Observar partes A            | 94,96 ms |       94,21 ms | 290,06 ms |       86,98 ms |
| Reutilizar partes no harness | 84,91 ms |       87,40 ms | 248,73 ms |       75,51 ms |
| Observar partes B            | 98,68 ms |       96,39 ms | 305,21 ms |       88,12 ms |

Todos os seis totais permaneceram iguais em cada resposta e entre as cinco capturas
(baseline, A, experimento, B e profiler). Os lotes curtos servem ao diagnóstico causal;
seus máximos não são usados como estimativa de cauda. Este cache de arrays não é uma
implementação de produto pronta: um contexto de data/mês calculado uma vez por snapshot
pode remover também extração repetida de partes, com contratos explícitos de calendário.

## Cardinalidade, relações e limites da projeção

As contagens foram estáveis nas chamadas instrumentadas: 2.640 parcelas, 220 pedidos,
893 ajustes, 904 alocações das parcelas e duas alocações recebidas no mês. A resposta
materializada contém 2.640 ocorrências de aluno contratual e 2.640 de pagador, associadas
às parcelas; esses números não são pessoas distintas. Não houve beneficiários avulsos
neste dataset, portanto esta captura não caracteriza essa distribuição.

Por chamada, os eventos SQL retornaram 2.640 linhas de parcela, 220 de pedido, 220 de
contrato, 220 de aluno e 205 de pagador, além dos ajustes/alocações. Há duas consultas
de `Payer`, duas de `Student` e uma de `OrderBeneficiary` mesmo com zero beneficiários.
O snapshot descarta nomes/contatos/beneficiários após o caminho compartilhado montar
pagadores, alunos e links WhatsApp. Há custo observável de carga/composição, mas sua
parcela **removível** não foi isolada: medir uma projeção mínima exigiria mudar a consulta
real ou criar uma cópia. Nenhuma dessas opções foi introduzida só para o benchmark.
Os tempos das relações não podem ser somados como uma previsão de economia.

No modo A sem sampling, a utilização do event loop foi 77,40% c1 e 97,85% c4;
atraso p99, 33,36/54,95 ms. A aquisição do pool teve p99 0,20/29,82 ms, com 129 de
220 aquisições c4 começando saturadas. Há fila no pool e event loop, mas os hooks
não distinguem a CPU do servidor SQL de cliente, transporte e espera por callback.

O RSS observado nas extremidades do modo A passou de 306,70 para 335,16 MiB em c1
e de 335,20 para 364,64 MiB em c4; no modo B o RSS c4 caiu de 328,81 para 314,59 MiB.
A variação e GC impedem concluir vazamento, pico por lote ou bytes por chamada. A captura
com profiler terminou c4 em 434,14 MiB e tem seu próprio overhead. O JSON distingue
endpoints de memória e máximo RSS de toda a vida do processo.

## Conclusão do diagnóstico e validação

A hipótese de conversões redundantes tem contagem, perfil e experimento convergentes:
aproximadamente 24 ms por chamada ainda são gastos convertendo repetidamente o mesmo
instante. O carregamento real também ocupa uma parcela relevante de CPU e parede;
sua projeção mínima continua sem estimativa causal de ganho. As duas oportunidades
ficam identificadas, sem modificar o produto nem abrir uma nova decisão de arquitetura.

Passaram smoke local, igualdade de todas as respostas, verificação de ranks conhecidos
(p95 1.140 e p99 1.188 de 1.200), comparação offline consigo mesmo, comparação dos artefatos
históricos v1 e rejeição de diferenças de método/snapshot. Formatação e `git diff --check`
foram aplicados aos arquivos desta entrega. Gates completos e medição remota continuam
fora deste diagnóstico e pertencem à entrega/CI.

Artefatos sanitizados: [baseline com amostras](receivables-expanded-2026-11-03-baseline.json)
e [diagnósticos agregados e CPU](receivables-expanded-2026-11-03-diagnostics.json).
Não contêm SQL, parâmetros, credenciais, identificadores de pessoas, nomes ou contatos.
Capturas detalhadas e perfis brutos permanecem em `/tmp`.

## Reprodução

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \
  --samples 400 --repetitions 3 --label current-expanded-baseline \
  --dataset local-2026-11-03 --output /tmp/receivables-expanded-baseline-2026-11-03.json
```

Para diagnóstico, use lotes curtos em processos separados e saídas novas:

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \
  --samples 20 --repetitions 1 --label read-cpu-profile --dataset local-2026-11-03 \
  --diagnostic-prefix /tmp/receivables-expanded-cpu \
  --output /tmp/receivables-expanded-cpu.json

pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \
  --samples 20 --repetitions 1 --label observe-parts-a --dataset local-2026-11-03 \
  --diagnostic-prefix /tmp/receivables-expanded-parts-a --diagnostic-no-cpu \
  --intl-probe observe-parts --output /tmp/receivables-expanded-parts-a.json
```

Depois do modo `observe-parts`, execute `reuse-parts` em outro processo e repita
`observe-parts`, com labels/prefixos/outputs novos. O experimento só reutiliza partes
para a mesma instância de formatter e o mesmo timestamp dentro de uma requisição.
Continua executando a query, ledger e snapshot reais; não elimina extração de partes.
A comparação normal recusa esse método como se fosse uma alteração de produto.

Os perfis brutos ficam em `/tmp`, com sufixos `-r1-c1.cpuprofile` e `-r1-c4.cpuprofile`.
Analise com `node scripts/analyze-receivables-cpu.mjs <perfis>`. O profiler e os hooks
alteram a medição; seus números ficam separados do baseline.
