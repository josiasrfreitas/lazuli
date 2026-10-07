# V1 — Turmas e matrículas

Issue: [#157](https://github.com/josiasrfreitas/lazuli/issues/157). Épico: #156. Fonte: [DESIGN_BRIEF.md](DESIGN_BRIEF.md), [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md) e decisões da conversa de 07/10/2026.

Uma única issue de implementação, com quatro slices verticais sequenciais. Cada slice entrega uma experiência utilizável com interface, regras, persistência e testes. Não abrir issues por camada técnica. O usuário encerrou o workshop e pediu evolução diretamente no app; a estrutura de navegação foi escolhida, mas o visual do protótipo não foi aprovado. O protótipo foi descartado.

Problemas e soluções do módulo: [brief pedagógico](../DESIGN_BRIEF.md). Referência visual: [DESIGN_TOKENS.md](DESIGN_TOKENS.md).

## Experiência e decisões confirmadas

- `/turmas`: tabela tradicional, busca, filtros e acesso à página da turma pela linha. `/turmas/[id]`: página própria da turma, com dados essenciais e alunos como conteúdo principal. Preservar contexto da listagem ao voltar e permitir acesso direto por URL.
- Turma é uma entidade independente da página do aluno. Não concentrar as outras verticais em abas desta página nem construir a futura página unificada do aluno nesta entrega.
- Regular tem estágio compartilhado; PPT admite estágio individual por aluno. Regular/PPT e presencial/online são dimensões diferentes. Usar professores já habilitados.
- Capacidade é informativa: mostrar turma cheia ou acima da capacidade, permitindo matrícula sem bloqueio, justificativa ou autorização adicional.
- Pausa libera vaga a partir da data efetiva. Retorno exige escolher turma, sem reserva da vaga anterior, preservando histórico e continuidade pedagógica; não prorroga automaticamente o plano individual.
- Permitir datas de hoje e futuras. Movimentações futuras podem ser canceladas antes da data efetiva, preservando registro e autoria. Alterações passadas exigem correção justificada e avaliação dos registros afetados.
- Movimentação operacional não aprova aluno, avança estágio, apaga notas, redefine plano, altera automaticamente situação cadastral ou gera cobrança.
- Transferências estão fora desta entrega, inclusive Regular ↔ PPT. Gestão de professores, aulas, frequência, avaliações, planejamento e financeiro permanecem nas suas verticais.

## Slices de implementação

- [ ] **1. Administração encontra e cria turmas, abrindo a página de cada turma.** Entregar navegação, tabela com dados reais, busca, filtros, paginação, criação Regular/PPT e página da turma com cabeçalho compacto e relação de alunos existentes. Incluir edição dos dados básicos sem efeitos sobre aulas já registradas. _Dependências: nenhuma._

  **Aceite:** criar turma válida e encontrá-la na tabela; abrir por linha ou URL; visualizar professor, modalidade, formato, estágio quando compartilhado, horários, capacidade e alunos. Tratar carregamento, erro, vazio, filtros sem resultado e turma inexistente. Voltar mantém contexto. A experiência funciona por teclado e em tela estreita. Refinar hierarquia e densidade diretamente no app antes de ampliar as operações.

  **Implementação:** reutilizar AppShell, DataTablePage, DataTable, Dialog, campos, filtros, paginação, badges e tokens existentes; criar a feature de turmas, rotas e formulários. Alterar componente compartilhado apenas se a navegação acessível por linha exigir. Reutilizar `classes.create`, validações de estágio/semestre/professor e geração atual do nome; adicionar consultas list/detail, opções de formulário e atualização básica em `packages/api/src/classes`. Não incluir clonagem semestral ou geração síncrona de aulas.

  **Verificação:** integração das consultas e escrita, transporte/autorização administrativa, contrato do formulário e validação no navegador em desktop e largura estreita. Confirmar persistência após recarregar e preservação dos filtros ao voltar.

- [ ] **2. Administração matricula alunos e acompanha ocupação atual e futura.** A partir da turma, selecionar aluno, estágio individual no PPT e data de entrada; salvar e consultar vínculo atual ou programado. Permitir cancelar entrada futura antes de sua efetivação. _Dependência: slice 1._

  **Aceite:** Regular usa estágio da turma; PPT exige estágio individual válido. Entrada futura aparece como programada e não como presença atual. A capacidade pode ser excedida, com sinalização visual consistente na tabela e no detalhe. Reenvio ou concorrência não cria matrícula duplicada na mesma turma. Cancelar uma entrada futura mantém autoria/histórico e não deixa progresso ativo indevido. Exibir falhas de validação no formulário sem perder preenchimento.

  **Implementação:** reutilizar seleção de alunos, Dialog, campos e componentes da turma; criar formulário de matrícula e apresentação dos vínculos programados. Modificar `enrollment.create`, schemas e persistência conforme necessário. Remover a exigência de `capacityOverrideReason` no fluxo desta entrega, sem enviar justificativa fictícia pelo frontend. Centralizar interpretação das datas efetivas para consultas, ocupação e mutações; revisar o uso atual de `exitDate: null`. Manter proteção de duplicidade na mesma turma; não inventar exclusividade por trilha. Persistir cancelamento sem apagar histórico. Registrar usuário e data nas ações.

  **Verificação:** integração de Regular/PPT, limite e excesso de capacidade, matrícula futura, cancelamento e duplicidade concorrente; transporte e contrato de formulário. No navegador, matricular em turma cheia, recarregar e conferir listagem/detalhe. Testar fronteira de data em America/Sao_Paulo.

- [ ] **3. Administração pausa, retorna e encerra vínculos sem perder o percurso do aluno.** Entregar ações na página da turma, com data efetiva, confirmação de consequências, movimentações programadas, cancelamento e histórico operacional. No retorno, localizar o vínculo pausado e escolher a turma de destino. _Dependência: slice 2._

  **Aceite:** pausa e saída de hoje atualizam vínculo e ocupação; operações futuras não alteram antecipadamente a situação vigente. Cancelamento só é permitido antes da data efetiva e restaura a projeção correta. Retorno preserva referências ao percurso anterior e permite turma cheia com sinalização. A vaga anterior não fica reservada. Repetição ou concorrência não efetiva duas vezes a mesma operação. Nenhuma ação avança estágio ou estende prazo do plano automaticamente. Mostrar quem registrou e quando, sem construir um módulo geral de auditoria.

  **Implementação:** reutilizar componentes de formulário e histórico do slice 2; criar ações de pausa/retorno/saída e seleção da turma de retorno. Evoluir `enrollment.close`, adicionar retorno e cancelamento com persistência transacional. Revisar o encerramento atual de `PedagogicalProgress` junto da matrícula para preservar continuidade, notas e referências existentes. Fazer migração incremental se necessária, sem editar migrações aplicadas. Consumidores de matrícula devem respeitar a mesma semântica temporal; trabalho agendado, caso necessário, cruza o worker boundary com execução idempotente.

  **Verificação:** integração cobrindo pausa → retorno, saída, cancelamentos, datas futuras, concorrência e conservação dos registros pedagógicos; transporte e contratos dos formulários. Validar no navegador a jornada completa e a diferença visível entre situação atual e programada. Antes de implementar retorno com mudança de estágio, resolver sua regra específica; não presumir que ele equivale a transferência ou progressão.

- [ ] **4. Administração corrige movimentações passadas com justificativa e efeitos explícitos.** Entregar fluxo de correção a partir do histórico do vínculo, apresentando registros afetados antes da confirmação. _Dependência: slice 3; requer definição pontual do tratamento dos impactos abaixo antes da escrita._

  **Aceite:** uma alteração retroativa não passa pelo formulário normal de movimentação. A correção exige justificativa, registra autor/data e preserva o fato anterior. A administração vê os efeitos sobre vínculo, ocupação e registros relacionados antes de confirmar. Falha deixa a operação inteira sem aplicação parcial. Não recalcular nem apagar silenciosamente aulas, frequência, notas ou planos.

  **Implementação:** reutilizar Dialog, campos, resumo da turma e histórico; criar prévia de impactos e formulário de correção. Adicionar consulta de impactos e comando transacional nos serviços de matrícula, reaproveitando regras temporais. Resolver com o responsável pelo produto como tratar aulas/frequência já registradas e quais impactos impedem a correção; essa decisão restringe este slice, não reabre os anteriores.

  **Verificação:** integração com vínculos que tenham registros relacionados, correção sem impactos, justificativa ausente, concorrência entre prévia e confirmação e rollback. Transporte, contrato do formulário e jornada no navegador demonstrando preservação do histórico.

## Limites e decisões pontuais

Arquivamento com vínculos ativos/futuros e alteração de horários com aulas existentes não tiveram regra aprovada. Não incluir essas operações no primeiro slice por inferência do protótipo. Edição básica deve excluir campos que possam reescrever o significado de vínculos ou aulas existentes; definir o tratamento desses impactos antes de ampliar a edição.

Retorno com mudança de estágio e efeitos concretos das correções retroativas precisam de decisões locais antes dos respectivos caminhos. Não tratar hipóteses do workshop como regras aceitas. Não construir estruturas de notas ou planejamento ainda inexistentes apenas para antecipar V7/V9; preservar os registros existentes e explicitar a continuidade necessária.

## Critério comum de conclusão

Cada slice inclui UI em PT-BR, API autorizada, persistência real, estados de falha e validação proporcional conforme `docs/testing/README.md` e `docs/frontend/README.md`. Componentes têm no máximo 200 linhas. Reutilizar os tokens atuais. Não importar Prisma no web nem acessar persistência pelo domínio. Respeitar os ADRs de separação entre matrícula, progresso, calendário e financeiro. Testar regras com integração e transporte quando apropriado, contratos dos formulários e navegação real em desktop/tela estreita; não substituir validação visual por testes que espelham JSX.

A issue estará concluída quando os quatro slices estiverem entregues e verificados, com as decisões pontuais resolvidas. A exclusão do workshop não significa que a V1 já foi implementada.
