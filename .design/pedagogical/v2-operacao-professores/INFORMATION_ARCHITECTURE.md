# Information Architecture: V2 — Operação de professores

Base: [DESIGN_BRIEF.md](DESIGN_BRIEF.md). Estrutura confirmada pelo usuário: lista de
professores → página do professor com grade semanal; substituições no contexto do encontro.
Este documento define navegação e hierarquia, sem representar aceite da composição visual.

## Mapa e navegação

- Pedagógico, no AppShell existente
  - Professores: `/professores`
    - Professor: `/professores/[id]`
  - Turmas: `/turmas`, entregue pela V1
    - Turma: `/turmas/[id]`, contexto de associação e troca do docente habitual

Adicionar uma entrada Professores para os papéis administrativos autorizados no servidor,
seguindo ADMIN/SYSTEM_ADMIN. O cadastro de um professor não lhe concede entrada nesta área.
Manter navegação utilitária, Sidebar e MobileNavigation existentes. A página individual tem
link Voltar para Professores; links de turma apontam para a página entregue pela V1.

Cadastro, edição, acesso, substituição e encerramento usam diálogos no contexto da operação.
Não criar rotas por ação nem um segundo menu para a semana. A navegação tem dois níveis:
encontrar a pessoa e operar em seu contexto. Não adicionar abas de frequência, notas ou planos.

## Hierarquia de conteúdo

### Lista de professores

1. Título Professores e ação principal Novo professor.
2. Busca e filtros de atuação e acesso, próximos à tabela. Proposta: iniciar com professores
   em atuação; filtro permite encontrar também inativos e saídas programadas.
3. Tabela com nome, e-mail, situação de atuação e situação de acesso. Saída programada inclui
   sua data, sem apresentar a pessoa como já inativa. Nome é link real para a página individual.
4. Paginação e contagem pertencem ao frame de DataTable. CPF fica no cadastro/detalhe, sem
   competir com a identificação operacional na listagem.

Não colocar carga de semanas diferentes numa tabela sem um período explícito. A consulta da
semana fica na página do professor; a lista serve para localizar pessoas e distinguir estados.

**Localização confirmada:** quando houver compromissos sem docente, exibir nesta página um
resumo compacto Pendências de docente, com ação Ver pendências de menor ênfase que Novo professor.
Ela expande uma relação paginada na própria página, sem rota nova ou painel aberto por padrão.
Os itens identificam turma, vigência e encontros afetados, com caminho para resolver na turma
ou no encontro. Separar problemas de atribuição habitual de uma substituição sem responsável.

### Página do professor

1. Voltar para Professores, nome e situação de atuação. Dados cadastrais e acesso ficam num
   grupo compacto de informação secundária; ações Editar cadastro e Gerenciar acesso têm
   menor ênfase. Encerrar atuação fica em menu contextual com confirmação própria.
2. Navegação de semana: intervalo de datas, Anterior, Próxima e Semana atual. A semana inicial
   é a que contém o dia de negócio em America/Sao_Paulo; proposta de intervalo de segunda a domingo.
3. Carga prevista, com unidade e período explícitos, seguida da grade como conteúdo principal.
4. Relação compacta de turmas do período com links para abrir cada turma e consultar sua
   atribuição. Deve permitir encontrar a turma mesmo numa semana sem encontro por calendário.
5. Quando aplicável, aviso de saída programada e sua vigência, com acesso aos compromissos
   afetados. O aviso não substitui a grade nem esconde o estado atual.

A página é prioritariamente de consulta: não precisa de um botão primário artificial no topo.
Ao abrir um encontro, a ação administrativa pertinente assume o destaque naquele contexto.

### Semana e blocos de hora-aula

No desktop, a proposta é dias em colunas e horários num eixo vertical comum. Mostrar apenas
uma semana por vez, com janela que comporte seus compromissos; evitar uma grade de 24 horas
majoritariamente vazia. Identificar datas e dias explicitamente, incluindo sábado e domingo.

Cada encontro contém identificação da turma, início/fim e delimitadores das unidades de
60 minutos. Duas horas consecutivas da mesma turma formam um grupo reconhecível, com divisor
interno e uma única operação para abrir o encontro. Cor é apoio; borda, agrupamento e texto
tornam a turma identificável. Não usar drag-and-drop para editar horários ou redistribuir aulas.

Substituição informa quem assume e quem é substituído. Na consulta do substituído, manter a
referência visível como exceção para explicar a mudança; no substituto, mostrar o compromisso
assumido. Uma referência visual não deve ser confundida com duas responsabilidades simultâneas.

**Totalização confirmada:** Horas-aula previstas na semana soma os compromissos
atribuídos à pessoa naquela semana, considerando a vigência, excluindo cancelados, descontando
encontros cedidos a substitutos e incluindo substituições assumidas. O total não mede presença
nem comprova realização; a divisão visual e o cálculo usam a duração do mesmo encontro.

Exemplo: duas horas habituais, sendo uma delas coberta por outra pessoa, resultam em
uma hora-aula prevista para o habitual e uma hora-aula adicional para o substituto. A exceção
continua identificável nas duas consultas; não somar a mesma aula duas vezes para a mesma pessoa.

Em semanas passadas, a consulta preserva a responsabilidade daquele período. Não recalcular
quem era o professor a partir do docente atual da turma. Feriados, cancelamentos e geração
de encontros precisam usar as mesmas regras de calendário da operação de turmas.

### Detalhe contextual do encontro

Um diálogo identifica turma, data, intervalo completo, quantidade de horas-aula, docente
habitual e responsável pelo encontro quando diferente. Ação principal Registrar substituição
aparece quando a operação é elegível; Abrir turma é secundária. Selecionar o substituto mantém
esse resumo visível e apresenta conflitos no mesmo formulário.

Uma aula passada, cancelada ou com registros não recebe uma ação de correção retroativa por
inferência. Os limites de alteração de substituições já registradas devem ser definidos antes
de habilitar esses caminhos. A V2 não abre uma experiência de chamada ou conteúdo docente.

## Fluxos

### Encontrar e cadastrar

1. Administração acessa Professores, busca pelo cadastro e abre uma pessoa existente ou Novo professor.
2. O formulário apresenta nome, CPF e e-mail, agrupados de forma compacta. A opção Habilitar
   acesso ao sistema começa desmarcada, acompanhada da informação de que a pessoa pode receber
   turmas mesmo sem acesso.
3. Validação indica erros nos campos e conserva valores. Tratar identidade já cadastrada sem
   criar silenciosamente outra pessoa ou converter o papel de uma conta existente.
4. Sucesso abre a página do professor. Sem atribuições, a semana mostra Nenhum compromisso
   nesta semana. A indicação de acesso corresponde à opção efetivamente persistida.

Esse fluxo não envia convites automaticamente nem modifica o mecanismo de autenticação aceito.
Habilitar acesso autoriza a identidade no mecanismo existente; a experiência docente permanece
fora desta vertical.

### Consultar a semana e abrir a turma

1. Abrir professor a partir da lista ou por URL direta.
2. Consultar o intervalo, a carga prevista e os blocos; trocar a semana sem perder a pessoa.
3. Abrir um compromisso para consultar sua responsabilidade ou usar o link da turma.
4. Associação ou troca permanente ocorre na operação de turma, com vigência explícita.
5. Ao voltar, conservar semana e filtros anteriores quando houver esse contexto; entrada
   direta tem retorno seguro à lista padrão.

### Registrar substituição

1. Abrir um encontro na grade e escolher Registrar substituição.
2. Selecionar professor elegível na data. Acesso ao sistema não é condição de elegibilidade.
3. Servidor confere conflito no intervalo completo do encontro, inclusive contra recorrências
   ainda sem sessões materializadas. Horários e turma que impedem a operação ficam identificados.
4. Sem conflito, confirmar a substituição com autoria e data; atualizar a grade e suas consultas
   relacionadas. Não alterar o habitual da turma nem conceder acesso docente ao substituto.
5. Se outra pessoa mudou o encontro ou suas atribuições, explicar a alteração e reavaliar o
   estado; uma seleção antiga não garante que a confirmação ainda seja válida.

### Encerrar atuação

1. Menu do professor → Encerrar atuação → informar hoje ou data futura.
2. Mostrar data efetiva, turmas, compromissos afetados e substituições futuras que serão
   desfeitas, explicando quais encontros exigirão nova atribuição.
3. Confirmar sem exigir redistribuição prévia. Substituições futuras ligadas aos encontros do
   docente que sai são desfeitas ao programar a saída; os encontros entram nas pendências.
   A consulta diferencia saída programada de atuação já encerrada e conserva compromissos,
   substituições e responsáveis do passado. O login é bloqueado na data efetiva.
4. Expor os compromissos que requerem cobertura, permitindo abrir a turma ou o encontro.
   Nova atribuição reavalia a elegibilidade do docente e os conflitos naquele período.

O gerenciamento de acesso continua independente da atuação durante o cadastro. A saída, porém,
tem o efeito confirmado de bloquear o login na data efetiva; bloquear login manualmente não
retira turmas. A prévia de saída identifica substituições futuras afetadas. Guardar o histórico
dessas atribuições desfeitas com autoria, sem apresentá-las como cobertura vigente.

### Resolver pendências de docente

1. Na lista de Professores, abrir Pendências de docente.
2. Encontrar turma ou encontro afetado e sua vigência; substituições desfeitas pela saída
   aparecem como pendência até receberem uma nova atribuição.
3. Para responsabilidade habitual, abrir a turma e atribuir docente com data efetiva. Para
   cobertura pontual, abrir o encontro e informar responsável conforme o contrato de substituição.
4. Após resolver, atualizar a relação. Cobrir um encontro não resolve automaticamente todos
   os outros compromissos da turma.

Nova cobertura pontual após a saída precisa respeitar o contrato de responsabilidade histórica;
esta navegação não decide uma nova estrutura de dados.

## Estados e recuperação

| Situação                                | Experiência                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| Consulta inicial em andamento           | Estrutura de carregamento; não mostrar semana vazia antes da resposta.                 |
| Troca de semana em andamento            | Indicar carregamento do novo período, sem rotular a grade anterior com as novas datas. |
| Falha de consulta                       | Tentar novamente preserva pessoa, semana e filtros.                                    |
| Nenhum professor / filtro sem resultado | Distinguir cadastro vazio de busca sem correspondência.                                |
| Nenhum compromisso na semana            | Vazio contextual, com navegação de semana e acesso às turmas quando existirem.         |
| Sem acesso ao sistema                   | Estado informativo; não bloquear atribuições por esse motivo.                          |
| Saída programada                        | Exibir data futura e impactos; manter indicação de atuação atual.                      |
| Atuação encerrada                       | Cadastro e histórico consultáveis; novas atribuições respeitam a vigência.             |
| Conflito de horário                     | Bloquear escrita, identificar compromissos e permitir escolher outro professor.        |
| Identidade já cadastrada                | Explicar conflito de cadastro e permitir localizar/corrigir sem duplicar pessoa.       |
| Professor inexistente / acesso negado   | Estado específico; não trocar silenciosamente por outro cadastro.                      |
| Falha ao salvar / concorrência          | Manter valores, mostrar erro e atualizar dados necessários antes de repetir.           |

## Vocabulário de interface

| Conceito                    | Rótulo                         | Observação                                       |
| --------------------------- | ------------------------------ | ------------------------------------------------ |
| Professor                   | Professor / Professores        | Mesmo termo na navegação, cadastro e seleção.    |
| Atuação                     | Em atuação / Atuação encerrada | Independente de acesso ao sistema.               |
| Encerramento futuro         | Saída programada               | Sempre acompanhado de data efetiva.              |
| Acesso                      | Habilitado / Não habilitado    | Dentro do contexto Acesso ao sistema.            |
| Responsável habitual        | Docente da turma               | Vigência vem da atribuição na turma.             |
| Responsável pontual         | Substituto / Substituição      | Vinculado a um encontro identificado.            |
| Teaching Hour               | Hora-aula / Horas-aula         | Unidade de 60 minutos; não sinônimo de encontro. |
| Carga prevista              | Horas-aula previstas na semana | Total ajustado ao período.                       |
| Compromisso sem responsável | Sem professor                  | Pendências de docente agrupa a consulta.         |

## Reutilização, responsividade e crescimento

| Componente                           | Uso                                           | Comportamento                                            |
| ------------------------------------ | --------------------------------------------- | -------------------------------------------------------- |
| AppShell e navegações existentes     | Lista e página do professor                   | Mesma autorização e navegação móvel do produto.          |
| DataTablePage, DataTable e paginação | Lista, turmas e pendências                    | Dados remotos, filtros e estados consistentes.           |
| Dialog e primitives de formulário    | Cadastro, substituição, acesso e encerramento | Um formulário por contexto e foco restaurado ao fechar.  |
| Composição semanal da feature        | Página do professor                           | Mesmos compromissos e totais em desktop e tela estreita. |

Proposta para largura estreita: dias em sequência vertical, preservando intervalos e agrupamentos
por turma; o controle da semana permanece no topo. Reduzir a quantidade de colunas visíveis
não pode ocultar compromissos. Foco e ordem de leitura acompanham dia/horário; um encontro de
duas horas continua um único alvo de interação, com os divisores internos descritivos.

Paginar professores, turmas e pendências no servidor; a semana limita o conjunto de compromissos
consultados. Inativos e históricos crescem sem sobrecarregar a consulta inicial. Não carregar
todas as semanas nem expandir recorrências sem limite no cliente. Histórico completo de alterações
e relatórios de horas ficam fora desta estrutura.

Validar desktop e largura estreita, teclado, foco, contraste, ausência de overflow, alinhamento
temporal e clareza dos divisores na construção. Não há protótipo ou validação visual concluída.

## URLs e estado de navegação

IDs estáveis identificam professores e turmas nos segmentos da rota; não usar nome, CPF ou
e-mail como identificador de navegação. Busca por nome e filtros seguem o padrão existente
com nuqs; não criar parâmetros para CPF/e-mail nem serializar o cadastro na URL. Usar query
tipada e validar valores recebidos.

- `/professores`: busca, situação de atuação, acesso e paginação. Proposta de parâmetros:
  `busca`, `atuacao`, `acesso`, `pagina`, `porPagina`.
- `/professores/[id]?semana=YYYY-MM-DD`: proposta de data âncora normalizada para o início
  da semana no calendário de negócio. Ausência de parâmetro abre a semana atual.
- `/turmas/[id]`: rota da V1; navegação não exige que a listagem esteja montada.

Formulários são estado local; não colocar dados preenchidos ou permissões na URL. A expansão
de pendências pode usar query `pendencias=docente` para preservar o contexto.
Retorno usa navegação interna ou estado conhecido, sem aceitar destino externo arbitrário.

## Estado da etapa

Navegação lista → página do professor e grade semanal confirmadas. O usuário aceitou as
recomendações do lote seguinte: total da semana ajustado pelas substituições, excluindo cancelados,
e pendências reunidas na lista de Professores. Composição responsiva, agrupamentos e fluxos
acima detalham essa direção; não equivalem a aceite visual. A integração funcional com V1 e
os refinamentos de vigência indicados no brief estão explicitados em [TASKS.md](TASKS.md), com
dependências e decisões locais. A [referência de tokens](DESIGN_TOKENS.md) registra o
reaproveitamento do sistema atual. Implementação e validação visual permanecem pendentes.
