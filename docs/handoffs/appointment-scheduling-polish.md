# Handoff: polimento do fluxo de agendamento

## Objetivo e workspace

Continuar o modal de agendar/reagendar atendimento, integrando a segunda etapa ao calendário
compartilhado e refinando cada finalidade individualmente. O usuário pausou esse trabalho para
priorizar a extração do calendário para o Design System; essa extração é a entrega anterior.

- Worktree: `/Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica`.
- Branch: `josiasrfreitas/operacao-pedagogica`.
- **Não trabalhar no checkout `/Users/josiasribeiro/orca/lazuli` por engano.**
- Há muitas alterações locais de outros agentes/fluxos. Não resetar, limpar ou commitar tudo.
- Dev: `http://operacao-pedagogica.lazuli.localhost:3004`.
- O usuário dispensou `ship-with-tests`, novos testes e suites pesadas para este fluxo. Ele fará a
  validação visual. Fazer verificações leves e proporcionais; não reiniciar build/typecheck global.
  O Mac já ficou praticamente inutilizável com processos de desenvolvimento consumindo RAM.
- Usar o padrão visual existente e `$impeccable layout`, respeitando o limite de 650 linhas por
  arquivo de componente. Não abrir nova rodada de perguntas sobre decisões já aceitas abaixo.

## Decisões fechadas pelo usuário

1. **Todo agendamento passa por duas etapas**, inclusive horário individual. Remover professor,
   data, início/fim e formato da primeira tela; reaproveitar o espaço para finalidade, contexto,
   faltas e orientações/observações. A segunda tela concentra disponibilidade e horário.
2. A segunda etapa é um calendário, preferencialmente semanal, reaproveitando a Agenda. Suporta
   tanto selecionar uma aula de turma quanto **criar um horário avulso** em espaço livre.
3. O professor da turma atual do aluno fica pré-selecionado. A agenda começa filtrada por ele,
   mas o operador pode trocar. Não restringir apenas à turma do aluno: mostrar os compromissos
   desse professor para evitar disponibilidade falsa.
4. Não permitir atendimento no passado, incluindo horários já iniciados no dia atual. Bloquear
   navegação/seleção pertinentes e validar edição manual. Fuso de negócio: America/Sao_Paulo.
5. Não agendar professor ou aluno em intervalo comprometido. Exibir bloqueio antes de salvar,
   preservando a validação transacional do servidor para concorrência.
6. Para participação em turma, selecionar uma aula válida existente. Para horário individual,
   criar um intervalo e permitir ajustar data, início/fim e formato.
7. **Não mostrar seletor de matrícula PPT.** Considerar automaticamente a matrícula PPT ativa.
   O usuário afirma que, por enquanto, haverá apenas uma; não reintroduzir escolha preventiva.
8. Orientações e observações ficam integradas ao formulário, sem seção escondida/accordion.
9. Campos de data usam calendário; horas têm máscara `hh:mm` em início **e** fim. Já existe
   `TimeField` no código atual e as máscaras foram verificadas anteriormente.
10. Ícones nos botões principais (cancelar, avançar, agendar) e lupa nos campos de busca.
    Não colocar ícones dentro dos switches/segmentos de opções.
11. Evitar campos largos sem necessidade, formato isolado em uma linha, e grandes vazios.
    Usar mais largura horizontal. Idealmente cabe na tela sem rolar o modal; a grade pode precisar
    de rolagem interna para horários legíveis. Manter ações e seleção visíveis.
12. Loading precisa antecipar o layout final, com skeletons localizados e dimensões estáveis.
    Não mostrar agenda carregando como uma semana livre. Erro de consulta bloqueia confirmação.
13. Pensar explicitamente em zero faltas, nenhuma turma/nenhuma aula materializada, sem professor,
    troca de professor, troca de finalidade/tipo, reagendamento e matrícula PPT fora da vigência.

## Calendário compartilhado entregue

Importar `ScheduleCalendar` de `@lazuli/ui`. Visões `day` e `week`, navegação, seletor de data,
cartão padrão ou renderizador customizado, sobreposições, expansão, loading/erro/vazio, seleção de
intervalo com alternativa por teclado e períodos indisponíveis.

- Contrato completo: `docs/frontend/schedule-calendar.md`.
- Tipos: `packages/ui/src/components/schedule-calendar/types.ts`.
- Entrada: `packages/ui/src/components/schedule-calendar.tsx`.
- Storybook: `apps/storybook/src/components/schedule-calendar.stories.tsx`,
  **Components/ScheduleCalendar**.
- A Agenda já consome o componente compartilhado em `class-records/calendar.tsx`, mantendo seus
  cartões e ações de domínio via `renderEvent`. O adaptador `class-records/weekly-calendar.tsx`
  também encaminha para a mesma base.
- `ScheduleCalendarDatePicker` também está no UI; o import antigo em class-records é um reexport.

O componente recebe eventos genéricos (`id`, `date`, `startTime`, `endTime`, `title`, textos/tom)
e estado controlado de navegação. Pode carregar dados extras tipados no evento, sem o UI importar
modelos da API. `rangeSelection` é uma intenção de seleção, não criação/persistência.

**Eventos visíveis e intervalos bloqueados são coleções separadas.** Passar todos os compromissos
relevantes em `rangeSelection.blocked`, inclusive os ocultos por filtros. `getError` recebe regras
síncronas adicionais (aluno, escola fechada etc.). A consulta e a validação definitiva ficam na
feature/API. Para reutilizar os campos mascarados do fluxo, usar `rangeSelection.controls` e
manter uma alternativa de teclado funcional.

O consumidor controla a altura. `density="compact"` é a variante para modal. Não copiar novamente
os motores de layout para appointments. Há helpers antigos ainda no diretório class-records;
o caminho de renderização principal já é o componente do UI.

## Estado real do agendamento ao passar o bastão

**O novo fluxo em duas etapas para todos os tipos ainda não foi implementado.** A tela atual
continua com professor/data/horas/formato na primeira etapa do horário individual. Participação
em turma ainda usa a miniagenda antiga na segunda etapa.

Arquivos principais:

- `apps/web/src/features/appointments/schedule-dialog.tsx`: estado, finalidade/tipo, dados do
  aluno, matrícula PPT automática, mutações e navegação atual `details | class`.
- `class-meeting-step.tsx` e `.module.css`: miniagenda atual, substituí-la pela composição com DS.
- `schedule-dialog.module.css`: grupos compactos, notas lado a lado e limite de altura ampliado.
- `form-fields.tsx`: `MeetingDateField` com máscara e calendário, `MeetingTimeFields` usando
  `TimeField`. A data agora aceita `minDate` opcional.
- `shared/time-field.tsx`: máscara incremental e conclusão de horário no blur.
- `coverage-fields.tsx`: variante compacta, paginação de faltas em duas linhas e loading local.
- `features/shared/task-form.tsx`: `TaskDialog` com `onBack`, `contentClassName`, tamanhos incluindo
  `extra-wide`, ícones de ação; `useValidation.validateFields` para validação parcial da etapa 1.
  Esse arquivo também recebeu alterações concorrentes de outros agentes: preservar.

O professor padrão já vem de `appointments.student.defaultTeacher` e o estado distingue escolha
manual de padrão ainda não carregado. Não sobrescrever uma escolha do usuário em refetch.
A matrícula PPT ativa já é escolhida automaticamente; verificar vigência na data final selecionada.

## Disponibilidade e API

Foi preparado, antes da mudança de foco, o endpoint de leitura
`appointments.availability` em `packages/api/src/appointments/availability.ts`, registrado no
router. **Ainda não está conectado ao modal nem validado funcionalmente com o novo fluxo.**
Revisar e completar essa integração; não tratar como funcionalidade já entregue.

Entrada: professor, aluno, semana e `excludeAppointmentId` opcional. Retorna:

- `classes`: reuniões projetadas do professor, incluindo recorrentes ainda sem sessão criada;
  `sessionId` e `selectable` distinguem participação realmente agendável.
- `teacherBusy`: atendimentos avulsos e experimentais individuais do professor.
- `studentBusy`: aulas vigentes, outros atendimentos e visitas do aluno.
- `closedDays`: fechamentos e motivo.

Reutiliza `teachers/schedule.ts::meetingsBetween`, que reconcilia aulas materializadas e projeções
recorrentes. É essencial: uma consulta apenas a classSession pode mostrar horários falsamente
livres quando as aulas ainda não foram preparadas. Não fabricar fixtures nem dados de alunos.

`appointments/destinations` já aceita um intervalo de até sete dias, mas retorna somente sessões
existentes. A geração de sessões passa pelo worker; se precisar expor preparo/retry, reutilizar
`class-records/generation-notice.tsx` e o fluxo de geração, não executar trabalho pesado inline.

A proteção final já existe em `appointments/scheduling.ts`:

- rejeita início passado, escola fechada, professor inelegível e matrícula PPT fora da vigência;
- horário individual usa `assertNoTeacherConflict`, incluindo turmas projetadas, experimentais
  e atendimentos; aluno também é validado contra aulas, atendimentos e visitas;
- participação usa a aula existente e professor responsável;
- reagendamento cancela o anterior e agenda o substituto na mesma transação. A leitura de
  disponibilidade deve excluir o atendimento anterior para não bloquear o próprio intervalo.

## Próxima implementação sugerida

1. Estado único da seleção (professor, data, horas, formato, sessão) preservado ao voltar.
2. Etapa 1 valida apenas contexto/finalidade/faltas/notas/motivo; CTA “Selecionar horário”.
3. Etapa 2 consulta disponibilidade da semana/professor/aluno; não confirmar enquanto carrega
   ou falha. Preselecionar professor e permitir troca explícita, limpando/revalidando seleção.
4. Adaptar resposta para os eventos e bloqueios do `ScheduleCalendar`. Em participação, ativar
   apenas sessões futuras elegíveis; no individual, seleção de espaço livre gera um rascunho.
5. Faixa de resumo/edição compacta: data, início/fim mascarados e formato; detalhes finais sempre
   próximos do botão Agendar. Datas e professor precisam refletir a aula selecionada.
6. Validar todos os estados abaixo antes de devolver ao usuário.

## Aceite funcional para a próxima etapa

- Reposição com faltas e sem faltas; PPT ativo e sem matrícula; reforço; avaliação.
- Individual e participação, avançar/voltar sem perder contexto; reagendamento com motivo.
- Professor padrão correto; trocar/limpar professor; atraso/erro na consulta; semana vazia.
- Mesmo dia: intervalo passado bloqueado, intervalo futuro permitido.
- Conflito no início, fim e meio do intervalo; intervalos adjacentes permitidos.
- Compromisso do aluno com outro professor; experimental; turma projetada não materializada;
  fechamento; refetch e mudança concorrente entre seleção e salvar.
- Validação de teclado/manualmente digitado igual à seleção por ponteiro.
- Desktop de 1366×768 e largura estreita: ações visíveis, nenhum campo esticado sem razão,
  loading com o mesmo espaço, sem rolagem horizontal da página (grade pode rolar internamente).

Não prometer que esse aceite já foi executado no modal: pertence ao trabalho que está sendo
transferido. A extração do calendário foi verificada isoladamente e na Agenda, sem criar
agendamentos nem modificar registros de aluno.

## Evidência da entrega do calendário

- Typecheck de `@lazuli/ui` e `@lazuli/storybook` passou; lint dos novos componentes também.
- Prettier, `git diff --check` e detector de layout passaram.
- Browser: Agenda diária com dados reais; Storybook semanal/diário; intervalo ocupado 09:00–10:00
  recusado com motivo; intervalo livre 11:00–12:00 selecionado; loading sem eventos selecionáveis;
  `+Mais` expandiu sete eventos sobrepostos.
- Largura de 390 px: página permaneceu com 390 px; grade rolou internamente (640 px).
- Não foram executadas suites automatizadas, build global ou typecheck integral do web, conforme
  a orientação de manter esta tarefa leve. A API de disponibilidade pendente precisa de sua
  própria validação na integração do próximo agente.
