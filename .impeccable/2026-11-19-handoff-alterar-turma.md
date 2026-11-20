# Handoff · Alterar turma na formação semestral

**Estado em 19/11/2026.** A ficha do aluno recebeu um refactor visual. A investigação posterior localizou problemas no fluxo de troca. Essa investigação terminou na leitura do código. A correção do fluxo e a validação de ponta a ponta estão pendentes.

**Worktree.** Abrir o novo agente em `/Users/josiasribeiro/orca/lazuli`, branch `workspace/ec2-lazuli`. No momento da entrega, o HEAD era `cd0b4c45` e havia mudanças locais de várias frentes. Parte do seletor, dos diálogos e da ficha só existe no diretório de trabalho. Um checkout limpo do commit apresenta outra interface.

## A decisão que a secretaria precisa tomar

Uma turma regular de Essentials 1 segue para Essentials 2 no próximo período. Um aluno dessa turma passou a trabalhar à tarde e quer estudar terça e quinta à noite. Ele continua previsto para Essentials 2. A secretaria precisa saber **se ele acompanha a turma ou precisa de outra**. O pedido de horário, por si só, não justifica uma decisão de repetência.

O usuário quer registrar o motivo da troca com uma opção sugerida ou texto livre, escolher entre turmas regulares do estágio previsto e turmas PPT e, se nenhuma servir, conseguir criar uma turma vazia e escolhê-la para esse aluno. Pediu liberdade para melhorar a solução. “Horário”, “Modalidade” e “Adaptação” foram exemplos de uma implementação anterior. O desenho exato dos controles está em aberto.

## Onde o fluxo se perde hoje

| Achado | Consequência observável |
| --- | --- |
| **Alterar turma** abre `placement` para propostas e `move` para vínculos publicados. Para uma pessoa com turma proposta, progresso de origem e continuidade diferente de `CHANGE`, o roteador substitui a ação pelo diálogo genérico **Registrar resposta do aluno**. | Quem já clicou para trocar volta a escolher entre quatro respostas. O mesmo roteador atende a ficha e o perfil. Ao retomar a operação após registrar o motivo, ele também descarta um eventual `planId` do horário já escolhido. [Roteador dos diálogos](../apps/web/src/features/class-organization/dialogs.tsx) · [Entrada pelo perfil](../apps/web/src/features/students/profile/student-formation-dialog.tsx) |
| No diálogo da captura, **Pediu outra turma** e o relato sobre o horário já estão preenchidos. O botão **Escolher outra turma** usa a mesma condição que desabilita salvar um formulário sem alterações. Os motivos sugeridos e o relato livre escrevem na mesma variável. | Para avançar por esse botão, a equipe precisa editar algo já registrado. Clicar em **Horário** substitui o relato detalhado no formulário. O campo **Risco de saída** aparece mesmo quando a equipe só quer outro horário. [Formulário de continuidade](../apps/web/src/features/class-organization/continuity-form.tsx) |
| A preparação já busca o próximo estágio da regular e cria a proposta individual. Um caminho do formulário ainda apresenta **Acompanha a turma** e **Repetir em outra turma** como alternativas. | Essa pergunta mistura o destino do aluno com sua progressão pedagógica. Vale conferir também propostas antigas ao trocar para PPT, pois o formulário recalcula alguns valores iniciais. [Preparação do período](../packages/api/src/semester-organization/prepare.ts) · [Campos de destino](../apps/web/src/features/class-organization/placement-fields.tsx) · [Valores da proposta](../apps/web/src/features/class-organization/placement-model.ts) |
| Já existe filtro de turmas ativas por estágio ou PPT. Quando a troca está registrada, ele exclui a turma recusada e a sucessora correspondente à origem. A proposta usa grade semanal e a transferência usa uma lista. | O agente pode reaproveitar o filtro e os seletores. Hoje a ausência de destino leva a uma instrução para fechar a janela e criar uma turma pelo menu. O formulário de criação chama `onSaved` e logo depois `onClose`, detalhe importante para quem quiser devolver o usuário ao seletor. [Compatibilidade](../apps/web/src/features/class-organization/model.ts) · [Transferência](../apps/web/src/features/class-organization/movement-dialog.tsx) · [Criação de turma](../apps/web/src/features/class-organization/class-plan-model.ts) |

Registrar a continuidade já grava o motivo, atualiza a versão do vínculo e gera uma revisão no histórico. Em proposta ainda em formação, salvar um destino diferente depois da troca muda a continuidade para `UNDECIDED` e limpa o motivo da linha atual. A revisão anterior fica no histórico. Considerar essa transição ao retomar o aluno e ao explicar o resultado para a equipe. [Registro da resposta](../packages/api/src/semester-organization/lifecycle.ts) · [Gravação da proposta](../packages/api/src/semester-organization/write.ts)

## Percurso de aceite no navegador

1. Abrir uma proposta regular para o próximo período. Conferir o semestre e o estágio. O aluno pode acompanhar a turma preparada ou pedir outro horário e seguir no estágio previsto.
2. Abrir **Alterar turma**, registrar um motivo e chegar aos destinos. Repetir com um motivo já salvo. Deve ser possível prosseguir sem reescrever o relato. Se a entrada foi por um horário específico, conferir qual turma chegou selecionada.
3. Comparar uma regular compatível e uma PPT. Conferir que a turma recusada e regulares de outros estágios ficam fora das opções. Cancelar a escolha, reabrir o aluno e conferir o pedido registrado.
4. Exercitar o caso em que nenhum horário serve. Criar uma turma **vazia**, retomar o mesmo aluno e escolher a turma criada. A criação e a escolha precisam ser distinguíveis. Conferir o destino e o estágio ao reabrir a ficha.
5. Percorrer tanto uma proposta em formação quanto um vínculo já publicado. Na transferência, conferir a vigência. Na proposta, conferir que ainda existe a etapa de revisão da alocação.

Usar o navegador embutido do Orca e o servidor local. O usuário pediu **sem checks estáticos**. A validação anterior cobriu o cabeçalho, a volta à fila e a abertura de uma proposta por um horário sugerido. O percurso **motivo → criar turma vazia → retomar o aluno → escolher o destino** continua sem validação ponta a ponta. O relatório anterior registra o trabalho visual já entregue. [Relatório da ficha](2026-11-19-relatorio-ficha-formacao-de-turmas.md)
