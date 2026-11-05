# Regras atuais de criação das aulas da turma

Este documento separa o comportamento observado em staging em 3 de novembro de 2026 da alteração feita neste worktree, ainda não implantada. Uma **aula da turma** é um registro `ClassSession` em uma data; não é uma lição do livro nem uma hora do programa pedagógico.

## Quando a geração começa

- Criar uma turma, clonar para o próximo período ou publicar um plano que cria uma turma registra um pedido de geração na mesma transação da turma. A API tenta enviar esse pedido ao Hatchet depois de salvar a transação. O processo separado `apps/worker` executa o job `sessions-generate`.
- Um administrador também pode pedir a geração novamente para uma turma ou um período pelo comando `classes.generateSessions`.
- A turma pode estar salva antes de suas aulas existirem. Se o envio do job falhar, a turma permanece salva, o pedido fica `FAILED` e a interface permite nova tentativa. Um pedido recente `PENDING`, `QUEUED` ou `RUNNING` impede outro pedido para o mesmo escopo; depois de cinco minutos ele é tratado como obsoleto.

## O que é validado antes de salvar a turma

- O comando de criação exige permissão administrativa. Precisa de um período existente e de um professor em atuação; turma regular precisa de uma etapa ativa.
- **Alteração local:** a criação pela API exige uma data de início explícita e válida dentro do período. Na clonagem para o próximo período, a data inicial é o primeiro dia do período de destino. Turmas anteriores à introdução da data podem não ter esse campo preenchido.
- Precisa de pelo menos um horário semanal, com início anterior ao fim. A soma semanal não pode passar de 120 minutos. Horários da própria turma que se sobrepõem no mesmo dia são rejeitados.
- O servidor bloqueia alterações concorrentes da agenda e verifica conflitos do professor: outras aulas, atendimentos pedagógicos independentes e aulas experimentais individuais. Também considera a data de desligamento do professor. Esta validação ocorre ao salvar a turma, antes do pedido de geração. **Em staging:** a verificação começa no início do período. **Na alteração local:** começa na data de início da turma.
- Esta é uma verificação de **horários ocupados**. O cadastro do professor não tem uma grade de disponibilidade ou jornada declarada; um horário livre de conflitos não significa que o professor confirmou disponibilidade para trabalhar nele.

## Quais aulas são planejadas

- O worker lê turmas ativas não excluídas no escopo do pedido, seus horários recorrentes, os períodos acadêmicos e os dias em que a escola está fechada. Faz essas leituras em lote.
- Para cada data **inclusive** no intervalo planejado, cria uma aula por horário recorrente cujo dia da semana corresponde à data. Dias fechados ativos são pulados. **Em staging:** o intervalo começa no primeiro dia do período, mesmo se a turma foi criada depois. **Na alteração local:** começa na data escolhida para a turma; turmas antigas sem data registrada continuam usando o início do período.
- Cada data precisa pertencer a exatamente um período acadêmico. Ausência ou sobreposição de períodos faz o job falhar, em vez de omitir a data silenciosamente.
- O worker insere as aulas planejadas em lote. Uma restrição única parcial no PostgreSQL identifica a aula recorrente por `(turma, horário, data)` enquanto não estiver excluída. `createMany({ skipDuplicates: true })` ignora uma aula já existente.

## Repetição, falhas e limites

- Executar a geração novamente para a mesma turma não duplica aulas. O pedido de geração é protegido por bloqueio transacional; um pedido já `SUCCEEDED` devolve o resultado salvo. Uma nova tentativa também preserva registros de presença e outras alterações nas aulas existentes.
- A regeneração **só acrescenta aulas ausentes**. Não apaga nem ajusta automaticamente aulas que já foram criadas se horários recorrentes, período ou dias fechados mudarem depois. Alterações desse tipo precisam de uma operação específica de agenda; a regeneração não é uma reconciliação completa.
- O job roda em transação: falha ao planejar ou inserir aulas não deve deixar um lote parcialmente gerado. O worker registra `FAILED` quando consegue alcançar o banco. O workflow está configurado sem retry automático do Hatchet; a recuperação exige novo pedido pela aplicação.

## Evidência no código e nos testes

- Entrada e pedido: `packages/api/src/classes/router.ts`, `packages/api/src/classes/data.ts`, `packages/api/src/session-generation/requests.ts`.
- Planejamento e execução: `packages/worker-handlers/src/sessions/generate.ts`, `packages/worker-handlers/src/sessions/process-generation.ts`, `apps/worker/src/index.ts`.
- Restrição de repetição: `packages/db/prisma/migrations/20260704165000_gre_65_class_sessions/migration.sql`.
- Testes de criação e pedido: `packages/api/test/classes/router.integration.test.ts`. Testes de datas, dias fechados, repetição, entrega duplicada e preservação da presença: `packages/worker-handlers/test/sessions-generate.unit.test.ts` e `packages/worker-handlers/test/sessions-generate.integration.test.ts`.
