# Super Admin e visualização da área docente

Handoff de produto e engenharia · 21/11/2026 · A implementar.

## Pedido do responsável

Criar um papel próprio, `SUPER_ADMIN`, acima de `SYSTEM_ADMIN`. Quem recebe esse papel tem todas as permissões administrativas do Lazuli, inclusive as de ajustes globais, e pode escolher qualquer professor no seletor de conta para visualizar sua área docente. A entrada fica no avatar que hoje permite alternar entre Administração e Docente.

## Experiência

1. O Super Admin abre **Conta e perfis** pelo avatar e escolhe **Ver como professor**.
2. Essa opção abre um submenu flutuante com os perfis docentes. A proposta é ordenar por nome e permitir busca. Ao fechar o submenu com Escape, o foco volta para **Ver como professor**.
3. Ao escolher um nome, o sistema abre **Meu início** daquele professor. Saudação, agenda, turmas, alunos, atendimentos, experimentais e acompanhamento usam o professor selecionado. A navegação interna conserva a escolha.
4. Um aviso persistente identifica **Visualizando como [nome do professor]**. O Super Admin pode escolher outro professor pelo seletor ou usar **Voltar à administração**. A troca precisa funcionar também na navegação móvel.
5. O pedido é de visualização. Implementar a experiência em **somente leitura**. A presença, a nota e o registro de atendimento continuam consultáveis quando disponíveis. Ações que alteram esses dados ficam indisponíveis enquanto o Super Admin visualiza o perfil.

**Ponto a confirmar sobre a lista.** O pedido fala em todos os perfis. Incluir docentes com acesso ativo, inclusive administradores que também lecionam. Para perfis desligados ou desabilitados, decidir com o responsável se aparecem identificados como inativos para consulta histórica. Essa decisão afeta a lista e o comportamento ao abrir um link antigo.

## Autorização e dados

- Na administração, o novo papel herda o acesso de `SYSTEM_ADMIN`. A capacidade de visualizar outro docente pertence exclusivamente a `SUPER_ADMIN`. A troca entre os próprios perfis de uma pessoa continua sendo um fluxo distinto.
- Conservar duas identidades explícitas no servidor: o usuário autenticado autoriza a operação e identifica seu autor em registros de auditoria; o professor escolhido determina quais dados podem ser lidos. A seleção no navegador é entrada a validar em cada requisição.
- Aplicar as mesmas regras de escopo que a área docente usa para o próprio professor, inclusive em detalhes abertos por link direto e em componentes que consultam roteadores compartilhados. Rejeitar escritas nesse contexto também na API.
- Isolar a seleção e o cache por professor. Ao trocar de docente ou voltar à administração, a tela deve renderizar os dados da experiência correspondente, inclusive após recarga e ao usar o histórico do navegador.
- O provisionamento do novo papel é explícito. A migração acrescenta o valor ao enum e preserva os papéis das contas atuais. A ADR 0022 reserva os ajustes globais a `SYSTEM_ADMIN`; registrar a nova decisão de hierarquia antes de ampliar essa permissão. [ADR 0022](../decisions/0022-restrict-global-settings-to-system-administrators.md)

## Pontos de entrada na implementação atual

| Área          | Onde começar                                                                                                                                             | O que verificar                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Seletor       | [Menu da conta](../../apps/web/src/components/app-shell/account-menu.tsx) e [troca de experiência](../../apps/web/src/lib/staff-experience.ts)           | O popover atual lista papéis da própria identidade. O novo submenu seleciona uma pessoa.                                                       |
| Identidade    | [Acesso de funcionários](../../packages/auth/src/staff-access.ts) e [schema Prisma](../../packages/db/prisma/schema.prisma)                              | Enum, papéis habilitados, elegibilidade docente e usuários com dois perfis.                                                                    |
| Administração | [Procedures tRPC](../../packages/api/src/trpc/init.ts) e [matriz de acesso](../../packages/api/src/trpc/rbac.ts)                                         | Revisar também os guards de página e os itens da navegação que enumeram papéis administrativos.                                                |
| Área docente  | [Layout de professor](<../../apps/web/src/app/(app)/professor/layout.tsx>) e [roteador do workspace](../../packages/api/src/teacher-workspace/router.ts) | Hoje o layout exige `TEACHER` e as leituras usam o funcionário da sessão. Revisar as consultas dos detalhes e diálogos além da página inicial. |

## Critérios de aceite

- Com um Super Admin e dois professores com turmas diferentes, abrir A pelo avatar, navegar até uma turma, trocar para B e recarregar. Conferir nomes, agenda e listas com os dados que cada professor vê em sua própria sessão.
- No contexto de B, tentar abrir pelo endereço ou pela API uma turma exclusiva de A. O servidor recusa. Tentar registrar presença e salvar nota em B também é recusado, sem alteração nos dados.
- Um administrador comum, um administrador do sistema e um professor não recebem a opção de visualizar terceiros. Uma chamada direta à API com o identificador de outro docente também é recusada.
- Ao sair da visualização, o Super Admin recupera sua experiência administrativa, incluindo os ajustes globais. Um administrador que também leciona continua conseguindo alternar para seu próprio perfil docente.
- Validar o submenu em desktop e celular, incluindo teclado, busca sem resultado e professor indisponível entre a seleção e a abertura. Conferir a identidade exibida durante o carregamento e depois de voltar pelo navegador.
