# Handoff — revisão integrada do produto

Atualizado em **13/10/2026**. O usuário vai revisar cada tela e pedir ajustes durante a revisão.
A implementação integrada está disponível para esse parecer; isso não representa aprovação visual,
execução das suites automatizadas ou conclusão da entrega em PRs.

## Branch e ambiente

- Branch que acumula tudo: **`josiasrfreitas/operacao-pedagogica`**.
- Worktree de implementação: `/Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica`.
- HEAD antes deste handoff: `fca86c1` — ajustes finais de formulários e evidências de Leads/matrícula.
- Preview: **http://operacao-pedagogica.lazuli.localhost**.
- Banco isolado: `lazuli_operacao_pedagogica`; porta web **3004**.
- Em 13/10, a porta 3004 continua com um único processo Next ouvindo. Manter **apenas um servidor
  web ativo por vez**, por limitação de RAM.
- Um worker Hatchet real, com um slot e namespace isolado, foi deixado ativo no último checkpoint.
  Confirmar seu estado antes de depender de processamento assíncrono; não criar outro por rotina.
- O checkout `/Users/josiasribeiro/orca/lazuli` contém alterações alheias a esta entrega. Trabalhar
  na worktree integrada e preservar as alterações do checkout original.

## Como continuar durante a revisão

Aplicar os pedidos tela por tela **nesta mesma branch**, com commits incrementais. Preservar a
direção premium/moderna, os componentes do design system, as quinas mais quadradas e o azul das
tabelas. Professores é a referência visual escolhida para Turmas. Labels em português-BR; datas
de negócio em `America/Sao_Paulo`.

Validar os fluxos afetados no browser, incluindo telas estreitas e claro/escuro quando pertinente.
O usuário dispensou **lint, testes, typecheck e build locais**; não confundir isso com dispensar
validação no browser. Hooks de commit/push e verificação de whitespace continuam autorizados.
Ler os guias obrigatórios do repositório ao alterar código/UI e manter evidências proporcionais.

**Não abrir novos PRs nem dividir a branch durante esta revisão.** Depois do parecer sobre o
produto completo, organizar uma stack simples, por vertical e dependência, usando `gh stack`
(`github/gh-stack`, versão instalada no checkpoint: 0.1.1). Cada PR deve apontar para a branch
anterior; a primeira aponta para main. Os drafts #169 e #172 são históricos consolidados aqui,
não a stack final. Nenhuma stack final foi criada.

## Mapa para revisar as telas

Os caminhos abaixo refletem a navegação atual. Recursos e permissões variam entre administração
e professor; não ampliar papéis como efeito colateral de ajustes visuais.

| Tela / caminho                                       | Estado implementado para revisão                                                                                             | Referência                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Login — `/login`                                     | Link por e-mail, Google condicionado à configuração e animação inicial desktop                                               | Observação de ambiente abaixo                                                            |
| Alunos — `/alunos`, `/alunos/[id]`                   | Perfil com Pedagógico e Financeiro, contatos/responsável, progressão acadêmica, cobranças e pagamento                        | [Escopo e evidências](aluno-perfil/TASKS.md)                                             |
| Professores — `/professores`                         | Referência visual existente; agenda recebe aulas de entrada e atendimentos                                                   | Evidências nas verticais relacionadas                                                    |
| Turmas — `/turmas`, `/turmas/[id]`                   | Refinamento visual, docente/horários, vínculos atuais/programados, desempenho agregado e comparação com aluno                | [UI](turmas-ui/VALIDATION.md), [avaliações](assessments/VALIDATION.md)                   |
| Aulas — `/aulas`, `/aulas/[id]`                      | Agenda, conteúdo realizado regular/PPT, chamada, fechamento e correções com histórico                                        | [Validação](class-records/VALIDATION.md)                                                 |
| Presença pública — `/presenca`                       | Link/QR por encontro, identificação, declaração, localização presencial, recibo e revisão docente                            | [Validação](student-attendance/VALIDATION.md)                                            |
| Atendimentos — `/atendimentos`, `/atendimentos/[id]` | Agendamento, cobertura de faltas, realização, correção, remarcação e contatos                                                | [Validação](appointments/VALIDATION.md)                                                  |
| Acompanhamento — `/acompanhamento`                   | Ocorrências relacionadas; intervenções com responsável, acompanhamento, conclusão e reabertura                               | [Validação](occurrences/VALIDATION.md)                                                   |
| Planejamento — `/planejamento`                       | Plano compartilhado regular ou individual PPT, versões e continuidade no mesmo estágio                                       | [Validação](stage-planning/VALIDATION.md)                                                |
| Próximo semestre — `/proximo-semestre`               | Planos de turma, disponibilidade datada, propostas, bloqueios, publicação parcial e retirada justificada                     | [Validação](semester-organization/VALIDATION.md)                                         |
| Avaliações — `/avaliacoes` (professor)               | Dois blocos, recuperação por competência, confirmação pedagógica e correções justificadas                                    | [Validação](assessments/VALIDATION.md)                                                   |
| Leads — `/interessados`, `/interessados/[id]`        | Captura rápida, responsável, próximo passo, contatos, filtros do DS, disponibilidade, aulas de entrada e matrícula explícita | [Comercial](leads/VALIDATION.md), [entrada/matrícula](v3-entrada-alocacao/VALIDATION.md) |
| Visão financeira — `/financeiro`                     | Recharts, recebimentos e indicadores financeiros; fechamentos mensais com gráfico e tabela                                   | [Analytics](analytics/VALIDATION.md), [fechamentos](analytics/CONTRACT-CLOSINGS.md)      |
| Contratos / Recebíveis — `/contratos`, `/recebiveis` | Fluxos financeiros existentes integrados ao perfil e aos eventos importantes                                                 | Revisar junto ao Financeiro                                                              |
| Log de atividades — `/atividades`                    | Timeline com scroll infinito, autoria/data, filtros, busca e contexto expansível                                             | [Validação](activity/VALIDATION.md)                                                      |

## Decisões de domínio a preservar

- **Intervenção** reúne ocorrências que motivam a atuação de um professor. Ocorrências também
  podem se relacionar entre si; não reduzir intervenção a uma ocorrência isolada.
- **Leads** é o nome de produto. A operação comercial é simples: captura, responsável, próximo
  passo datado e contatos. Scoring, automações de mensagens e funil especulativo não foram pedidos.
- Aulas experimentais/introdutórias e comparecimento não criam matrícula automaticamente.
  Conversão é explícita e pode reutilizar aluno existente; menor exige responsável no cadastro.
- Financeiro distingue **dinheiro recebido** de **valor nominal projetado dos contratos fechados
  no mês**. Fechamentos mostram total projetado, mensalidade equivalente e quantidade de contratos.
  A projeção está sujeita a descontos/cancelamento; não é receita garantida. Ciclo completo de
  cancelamento contratual e cálculo de garantia/multa não foram implementados neste recorte.
- Eventos importantes ficam na mesma transação da ação, com data/autoria. O log usa timeline;
  não introduzir Hatchet para gravar esses eventos. Hatchet atende geração de encontros e trabalho
  pesado; payloads mínimos, sem PII de alunos.
- Publicar próximo semestre preserva o vínculo atual até a data efetiva e mantém a tentativa de
  avaliação/plano na continuidade PPT de mesmo estágio. Saída/entrada pareadas são processadas
  juntas, inclusive no limite do lote de 100 ações.

## Seed e último estado observado

O seed oficial completo foi aplicado em **11/10/2026**: 250 alunos, 22 turmas atuais, sete professores,
220 contratos, 61 planos de estágio, 74 snapshots, 87 registros de aula, 89 revisões, 31 declarações,
17 atendimentos e 14 contatos. Há cenários acadêmicos incompletos, suficientes, abaixo do corte e
com recuperação, além de nove coortes mensais de fechamentos.

A organização futura adicionou oito planos de turma e cenários de propostas prontas/bloqueadas,
disponibilidade e publicações. Depois da QA, o último snapshot tinha **250 alunos, 220 contratos,
27 turmas, nove planos futuros, 33 propostas, 13 publicações e 34 confirmações de disponibilidade**.
Esses números são o checkpoint de 11/10, não uma nova contagem feita em 13/10.

A QA deixou um lead Manuela Carvalho Barbosa convertido usando o aluno existente, com entrada
programada para **13/10/2026** em REG 14:00 · 6, uma experimental e duas introdutórias canceladas
ligadas por remarcação. Como essa data chegou, o worker pode ter aplicado a entrada: conferir o
estado atual antes de interpretar diferença da screenshot como regressão. Datas relativas do
seed e estados de atraso também podem mudar com o calendário.

Não reseedar por rotina durante a revisão: isso substitui os registros criados na QA. Se necessário,
usar o comando oficial `pnpm seed` na worktree isolada; não executar o script bruto sobre o banco
existente. O último rebuild substituiu dados de QA anteriores; as evidências antigas são históricas.

## Login Google: diagnóstico pendente de ajuste

Em 12/10 foi identificado que `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão vazios no `.env`
da worktree integrada e configurados no checkout original. O botão continua no código e só aparece
quando o par está configurado. Até este handoff, não houve cópia de credenciais nem alteração nesse
comportamento. Resolver o ambiente local se o usuário pedir; não commitar nem imprimir segredos.

## Evidência e limites

Os arquivos `VALIDATION.md` e screenshots das verticais registram os fluxos efetivamente exercitados,
incluindo desktop/mobile, claro/escuro e permissões administrativas/docentes. Geração de encontros
foi validada com Hatchet real, inclusive falha/retry e idempotência. Os formulários de entrada e de
próximo semestre foram corrigidos e repetidos no browser no fechamento da implementação.

Somente hooks de formatação/whitespace e `git diff --check` foram executados no fechamento.
**Lint, testes, typecheck e build não rodaram localmente.** Há cobertura automatizada escrita;
concorrência, execução futura do worker e demais contratos aguardam CI. Achados conhecidos do CI
antigo do draft #169 foram tratados, mas não há comprovação de CI verde para o HEAD integrado.
Sucesso de GPS real e outras limitações específicas estão discriminados nas validações.

## Student profile review — 2026-10-13

The student page has received the user's selected editorial premium direction in this same
worktree, starting from `0446f1a`. The latest instruction is **desktop only**, with feature work
and visual browser validation; no manual code checks, test suites, lint, typecheck, or build.
The user explicitly requested frontend-design and Impeccable craft, polish, and bolder.

The compact header keeps tabs alongside identity and actions. Contact facts moved into the
overview footer; the complete record opens in a Sheet. Current-stage mean, attendance, stage
metadata, and contextual teaching-plan access are integrated. Appointments and follow-up share
a readable working surface. The decorative gold line below the name was removed.

Assessment copy now uses “Unidade”, with competence badges matching chart colors; Participação
is purple and Oral blue. The graph defaults to a labeled crop of the recorded score range and
offers a full 0–100 scale. Persisted phase identifiers and academic approval rules are unchanged.

Finance now presents received/outstanding money, partial-payment progress, payment punctuality
and recurring delays, discreet contract terms, and an oldest-first overdue action queue. The
complete-situation link opens Recebíveis filtered by student. The summary uses the existing
student-scoped ledger through the finance module; there are no schema changes.

Populated local example: **João Pedro Fontes Azevedo**,
`/alunos/ed109528-32f1-1f06-fb75-381bb3ad838f`. It includes eight current grades, a previous stage,
three appointments, two frequency contacts, occurrences, an active intervention, guardian and
address details, annual tuition, and a six-installment material order illustrating punctual,
late, partial, overdue, and future payments. These are additions to the isolated local database,
not official seed changes. Do not reseed them away during review.

Desktop browser review covered the populated page, finance actions and filters, contact and
assessment forms, empty states, both themes, and 1280/1440/1920 widths. Details, limits, and current
screenshots are recorded in [student profile tasks](aluno-perfil/TASKS.md). This remains an
implementation ready for continued user review, not final visual approval or a CI result.

Continue applying page feedback in the integrated branch and committing incrementally. The
consolidated historical implementation remains in [IMPLEMENTATION.md](IMPLEMENTATION.md).

### Attendance history addition — 2026-10-13

The student attendance metric now opens a complete lesson-history dialog. Enrollment history
also offers access for students without a current enrollment. It includes dates, times, class,
presence, notes, completed makeup minutes, enrollment/status filters, and pagination. The
student-scoped admin read respects enrollment and semester windows, excludes the exit date,
and lists lessons through today's school date. Pending and cancelled calls remain visible
without being counted as absences; only completed makeup coverage contributes to frequency.

João Pedro's populated example shows 30 lessons, 27 presences, two absences, one pending call,
45 compensated minutes, and 95% attendance. Pagination, absence/pending filters, future-enrollment
empty state, and dark/light desktop rendering were exercised. The final 1280 × 800 composition
keeps pagination visible while only lesson rows scroll. Evidence and limits are recorded in
[student profile tasks](aluno-perfil/TASKS.md). The user's no-tests/no-lint instruction remains in
force; normal commit hooks are retained.
