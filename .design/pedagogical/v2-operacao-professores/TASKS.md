# V2 — Professores, semana de aulas e cobertura docente

Issue: [#158](https://github.com/josiasrfreitas/lazuli/issues/158).
Épico: [#156](https://github.com/josiasrfreitas/lazuli/issues/156).
Fonte: [brief](DESIGN_BRIEF.md), [arquitetura da informação](INFORMATION_ARCHITECTURE.md),
[referência de tokens](DESIGN_TOKENS.md) e decisões desta conversa.

Uma única issue de implementação, com três entregas verticais sequenciais e valor operacional
visível. Cada entrega reúne interface, regras, persistência, autorização e validação. Não criar
issues separadas para banco, API, componentes ou testes. A issue só termina com as três entregas
concluídas; nenhuma caixa é marcada apenas por existir documentação ou um endpoint.

## Valor para a escola

| Entrega                                      | O que a administração passa a conseguir fazer                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. Cadastrar e consultar a semana            | Cadastrar quem trabalha na escola, atribuir turmas mesmo sem login e enxergar a carga semanal em horas-aula.      |
| 2. Cobrir uma aula                           | Escolher um substituto sem choque de horário, preservando o docente da turma e vendo o efeito na semana de ambos. |
| 3. Preparar uma saída e recompor a cobertura | Programar a saída, encontrar compromissos que ficaram sem docente e resolvê-los na turma ou no encontro.          |

## Decisões comuns

- Administração opera `/professores` → `/professores/[id]`. UI em PT-BR e dia de negócio em
  America/Sao_Paulo. Listas, grade e diálogos seguem os padrões compactos do Lazuli.
- Cadastro: nome, CPF e e-mail. Acesso ao sistema é opt-in, inicialmente desmarcado, independente
  da elegibilidade operacional. Professor sem login pode receber turmas e substituições.
- Não registrar disponibilidade ou acordos de horários. Coincidência de compromissos bloqueia
  atribuição; carga semanal é informativa, sem teto individual impeditivo.
- Hora-aula é uma unidade de 60 minutos. Uma turma de terça/quinta, uma hora por dia, e outra
  de sábado, duas horas seguidas, somam duas horas-aula semanais cada. A grade delimita unidades
  e turmas sem fragmentar um encontro de duas horas em dois registros de aula/chamada.
- Total da semana selecionada exclui cancelados, desconta o encontro do substituído e soma ao
  substituto. Referência visual de uma exceção não deve entrar duas vezes no cálculo.
- Substituição pertence ao encontro; troca permanente pertence à operação da turma, com vigência
  hoje ou futura. Encerramento de atuação também pode ocorrer hoje ou no futuro.
- A saída não exige redistribuição prévia e não cancela compromissos. Pendências de docente ficam
  reunidas na lista de Professores, com caminho para resolver na turma ou no encontro.
- Na data efetiva da saída, bloquear o login. Ao programá-la, desfazer substituições futuras
  ligadas aos encontros do professor que sai, preservando registro/autoria e exigindo nova
  atribuição mesmo quando o substituto continua elegível.
- Preservar responsabilidade e autoria históricas. Não conceder novas permissões ao substituto:
  sua experiência e acesso às aulas permanecem em entrega posterior.

## Contrato de reutilização da interface

Antes de criar cada componente, conferir os exports de `packages/ui/src/index.ts`, os usos em
`apps/web/src/features/`, as histórias em `apps/storybook/src/` e o código atualizado da V1.
Reutilizar os componentes abaixo. Se faltar um comportamento, ampliar a API existente de forma
restrita e cobrir seu contrato; a feature nova deve compor esses componentes. Uma cópia local
de tabela, filtro, diálogo, campo, seleção ou estado visual não atende a esta issue.

- **Lista de professores e pendências:** usar `DataTablePage` e `DataTable` de `@lazuli/ui`
  (`packages/ui/src/components/data-table-page.tsx` e `data-table.tsx`). A página fornece colunas
  e dados; `DataTable` já cuida de frame, rolagem, skeleton, vazio, erro, retry e paginação.
- **Busca e filtros:** usar `Input`, `TableFilters` e `TableFilterChips` de `@lazuli/ui`, com
  `useUrlPagination` e `tablePaginationPropsFor` de `apps/web/src/lib/pagination.ts`. Compor a
  toolbar e o estado da URL sem novos primitives de filtro ou paginação.
- **Formulários e confirmações:** usar `Dialog`, `DialogContent`, `DialogHeader`, `DialogBody`,
  `DialogFooter`, `DialogTitle`, `DialogDescription` e `Button` de `@lazuli/ui`
  (`packages/ui/src/components/dialog.tsx`). Seguir
  `apps/storybook/src/patterns/dense-form.stories.tsx` e `docs/frontend/forms.md`.
- **Campos e vigência:** usar `FormSection`, `FormRow`, `Field`, `Label`, `FieldError`, `Input` e
  `Switch` de `@lazuli/ui`; acesso opt-in usa `Switch`. Datas usam texto com `maskDateBR` e
  `parseDateBR` de `apps/web/src/lib/masks.ts`, sem calendário nativo ou máscara duplicada.
- **CPF obrigatório:** verificar `PersonDocumentField` em
  `apps/web/src/components/person-document-field.tsx` e `detectPersonDocument` em
  `packages/validators/src/person-document.ts`. O campo atual aceita CPF/RG opcional. Adaptar o
  existente para CPF obrigatório ou compor os primitives acima; não usá-lo sem adaptação nem
  copiar a regra de validação do CPF.
- **Escolha do substituto:** usar `SearchSelect` de
  `packages/ui/src/components/search-select.tsx`. Como ele sempre oferece “Cadastrar novo”,
  ampliar seu contrato para permitir seleção sem criação, mantendo os usos atuais. Não criar
  outro combobox.
- **Situações e avisos:** usar `Badge`, `Alert`, `EmptyState` e `InlineSkeleton` de `@lazuli/ui`
  para acesso, saída, conflito e grade vazia. Na lista, deixar `DataTable` apresentar seus
  próprios estados.
- **Shell e navegação:** usar `AppShell`, `SidebarNav`, `MobileNavigation` e `nav-items.ts` em
  `apps/web/src/components/app-shell/`. Estender o registro de navegação para Professores sem
  criar outro shell, breadcrumb ou menu móvel.

A composição **nova** da V2 é a grade semanal com blocos de turma/hora-aula e seus diálogos
específicos. Antes de adicionar qualquer componente compartilhado, registrar no PR qual contrato
dos existentes não atende ao caso e mostrar a necessidade com a tela/estado real. Verificar no
diff final que nenhum componente novo repete o papel dos componentes listados acima.

## Entregas verticais

- [ ] **1. Administração cadastra professores e consulta suas turmas na semana.** Entregar lista
      com busca/filtros/paginação, cadastro e edição de nome/CPF/e-mail, controle explícito de acesso
      e página individual com grade semanal e turmas. Integrar a seleção de professores na criação
      de turma da V1. _Dependência: tela e operação de criação/consulta da turma entregues no slice 1
      da #157; não depende das demais movimentações de alunos._

  **Resultado demonstrável:** cadastrar uma pessoa com login desabilitado, atribuí-la a uma turma
  em Turmas e abrir sua semana. Uma turma com duas recorrências de uma hora aparece em dois dias;
  uma turma com encontro de duas horas aparece num grupo com duas unidades. Recarregar mantém
  o cadastro, a atribuição e a carga correta.

  **Aceite:** nome, CPF e e-mail são validados; duplicidade é tratada sem criar outra identidade
  nem converter silenciosamente papéis de contas existentes. Habilitar/bloquear acesso não cria
  outra pessoa nem remove suas turmas. Professor operacionalmente ativo e sem login aparece nas
  opções de turma, mas não acessa o sistema. Grade e total usam a mesma semana/calendário e não
  dependem de sessões já geradas para revelar compromissos previstos. Feriados, cancelamentos
  existentes e encontros materializados não produzem horas fantasmas ou duplicadas. As mutações
  que atribuem professor conferem sobreposição de compromissos no período aplicável, também sob
  concorrência; horários consecutivos sem sobreposição não são conflito. Identificar a turma e
  o intervalo que impedem salvar. Não modificar retroativamente as atribuições existentes.

  **Experiência e implementação:** aplicar o contrato de reutilização acima para lista,
  filtros, paginação, cadastro, CPF, acesso e estados; criar apenas as composições próprias de
  professores e da semana em `apps/web`. Estender `nav-items.ts` para navegação administrativa.
  Reaproveitar a identidade existente e acrescentar os dados/estado operacional necessários;
  separar a elegibilidade hoje acoplada a `User.isEnabled` da autorização de login. Criar consultas
  e comandos administrativos e integrar as opções/guards de `packages/api/src/classes` com V1,
  incluindo caminhos existentes que atribuem professores, como clonagem. Reutilizar calendário,
  recorrências e fronteira de geração de sessões. Migrações são incrementais; não editar aplicadas.

  **Verificação:** testes proporcionais de cadastro, opt-in e autorização, identidade existente,
  persistência, projeção semanal e conflitos concorrentes. Usar exemplos com totais calculados à
  mão, como dois encontros de 60 minutos versus um de 120. Integração comprova a atribuição real
  de professor sem login; transporte comprova bloqueio de acesso e proteção administrativa.
  Contratos dos formulários e jornada no navegador em desktop/tela estreita verificam teclado,
  agrupamento das horas, estados de carregamento/erro/vazio e retorno mantendo semana/filtros.

- [ ] **2. Administração registra um substituto para uma aula e vê a carga ajustada.** A partir
      da grade, abrir o encontro e registrar o substituto sem alterar o docente habitual da turma.
      Mostrar a exceção nas consultas dos dois professores e atualizar os totais semanais.
      _Dependência: entrega 1._

  **Resultado demonstrável:** numa turma de terça/quinta, substituir somente quinta. O habitual
  permanece na turma e na terça; a quinta aparece como substituição e conta para o substituto.
  Tentar um substituto ocupado no mesmo intervalo retorna conflito sem gravar a alteração.

  **Aceite:** seleção considera atuação na data, independentemente do login. Validar o intervalo
  inteiro de um encontro de duas horas, incluindo sobreposição parcial; não exigir substituir
  cada hora separadamente. O vínculo da substituição é estável e não se duplica com geração de
  sessões, reenvio ou concorrência. Registrar autor/data, preservar autoria de fatos já existentes
  e manter o docente habitual. Na consulta do substituído, a exceção visível não soma sua carga;
  no substituto, conta uma vez. A nova relação não concede acesso à chamada ou ao histórico.
  Ações retroativas e alterações em aulas já registradas não são habilitadas por inferência.

  **Experiência e implementação:** compor detalhe do encontro e formulário de substituição com
  `Dialog`, `SearchSelect` adaptado para seleção sem criação, `Alert` e demais campos já
  inventariados; reutilizar a grade da entrega 1. Acrescentar responsabilidade por encontro e
  comando transacional. A autoria da frequência não representa o professor responsável pelo
  encontro. Evoluir a mesma conferência de conflitos e as
  consultas semanais. Conciliar recorrências previstas e sessões materializadas sem gerar aulas
  pesadamente na requisição. Inspecionar consumidores de `class.teacherId` para evitar alteração
  acidental de escopo ou atribuição histórica.

  **Verificação:** integração de substituição → recarga das duas semanas, total antes/depois,
  geração posterior sem duplicidade, professor sem login, sobreposição parcial e duas tentativas
  concorrentes para o mesmo docente/intervalo. Transporte demonstra autorização administrativa e
  ausência de ampliação de acesso docente. Navegador e contrato do formulário demonstram contexto,
  erro recuperável, foco e identificação do encontro inteiro em desktop/tela estreita.

- [ ] **3. Administração programa uma saída e resolve os compromissos sem professor.** Entregar
      encerramento hoje/futuro com prévia de impactos, pendências na lista de Professores e resolução
      no encontro ou na turma. Na manutenção da turma, incluir troca permanente com data de vigência,
      preservando o passado. _Dependência: entregas 1–2._

  **Resultado demonstrável:** programar uma saída para a próxima semana, ver a atuação atual
  preservada e os compromissos futuros que precisam de cobertura. A prévia mostra substituições
  futuras que serão desfeitas, inclusive quando o substituto segue ativo. Atribuir novo docente
  a uma turma a partir daquela data reduz as pendências. Cobrir apenas um encontro resolve esse
  encontro, deixando os demais descobertos visíveis.

  **Aceite:** permitir confirmar saída sem redistribuição completa. Respeitar a data efetiva
  nas opções de professor, grade, carga, responsabilidade habitual e substituições. Mostrar
  pendências futuras assim que a saída for programada, identificando sua vigência. Não cancelar
  aulas, apagar professor ou reatribuir silenciosamente encontros anteriores. Troca permanente
  iniciada na página da turma preserva o responsável de cada período; conflitos bloqueiam nova
  atribuição e não são resolvidos apenas no frontend. Inativos e históricos continuam encontráveis.
  Bloquear o acesso na data efetiva, sem bloqueá-lo antes. Ao programar a saída, desfazer
  substituições futuras vinculadas aos seus encontros, preservar o registro/autoria anterior e
  sinalizar cada encontro para nova cobertura; não contar a atribuição desfeita na semana do
  substituto. Se a saída for do próprio substituto, o encontro também volta a exigir cobertura.
  Repetição, alteração concorrente após a prévia ou falha não deixam estado parcialmente aplicado.

  **Experiência e implementação:** compor a relação de pendências com `DataTable`, a prévia de
  saída com `Dialog` e `Alert`, e a troca de docente com os campos e `SearchSelect` existentes;
  reutilizar a grade e a validação de conflito. Criar os fluxos específicos de encerramento e
  troca com vigência no contexto da turma de V1. Persistir atuação e responsabilidade temporal com
  autoria, sem assumir que um único `Class.teacherId` representa todo o histórico ou a ausência
  futura. Atualizar consumidores de atribuição de modo consistente; preservar identificação do
  autor de frequência. A efetividade das datas precisa funcionar mesmo sem um job ter rodado;
  trabalho pesado/agendado, se necessário, usa worker idempotente com payload mínimo.

  **Verificação:** integração de saída hoje/futura, troca permanente e cobertura pontual,
  responsabilidades antes/depois da vigência, pendências resolvidas parcialmente e conservação
  de aulas/frequência anteriores. Testar fronteira do dia em America/Sao_Paulo, prévia desatualizada,
  conflitos e rollback. Cobrir acesso antes/depois da saída, substituições futuras desfeitas,
  carga do antigo substituto recalculada e preservação das substituições passadas.
  Transporte, contrato dos formulários e jornada no navegador demonstram saída → pendências →
  resolução, incluindo consulta do histórico e layout estreito.

## Integração com V1 e limites

A consulta remota não encontrou PR aberto de V1. A branch local `josiasrfreitas/issue-157`
consultada ainda aponta para `0d47d90`, sem novos commits em relação à base. Isso não informa o
estado de alterações não commitadas da outra frente. Reconsultar sua implementação antes de
alterar relações ou opções; não tratar o contrato como já integrado nem editar seu trabalho.

V1 entrega criação/consulta e manutenção básica de turmas, usando inicialmente professores já
habilitados. V2 entrega cadastro, elegibilidade independente de login, conflito docente,
responsabilidade temporal e substituição. A troca permanente fica na página da turma, mas sua
regra temporal e a resolução da saída são responsabilidade desta issue. V2 não reimplementa
matrícula, pausa, retorno ou saída de alunos; não depende de concluir os quatro slices de V1.

Introduções e atendimentos permanecem em V3/V6. Esses compromissos deverão usar a conferência de
conflitos ao serem entregues; não criar agora suas telas ou modelos apenas como antecipação.
Não implementar disponibilidade, redistribuição em massa, horas realizadas, remuneração,
experiência docente, acesso do substituto, substituição parcial, correção retroativa, reativação
ou cancelamento de saída programada sem definição adicional. Não criar plataforma geral de auditoria.

## Regras fechadas para a entrega 3

O usuário escolheu bloquear acesso na data efetiva da saída e desfazer substituições futuras
já atribuídas em lugar do professor que sai, mesmo se o substituto ainda estiver em atuação.
Mostrar esse efeito na prévia e preservar a atribuição anterior como histórico, sem cobertura
vigente ou horas previstas indevidas. Se quem sai é o próprio substituto, o encontro também
volta à avaliação de cobertura. Não refazer as substituições automaticamente.

## Critério comum de conclusão

Cada entrega é utilizável no app com persistência real, autorização de servidor, autoria/data,
estados de erro e verificação proporcional. Reutilizar os tokens atuais; componentes têm no
máximo 200 linhas. Seguir `ship-with-tests`, `docs/testing/README.md` e `docs/frontend/README.md`
na implementação, com unitários para regras puras, integração para persistência/concorrência e
transporte para o que o adaptador acrescenta. Não duplicar testes entre camadas sem evidência nova.

Validar a jornada real em desktop e largura estreita, incluindo teclado, foco, largura dos
campos, alinhamento da grade e divisores de hora-aula. Executar checks proporcionais e
`git diff --check`; inspecionar o diff completo. Browser funcional não equivale a aceite visual.
Na revisão do diff, conferir a lista de componentes novos contra o inventário acima e justificar
cada extensão compartilhada; rejeitar duplicação de componente existente.
Revisão de design completa é separada, sob pedido; não abrir tarefa de revisão automática.

Planejamento e criação da issue não autorizam iniciar a construção nesta conversa.
