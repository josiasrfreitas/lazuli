# Diagnóstico do painel administrativo — 3 de novembro de 2026

## Resultado e limite

O `dashboard.home` atual executou **88 consultas em cada uma das 22 chamadas locais**. O baseline implantado registrava 90; ambientes, dados, hora e código são distintos. Isso não demonstra uma redução de duas consultas causada por esta investigação. Nenhum código de produto foi alterado.

O maior bloco identificável são pendências de aulas: **26 consultas**, sendo 13 para a prévia recente e 13 para o histórico. A agenda usa outras **19**. Juntos representam **45/88 (51%)** das consultas. Não foi observado um loop de consultas por aluno ou aula: o padrão nesta captura é fan-out de grupos e expansão de relações Prisma. Não foram variadas cardinalidades para provar ausência de N+1 em qualquer volume.

Há custo de CPU além das consultas: uma sonda separada observou **430 construções de `Intl.DateTimeFormat` por home**, das quais 253 no resumo escolar e 146 na agenda. Reutilização do formatter é uma oportunidade compartilhada com o diagnóstico de recebíveis; o ganho no painel ainda precisa de uma comparação antes/depois.

A tela também faz `dashboard.business`, **habilitado após `home` retornar**. Esse segundo endpoint teve 8 consultas e mediana local de 39,10 ms, fora das 88 consultas de home. A análise de um único endpoint não cobre a prontidão completa da página.

## Método reproduzível

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/diagnose-admin-home.mts \
  --output /tmp/admin-home-local.json
pnpm exec dotenv -e .env -- node --import tsx scripts/diagnose-admin-home.mts \
  --observe-intl --output /tmp/admin-home-intl.json
```

O script aceita somente Postgres em localhost, recusa `LAZULI_ENV=staging/prod`, usa pool máximo de 4 e `default_transaction_read_only=on` em todas as conexões, validado por `SHOW`. Statement timeout: 5 segundos. Inspeção prévia confirmou somente leituras na árvore executada. Nenhum `EXPLAIN ANALYZE`, alteração de fixtures, autenticação externa ou chamada de staging foi realizado.

Tempo de negócio fixado em `2026-11-03T18:00:00Z` (15h em São Paulo). Node 26.3.0/arm64. Um aquecimento de home, 10 chamadas com concorrência 1 e 12 com concorrência 4. Depois, três chamadas por componente isolado e três de business após seu aquecimento. Cada grupo de pendências foi medido com a mesma página, período e limite utilizados por `readHomeGroups`.

Instrumentação no pool pg captura contagens reais de statements, linhas retornadas, duração observada e aquisição de conexão; AsyncLocalStorage separa chamadas concorrentes. SQL e parâmetros não são persistidos. Hashes dos templates permitem compará-los; hashes de SQL com parâmetros só são usados em memória para contar repetições exatas. Não há PII no artefato. JSON de resposta não é gravado: apenas total e quantidade de itens quando disponíveis.

O teste de orçamento é opcional:

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/diagnose-admin-home.mts \
  --max-home-queries 60 --output /tmp/admin-home-budget.json
```

Este comando foi executado: gravou a captura e falhou com `dashboard.home exceeds query budget`, comprovando que o harness detecta o excesso de consultas. **60 é um alvo exploratório**, não um requisito aprovado nem um gate de CI. A contagem pode variar quando relações passam a ter dados. O script recusa sobrescrever um arquivo existente.

## Decomposição de consultas

| Componente real                  | Consultas/chamada | Mediana isolada | CPU média isolada | Resultado local         |
| -------------------------------- | ----------------: | --------------: | ----------------: | ----------------------- |
| `pending.health`                 |                 3 |         1,46 ms |           0,52 ms | 0 itens                 |
| `pending.occurrences`            |                 3 |         2,02 ms |           0,76 ms | 4 de 38                 |
| `pending.coverage`               |                 2 |         1,61 ms |           0,37 ms | 0 itens                 |
| `pending.lessons` recente        |                13 |         4,50 ms |           2,78 ms | 0 itens                 |
| `pending.lessons` histórico      |                13 |         6,00 ms |           1,75 ms | 1 de 677                |
| `pending.appointments` recente   |                 3 |         2,17 ms |           0,72 ms | 0 itens                 |
| `pending.appointments` histórico |                 3 |         1,83 ms |           0,68 ms | 0 itens                 |
| `pending.placement`              |                 3 |         2,39 ms |           0,58 ms | 1 de 1                  |
| `pending.allocation`             |                 2 |         1,09 ms |           1,13 ms | 4 de 6                  |
| `pending.students`               |                 6 |         4,88 ms |           2,06 ms | 4 de 4                  |
| `pending.documents`              |                 4 |         3,34 ms |           0,85 ms | 4 de 232                |
| `pending.contracts`              |                 2 |         1,25 ms |           3,28 ms | 4 de 12                 |
| `pending.renewals`               |                 3 |         2,11 ms |           0,62 ms | 0 itens                 |
| `pending.semester`               |                 2 |         2,08 ms |           1,06 ms | 4 de 18                 |
| **Subtotal pendências**          |            **62** |               — |                 — | —                       |
| Agenda                           |                19 |        15,46 ms |          14,09 ms | 8 de 12 eventos futuros |
| Faixas etárias                   |                 1 |         1,82 ms |           1,16 ms | 232 alunos ativos       |
| Resumo escolar                   |                 4 |        16,42 ms |          15,68 ms | 479 linhas retornadas   |
| Conversão de interessados        |                 2 |         1,45 ms |           0,44 ms | 6 linhas retornadas     |
| **Total home**                   |            **88** |    **69,32 ms** |      **66,10 ms** | 914 linhas SQL          |
| `dashboard.business` separado    |                 8 |        39,10 ms |          13,96 ms | 948 linhas SQL          |

Tempos isolados não se somam para prever o endpoint: home dispara componentes em paralelo e disputa as mesmas quatro conexões. CPU é de todo o processo e inclui Prisma, instrumentação e coleta de lixo. Há apenas três amostras isoladas: pequenas diferenças não constituem ranking estável.

Home com concorrência 4: mediana de **216,76 ms** e CPU média de **49,46 ms por chamada**. A soma das esperas de aquisição foi 955,53 ms por home em concorrência 1 e 3.097,34 ms em concorrência 4. São somas de esperas sobrepostas, **não segundos adicionais na latência da chamada**. O fan-out coloca trabalho em fila mesmo com uma única chamada. A duração observada de SQL também inclui pool/transporte/atraso do event loop; não equivale ao tempo de execução PostgreSQL. A captura não atribui com precisão a espera entre esses fatores.

Foram observadas **15 repetições exatas** de SQL+parâmetros e **42 consultas sem linhas** por home. Consultas vazias podem ser necessárias e repetições podem usar escopos diferentes; os números são sinais para investigar, não 57 consultas comprovadamente removíveis.

## Árvore de chamadas e oportunidades priorizadas

### 1. Recorte pequeno: projeção própria para pendências de aulas

`dashboard/router.ts → readAdminHome → readHomeGroups → readHomePending → lessonPage` em `home-pending.ts`. O caminho é executado duas vezes, para recente e histórico, em sequência dentro do grupo.

`lessonPage` usa `recordSessionInclude` de `class-records/data.ts`, desenhado para a operação completa de registro. Carrega registro, professor do registro, turma, estágio, professor inicial e perfil, atribuições com professores e perfis, e substituições com professores. O DTO do painel só utiliza id, nome da turma, data/horário e professor responsável. O filtro exige `classRecord: null`, mas o include ainda solicita o registro.

Evidência: até a prévia vazia gera 13 consultas; 12 delas retornam zero linhas. O histórico de uma única aula gera outras 13. Há consultas de `User`, `TeacherProfile`, `ClassSessionRecord`, `Class`, `Stage`, `ClassTeacherAssignment` e `ClassSubstitution` além do count e da página.

Proposta: consulta/projeção específica para o painel, com o mínimo para resolver professor, e sem buscar estágio e registro que não participam da resposta. Avaliar joins explícitos nessa leitura, ou carregar relações depois de confirmar que a página tem ids. Evitar substituir a resolução de professor por `class.teacher`: atribuições vigentes, professor congelado e substituição são contratos existentes. Não há ganho medido dessa proposta ainda.

Preservar: só sessões encerradas e sem registro; confirmação de presença não equivale a registro; limite recente de sete datas escolares, histórico separado, contagem exata, ordenação e links/ações. Exercitar substituição, saída de professor e responsabilidade congelada. Bases existentes: `dashboard/home.integration.test.ts` e testes de projeção de agenda/professor.

### 2. CPU: reutilização de formatters e agrupamento de datas antes de formatar

Uma corrida **separada e instrumentada** contou:

| Componente                    | Construções Intl por chamada | Tempo nos construtores por chamada |
| ----------------------------- | ---------------------------: | ---------------------------------: |
| Home completo, concorrência 1 |                          430 |                           31,62 ms |
| Resumo escolar                |                          253 |                           14,65 ms |
| Agenda                        |                          146 |                            8,06 ms |

`readHomeSchool` lê 252 datas de criação e chama `saoPauloDateOnly` para cada uma, além de `homePeriod`. `saoPauloDateOnly` passa por `session-time.ts`, que cria formatter. A agenda projeta candidatos em `meetingsBetween → classCandidates/projectMeeting`; `sessionEndInstant` resolve datas civis para calcular `editable`, propriedade que o DTO da agenda não utiliza. A projeção reconcilia candidatos projetados com sessões existentes e pode calcular o mesmo encontro mais de uma vez antes de deduplicar.

Priorizar um formatter reutilizável no domínio, coordenado com o recorte de recebíveis, preservando timezone e datas históricas. Depois avaliar evitar cálculos de editabilidade e metadados não usados na agenda, com um contrato específico que reutilize regras de identidade e responsabilidade. Uma agregação SQL das datas de criação por mês em São Paulo reduziria transferência e formatações; por ora 252 linhas são pequenas, então a reutilização do formatter tem menor escopo.

Não comparar a latência desta sonda diretamente com a primeira corrida: proxy global de Intl e aquecimento alteram os tempos. O custo observado dos construtores não é uma promessa de economia equivalente. Preservar viradas de dia/ano em São Paulo, horário de verão histórico, janelas de comparação parcial, fevereiro e datas civis armazenadas. Bases: `domain/test/session-time*` e `dashboard/home-insights.unit.test.ts`.

### 3. Agenda: 19 consultas para devolver oito eventos

`readHomeAgenda → agendaRows → meetingsBetween → loadScheduleData` lê turmas do período, dias fechados, sessões e substituições; também atendimentos e visitas do dia com alunos/interessados. As quatro leituras de agenda de professor expandem relações para estágio, semestre, slots, professores, perfis e atribuições. Aqui foram lidas 23 turmas, 45 slots e 12 sessões; depois há projeção, reconciliação e filtro em memória.

Proposta: depois dos recortes anteriores, medir uma projeção específica do dia e os campos realmente usados, com responsabilidade resolvida sem ampliar para o semestre inteiro. **Não trocar simplesmente por sessões materializadas**: a agenda também representa encontros projetados. Deduplicar consultas idênticas dentro da requisição somente após identificar consumidores e escopos; cache global acrescentaria invalidação e não é a primeira opção.

Preservar sessões projetadas/materializadas, identidade slot/data, cancelamentos, dias fechados com presença registrada, substituições revogadas, saída de professores, semestre/início da turma, ordenação e filtro de horário final. Bases: testes `teachers/schedule-projection.unit.test.ts`, agenda e home existentes.

### 4. Fronteira da página: home seguido por business

`apps/web/src/features/admin-home/home.tsx` habilita `dashboard.business` quando `query.data.canViewFinance === true`. As leituras são sequenciais na primeira visita. Ambos usam polling de 60 segundos. `readHomeBusiness → readAnalytics` usa agregações SQL do ledger; **não chama a composição de recebíveis em JavaScript otimizada na outra frente**. Também lê comparações de pagamentos e contratos. Há uma sequência de agregações em `readAnalytics` que merece medir separadamente antes de paralelizar.

Primeiro medir prontidão no navegador e rastrear qual endpoint bloqueia a informação que o administrador precisa. Se o atraso for relevante, avaliar iniciar business a partir de uma permissão já conhecida com autorização ainda imposta no servidor. Dividir dados críticos e secundários ou alterar polling é uma decisão de produto sobre atualização e estados de carregamento; não foi implementada. A espera de prévia de 1,8 s na UI deve ser distinguida de latência de rede.

Preservar controle de acesso, distinção entre recebimentos e acordos, saldo vencido atual e mês analítico, cancelamentos, pagamentos não alocados e comparações. `docs/frontend/admin-home-kpi-debt.md` registra a dívida aceita de KPIs: otimização não deve virar uma nova camada canônica sem trabalho próprio. ADR 0027 exige saldos registrados no painel, sem calcular/gravar juros novos como efeito da leitura.

### 5. Crescimento: leituras que agregam ou paginam em memória

`placementPage` carrega todos os interessados elegíveis e última visita para filtrar, ordenar e só então paginar; `studentsAwaitingPlacement` busca todos os alunos candidatos à regra de nivelamento antes de excluir ids; cobertura carrega todas as turmas afetadas; resumo escolar e comparação comercial carregam datas/valores dos últimos meses. O volume atual não os coloca acima de aulas/agenda. Uma consulta em lote já pode retornar dados demais sem ser N+1.

Avaliar agregação por mês no SQL e paginação no banco quando a regra puder ser expressa preservando ordenação e contagem. Não mover a semântica de último nivelamento, efetivação de matrícula ou professor sem testes diferenciais. Contadores e prévias com o mesmo filtro podem compartilhar base SQL, mas juntar via window function exige tratar a página vazia com total não zero.

## Próximo recorte sugerido

1. Coordenar formatter compartilhado com recebíveis e comparar home antes/depois no mesmo banco/horário.
2. Implementar projeção mínima de `lessonPage`; validar saída equivalente e medir redução das 26 consultas.
3. Repetir c1/c4 e medir a prontidão da página incluindo business. Só então escolher agenda, agregação SQL ou alteração de carregamento.

Não há justificativa medida para aumentar pool, criar cache global, materializar o painel inteiro ou adicionar índices indiscriminadamente. Os gargalos identificados permitem recortes menores.

## Artefatos e verificação

- [Captura base local](admin-home-local-2026-11-03.json).
- [Sonda de construções Intl](admin-home-intl-2026-11-03.json).
- [Script reproduzível](../../scripts/diagnose-admin-home.mts).
- [Baseline de staging](staging-general-2026-11-03.md).

Script executado duas vezes com sucesso de coleta; a primeira execução falhou intencionalmente no orçamento exploratório de 60 consultas. Não houve correção de produto para validar, portanto suites de produto não foram executadas nesta investigação. Formatação direcionada e `git diff --check` realizados. Checks completos continuam no gate de PR/CI. Os resultados locais não substituem medição controlada em staging nem experiência real de usuários.
