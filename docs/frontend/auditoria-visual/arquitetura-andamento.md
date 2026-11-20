# Andamento do refactor

Base c4d3a924 em padroes-de-interface. Evidência visual anterior em relatorio.html e relacoes-diretoria.md (diretoria e professor da mesma conta, 1440 e 390 px).

1. Identidade. Aluno e turma já usam DetailHeader size=sm. Professor repete cabeçalho, versão de carregamento e CSS de título. As três seções usam Base UI com URL; apenas turma revela a aba selecionada ao redimensionar. Concentrar apresentação/visibilidade; manter estados de edição, abas condicionais e indicadores nos consumidores.
2. Agenda. LessonCalendarSchedule usa ScheduleCalendar; a implementação antiga de faixas só tem consumidores internos e testes. Verificar casos de geometria e hover no pacote UI antes da remoção. Cartões da agenda, permissões, filtros e seleção de intervalo são responsabilidades diferentes.
3. Listas. DataTablePage e DataTable já atendem as listagens. Buscas recriam o ícone, espaçamento e campo. Campos de filtro e links de retorno variam por entidade.
4. Acesso. A mensagem de token inválido é um toast global; a auditoria confirmou intercepção do CTA a 390 px. Rever estado inline e foco. Presença, projeção e documentos serão comparados com seus chamadores.

Próximo marco: migração dos calendários, cabeçalhos e testes focados. As métricas de saldo final serão calculadas no diff da base e contarão separadamente produto, testes e documentação.

## Implementação e evidência intermediária

- As três fichas administrativas passaram a compartilhar título, barra de abas e movimento de troca. A ficha de professor usa DetailHeader também durante carregamento. A navegação guarda etapa bloqueada, seção na URL e ações condicionais nos respectivos domínios.
- A Agenda e o dia acadêmico usam uma seleção exclusiva (aula, atendimento ou visita), um renderer de aula diária e o mesmo roteamento para os diálogos. Cores dos cartões (inclusive os vinculados), semana e filtros remetem a quatro pares semânticos existentes. O cálculo de densidade e a seleção por ponteiro continuam no ScheduleCalendar. Dos 80 pares de clones na captura inicial, 19 ligavam o calendário antigo ao design system, totalizando 412 linhas reportadas nos pares.
- Sete barras de pesquisa usam TableSearch; a linha clicável de alunos, recebíveis agrupados e DataTable compartilham TableActionRow. Os três rodapés simples de formulário usam FormDialogFooter. O fluxo de quatro etapas do aluno conserva sua progressão. Captura móvel de documentos e projeção de presença usam composições compartilhadas. O login apresenta erros no painel e a recuperação sem token é acionável diretamente.
- Validação inicial do agente principal no Orca, na branch local. As três fichas renderizaram título de 24 px e abas de 40 px em 1440 e 390 px, sem overflow horizontal do documento. Links de entrada abriram as seções escolhidas; seta esquerda e Enter mudaram as três. O CSS comum de animação recebeu uma consolidação adicional depois desta verificação.
- Checks concluídos até aqui: pacote UI com 42 testes, 71 testes web de 15 arquivos e typecheck web antes da última consolidação de CSS/imports. Sem mudanças em banco, autorização ou worker.
- Medição parcial do diff (arquivos novos incluídos): produto 1.031 linhas adicionadas e 2.813 removidas; testes +313/−485; docs +21/−0; dependências 8 linhas removidas. Próximos passos são checks das versões finais, validação de navegador dos demais fluxos e relatório.

## Fechamento

- Commit local `11ef682ef95e`, branch `refactor/padroes-de-interface`, base `c4d3a924`. Diff integral e comparação com CSS da base formatado estão ao lado do relatório HTML. Worktree limpo após o commit.
- O diff bruto de produto ficou em +2.207/−3.058. Com o mesmo formatador nas 18 folhas CSS modificadas que já existiam na base, o produto soma +1.025/−2.833. Testes +313/−485, documentação +21/−0 e dependências +0/−8. O total de pares de clones TS/TSX nas duas árvores passou de 80 para 60; os 19 pares entre a implementação web do calendário e a de UI desapareceram.
- Em adição às três fichas, a regressão local verificou busca, URL, estado vazio e rolagem em quatro listas, acesso público e orientações sem token, abertura dos detalhes de semana nas visões administrativa e docente e de aula na agenda acadêmica diária. O relatório discrimina cobertura e limites.
- Última passagem sequencial aprovada em typecheck web, typecheck UI e 71 testes web. O pacote UI passou 42 testes. Lint dos arquivos afetados sem erros (50 avisos web). Passaram os checks de tamanho de componentes, estilos e whitespace. O hook de commit executou o formatador. Relatório estático verificado com 204 referências locais resolvidas. Checks completos do monorepo ficam para PR/CI.
