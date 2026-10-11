# Fechamentos comerciais no seed

O indicador mensal responde quanto valor nominal a escola contratou no período. Cada contrato
entra no mês de `Contract.agreedOn`: valor projetado = `monthlyAmountCents * durationMonths`,
mensalidade equivalente = soma das mensalidades e quantidade = número de contratos. Pagamentos,
descontos por pontualidade, matrícula, juros e multas não compõem esse valor projetado.

O seed anterior concentrava os 220 acordos cerca de seis a oito meses antes da referência. Esse
recorte servia à demonstração de recebimentos e atrasos, mas deixava o fechamento comercial atual
sem movimento. A nova distribuição ocupa nove meses, incluindo dez acordos no mês atual.

| Mês em relação à referência | Contratos | Pontuais | Perfis com histórico financeiro |
| --------------------------- | --------: | -------: | ------------------------------: |
| −8                          |        44 |       35 |                               9 |
| −7                          |        32 |       24 |                               8 |
| −6                          |        28 |       20 |                               8 |
| −5                          |        24 |       16 |                               8 |
| −4                          |        26 |       26 |                               0 |
| −3                          |        22 |       22 |                               0 |
| −2                          |        18 |       18 |                               0 |
| −1                          |        16 |       16 |                               0 |
| Atual                       |        10 |       10 |                               0 |
| Total                       |       220 |      187 |                              33 |

Com referência em 11/10/2026, os meses são fevereiro a outubro de 2026. Os acordos de outubro ficam
espalhados pelos dias 1 a 10; em outras referências, as datas são distribuídas somente entre o
primeiro dia e o dia atual, limitadas a 28. Os meses passados usam dias 1 a 28. A distribuição é
relativa à referência e não pretende reproduzir sazonalidade anual de uma escola específica. O
mês atual pode estar incompleto e não deve ser comparado como mês encerrado.

Para essa referência de 11/10/2026, os dez contratos de outubro somam R$ 2.350 de mensalidades e
R$ 28.200 de valor nominal projetado em 12 meses. Esses valores servem como referência manual
para avaliar a tela após a execução coordenada; não são totais de pagamentos recebidos.

Os 33 perfis de histórico financeiro são 11 parciais, 11 atrasados e 11 atrasos já quitados. Ficam
nos quatro meses mais antigos para conservar parcelas vencidas, juros já pagos e faixas de atraso.
Os demais contratos mantêm o perfil pontual. Os 220 alunos beneficiários, 205 pagadores, irmãos
com pagador compartilhado, preços nominais de R$ 200 a R$ 250 e duração de 12 meses permanecem.
As chaves de alunos, pagadores e comandos de contrato são preservadas. A derivação dos comandos
de pagamento permanece por aluno e número da parcela; contratos recentes naturalmente possuem
menos pagamentos históricos.

Acordo, vigência e cobrança seguem uma sequência: o primeiro vencimento é o primeiro dia
contratado que fica pelo menos sete dias depois do fechamento, no mês do acordo ou nos seguintes.
Um fechamento no fim de fevereiro com vencimento dia 5 pode precisar pular o mês seguinte para
respeitar essa antecedência. A vigência anual começa nesse primeiro vencimento. Isso acomoda a maior antecipação de pagamento do seed e evita
recebimentos anteriores ao acordo. Contratos recentes podem representar uma renovação comercial;
o seed não inventa contrato anterior, cancelamento ou histórico de matrícula para explicá-la. Um
acordo pode ter vigência futura e integrar o fechamento do mês em que foi firmado.

## Dependências e limites da mudança

O teste existente `packages/api/test/finance/seed-contracts.integration.test.ts` usa 01/01/2026 e
protege 220 contratos, 205 pagadores, 12 parcelas, pelo menos três parcelas futuras sem pagamento,
198 contratos em dia, 22 inadimplentes, parcial do aluno histórico de índice 1 e juros quitados do
índice 2. Os perfis desses alunos continuam nas coortes antigas; a mudança não exige alterar essas
expectativas. Datas exatas de acordo e coortes de início não eram fixadas por esse teste.

A mudança redistribui vencimentos e recebimentos: totais mensais de caixa, parcelas já vencidas na
referência e valores das faixas de atraso precisam ser novamente observados após a reconstrução.
Não há compromisso de conservar os valores monetários anteriores. As parcelas continuam passando
pelas regras de domínio, sem pagamento futuro ou saldos fabricados. O log de atividades deriva as
datas de fechamento e pagamento dos fatos e acompanhará a nova distribuição no próximo bootstrap.

Alterar apenas `agreedOn` mantendo os recebimentos antigos produziria uma cronologia falsa. Por
isso acordo e início de cobrança mudam juntos. A documentação operacional anterior sobre três
coortes de seis a oito meses precisa ser atualizada pelo integrador.

O integrador executou o `pnpm seed` completo no banco isolado em 11/10/2026. O navegador confirmou
os dez contratos de outubro, R$ 2.350 de mensalidade equivalente e R$ 28.200 projetados. O seed
não é incremental. Lint, testes, typecheck e build não foram executados por orientação do usuário.
