# Diagnóstico do custo restante de recebíveis

O custo dominante depois do agrupamento de ajustes/alocações é reconstruir
`Intl.DateTimeFormat` milhares de vezes para a mesma configuração de São Paulo.
O snapshot de 2.640 parcelas faz **5.281 construções por chamada**: uma em cada
derivação de parcela, outra em cada verificação do mês e uma para os limites do mês.
As duas primeiras operações repetem a conversão do mesmo `now` dentro da chamada.

A concorrência quatro faz essas operações síncronas disputarem o mesmo event loop.
Os aproximadamente 1,45 s são latência de uma chamada com outras três em andamento;
o consumo do processo fica em aproximadamente 384 ms de CPU por chamada nesse lote.
Não são 1,45 s de CPU exclusiva de cada chamada.

## Evidência e controle

Foram executados quatro processos em sequência, sem testes/builds concorrentes
pelos agentes, no banco local sem escritas e com o agrupamento já aplicado.
Node 26.3.0, macOS arm64, pool quatro, duas chamadas de aquecimento e 20 amostras
por concorrência, primeiro um e depois quatro. O relógio de negócio não foi fixado;
todas as capturas ficaram em 3 de novembro de 2026 em São Paulo.

| Execução, na ordem                                    |    p50 c1 | CPU/chamada c1 |      p50 c4 | CPU/chamada c4 |      p99 c4 |
| ----------------------------------------------------- | --------: | -------------: | ----------: | -------------: | ----------: |
| Baseline A, sem hooks                                 | 394,23 ms |      427,10 ms | 1.970,34 ms |      491,00 ms | 2.899,83 ms |
| Observar construtores, sem profiler                   | 510,72 ms |      528,45 ms | 2.111,62 ms |      524,07 ms | 3.646,44 ms |
| Reutilizar formatter somente no harness, sem profiler |  97,66 ms |       96,78 ms |   283,45 ms |       84,95 ms |   388,06 ms |
| Baseline B, sem hooks                                 | 369,02 ms |      369,90 ms | 1.467,77 ms |      384,40 ms | 1.740,91 ms |

O baseline B reproduziu a ordem de grandeza dos 1.445,48 ms da medição anterior.
A diferença entre os baselines A e B mostra variação relevante da máquina/ambiente,
mesmo sem carga deliberada dos agentes. Os resultados do profiler anterior eram
ainda menores: p50 c1 233,47 ms e c4 890,83 ms. Não se deve atribuir essas diferenças
entre corridas a uma mudança de código.

O modo de observação contou 105.620 construções em cada lote de 20 chamadas, todas
com uma única configuração. O tempo de parede medido diretamente dentro dos
construtores foi 333,76 ms/chamada em c1 e 340,87 ms/chamada em c4. Esse cronômetro
não mede CPU exclusiva; pode incluir pausas e efeitos da instrumentação. Ele também
não inclui `formatToParts`, extração das partes nem serialização da chave do probe.

O experimento de reutilização manteve as mesmas chamadas de formatação, consultas,
dados carregados e regras. Interceptou apenas a construção de `Intl.DateTimeFormat`
no processo do benchmark, devolvendo a instância já criada para a mesma configuração.
Houve uma construção real e 105.619 reutilizações por lote. O construtor original
foi restaurado ao terminar cada lote, inclusive antes do perfil serial de cinco
chamadas. O produto não recebeu cache nem outra alteração neste diagnóstico.

Contra o baseline B, o experimento reduziu o p50 c4 em 80,69% e a CPU por chamada
em 77,90%; contra A, 85,61% e 82,70%. Contra o probe de observação, com os mesmos
hooks, as reduções foram 86,58% e 83,79%. Isso confirma causalmente um custo grande
e removível na construção repetida. Não é uma previsão de ganho exato em produção:
o probe altera o caminho de execução/JIT, adiciona cronômetros e serializa chaves,
e os baselines mostram variação do ambiente. Com 20 amostras, p99 é o máximo.

Todos os seis totais do snapshot ficaram iguais entre as quatro capturas, a captura
anterior com profiler e em cada chamada, incluindo aquecimento/perfil serial.
Essa igualdade não cobre todos os estados financeiros individuais nem substitui
testes de regras de calendário e ledger.

## Ranking dos custos

1. **Construção repetida do formatter: principal custo confirmado.** O contador e o
   experimento acima isolam essa variável. Não é um problema de complexidade
   quadrática que o agrupamento anterior deveria ter eliminado.
2. **Conversão da mesma data de negócio por parcela: trabalho redundante confirmado
   pelo código e pelas contagens, custo adicional ainda não isolado.** Reutilizar
   o formatter preserva 5.281 chamadas a `formatToParts` e à extração das partes.
   O experimento não mediu quanto se ganha eliminando essas conversões também.
3. **Leitura, hidratação e montagem do ledger: piso restante, ainda sem decomposição
   causal completa.** Permanecem 11 consultas por chamada e a carga das relações
   de pedido/pagador/aluno usada também pela lista de atrasados. O snapshot usa
   somente vencimento, coletabilidade e ledger, mas esse caminho também monta
   beneficiários e links WhatsApp. No experimento ainda restam 85–97 ms de CPU por
   chamada; esse valor inclui formatação residual, cliente de banco, regras e hooks,
   portanto não deve ser chamado de custo Prisma isolado.
4. **Espera por pool/banco: existe, mas não explica o custo dominante observado.**
   No perfil anterior a aquisição tinha p50 0,03 ms em c1 e 1,48 ms em c4; a
   saturação ocorreu em 79 de 132 aquisições c4. No experimento com reutilização,
   p50 c4 foi 1,10 ms e p99 30,91 ms. A competição por conexões pode afetar a cauda,
   mas aumentar o pool não remove as construções síncronas confirmadas acima.

## O que os perfis permitem afirmar

Na captura anterior, a utilização do event loop foi 97,00% c1 e 99,80% c4;
o atraso p99 foi 103,68 e 362,28 ms. A CPU por chamada ficou próxima entre os lotes
(240,61 e 250,28 ms) e o throughput não aumentou (4,15 e 4,07 chamadas/s).
Essa combinação sustenta a interpretação de fila no event loop sob concorrência.

Os perfis amostrados atribuíram 34–35% do tempo amostrado a `localDateTimeParts`
no ledger e outros 34–35% ao frame `receivablesSnapshot`, quase todo como self,
apesar de esse frame conter pouco trabalho explícito. Funções otimizadas/inlined
podem ter sido atribuídas ao chamador; as posições dos arquivos TS transpilados
aparecem como linha 1. Não há evidência para chamar aqueles 35% de custo das somas,
do `map` ou de um estágio específico. As contagens posteriores e o experimento
confirmam a hipótese de datas repetidas sem depender dessa atribuição ambígua.

Os grupos identificáveis do cliente de banco ocuparam 8,58% c1 e 9,24% c4 do tempo
amostrado; GC, 1,36% e 1,64%. Esses percentuais são de tempo amostrado, incluindo
idle, código nativo e custo do profiler; não são percentuais exatos da CPU do processo.
Os stacks incluem também 92,29/68,47 ms no controle do inspector, fora da janela
principal do lote. Não foi isolado um percentual de overhead do profiler: comparar
aquela corrida com estas, em condições variáveis, não responderia essa pergunta.

O cronômetro de consulta do hook mede até a Promise resolver no Node. Ele inclui
aquisição de conexão, transporte, processamento do cliente e atraso para executar
o callback. Em c4 essas durações cresceram com o event loop ocupado, mesmo sem
uma medição do executor PostgreSQL. Durações de consultas e de chamadas sobrepostas
não podem ser somadas para repartir 1,45 s em fatias independentes. Não foi executado
`EXPLAIN`, perfil de CPU do banco nem teste de aumento do pool.

## Próximo experimento

Calcular a data/mês de negócio uma vez por snapshot e reutilizar esse contexto
na derivação das parcelas e na agregação. A previsão falsificável é reduzir as
5.281 conversões para uma por chamada, preservando os seis totais e as regras
de vencimento, inclusive nas bordas de mês e na meia-noite de São Paulo. Esse
experimento deve usar o mesmo banco e uma sequência baseline/experimento/baseline,
com latência e CPU por chamada medidas sem sampling profiler.

Uma implementação revisável precisa preservar os contratos dos chamadores de
`deriveInstallmentLedger` e a distinção entre datas civis de vencimento e instantes.
Reutilizar um formatter no helper compartilhado é outra opção de menor mudança
de interface, mas mantém conversões redundantes. A decisão entre as duas merece
uma medição própria; o cache global do probe não é uma proposta pronta de produto.

Depois disso, medir separadamente o carregamento mínimo necessário ao snapshot
permitirá avaliar o custo de hidratação/relações sem misturá-lo com Intl. Isso fica
como investigação posterior, sem expansão do escopo desta entrega.

## Reprodução e artefatos

O agregado versionado contém apenas métricas, contagens, nomes de tabelas/funções
e identificadores de arquivos de captura: [receivables-residual-2026-11-03.json](receivables-residual-2026-11-03.json).
Não contém SQL, parâmetros, identificadores de pessoas, nomes, contatos ou credenciais.
Os perfis brutos e capturas detalhadas ficaram em `/tmp` e não são versionados.

Para repetir, usar o mesmo dataset congelado e nomes de saída novos. Rodar baseline,
observar, reutilizar e baseline, nessa ordem. Exemplo dos três modos (repetir o
primeiro com outro label/output ao final):

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \
  --samples 20 --label baseline-a --dataset local-2026-11-03 \
  --output /tmp/receivables-baseline-a.json

pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \
  --samples 20 --label observe --dataset local-2026-11-03 \
  --diagnostic-prefix /tmp/receivables-observe --diagnostic-no-cpu \
  --intl-probe observe --output /tmp/receivables-observe.json

pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \
  --samples 20 --label reuse --dataset local-2026-11-03 \
  --diagnostic-prefix /tmp/receivables-reuse --diagnostic-no-cpu \
  --intl-probe reuse-formatters --output /tmp/receivables-reuse.json
```

Sem `--diagnostic-no-cpu`, o prefixo também produz perfis `-c1.cpuprofile` e
`-c4.cpuprofile`, analisáveis com `node scripts/analyze-receivables-cpu.mjs <perfis>`.
Os hooks são exclusivos de execução local. O modo de diagnóstico/probe é gravado
no método da captura, e a comparação recusa métodos diferentes e capturas antigas
de diagnóstico sem essa informação. Um resultado experimental não deve aparecer
como ganho de uma alteração de produto na comparação antes/depois normal.

Não foi aplicada uma correção adicional de produto nem estabelecido um gate de
performance estável para CI. Esta entrega identifica a causa e quantifica um
experimento; o custo original continua no produto.
