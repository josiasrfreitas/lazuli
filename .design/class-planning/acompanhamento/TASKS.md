# Frente 2 · Acompanhamento de risco e impedimentos na ficha

Entrada do agente 2 na branch `workspace/ec2-lazuli`. Leia o [fluxo acordado e o exemplo da professora](../../../docs/handoffs/formacao-continuidade-na-turma.md#risco-de-saída-e-acompanhamento-na-ficha-do-aluno). Quem recebe um caso precisa entender o motivo, o que já foi tentado, quem assumiu o próximo passo e se a situação mudou. A coluna esquerda da ficha do aluno em contexto de Formação é o lugar desse trabalho.

## Onde começar

Em `apps/web/src/features/class-organization/`, leia `review-detail.tsx` para ver a composição da ficha, `review-context.tsx` para localizar o histórico e os atalhos existentes e `continuity-form.tsx` para entender o registro manual. A proposta já tem revisões de auditoria em `SemesterPlacementRevision`. Antes de definir persistência nova, examine `PedagogicalFollowUp` e `ContractRenegotiation` em `packages/db/prisma/schema.prisma`, quem pode acessá-los e o que representam. Reaproveite registros compatíveis e acrescente apenas os dados que o acompanhamento exige.

## Entregas verificáveis

- [x] **Sinalizar risco e recuperar o relato.** Adaptar o formulário da ficha. **Risco de saída** substitui “Pensando em sair”. A professora pode registrar desengajamento observado mesmo sem manifestação verbal. Registrar quem sinalizou, quando, se o aluno ou a família mencionou a possibilidade de saída e um relato livre do que aconteceu. Score baixo é atenção e pode corroborar o relato. Preservar o sentido dos registros anteriores sem atribuir retrospectivamente uma fala à família.
- [x] **Passar o caso adiante e registrar tentativas.** Compor a linha do tempo na coluna esquerda a partir de eventos reais. Quem recebe o caso vê o motivo, o autor, a tentativa de contato ou intervenção, seu resultado e, quando houver encaminhamento, o próximo responsável e o que ficou combinado. Permitir registrar uma ligação sem resposta e acrescentar depois a conversa que esclareceu a situação. Os registros precisam sobreviver à recarga e preservar as contribuições de pessoas diferentes.
- [x] **Referenciar a negociação e registrar a evolução.** Reutilizar os fluxos financeiros de renegociação e de renovação do contrato, conforme o caso. Associar a negociação existente do aluno e permitir consultá-la com as permissões correspondentes. Registrar separadamente a reavaliação da equipe e se o risco continua, mudou ou foi resolvido. Abrir uma negociação ou tentar contato, por si só, não encerra o acompanhamento. A decisão de permanência na escola pertence à Rematrícula.
- [x] **Entregar a ficha no contexto da Formação.** Substituir o histórico de edições na coluna esquerda pelos acontecimentos que explicam o caso. Manter revisões técnicas na auditoria. Uma publicação efetiva pode aparecer como acontecimento identificado. Reutilizar os atalhos para tratar causas, o breadcrumb com retorno à turma e as métricas já existentes. Verificar o percurso professora → secretaria → Financeiro → reavaliação, o primeiro acesso sem histórico, o retorno após recarga e o uso por teclado e em largura estreita. Seguir o guia em `docs/frontend/README.md` com o servidor do usuário.

## Divisão com o agente 1

Esta frente é dona da ficha individual, do formulário, da persistência e da leitura dos acontecimentos, incluindo a referência financeira. O agente 1 mantém a classificação de continuidade, a consulta coletiva e a publicação. Reutilize o resultado da classificação na ficha. Se for preciso expor um dado do acompanhamento para a lista, combine o campo antes de editar arquivos comuns. Trabalhe sobre o diff existente da branch.

Decisões confirmadas pela escola: **Registrar intervenção** é o nome da ação. O risco ativo bloqueia a pré-confirmação até sua resolução.

Verificação no Orca com sessão administrativa: estado vazio, sinalização sem manifestação verbal, contato sem resposta, encaminhamento com consulta à renegociação, resolução e recuperação do relato após recarga. A ficha e o formulário foram conferidos com teclado e nas larguras de 1280 e 390 px. O teste de integração cobre a autoria da professora e as permissões de cada perfil.

A intervenção exige sinalização ativa. No atendimento, o pedido de troca registra horário, modalidade ou adaptação e o relato do aluno. A escolha da turma é uma ação independente. A sinalização de risco oferece saída ou troca de horário. Desfazer uma turma acrescenta **Turma encerrada** aos vínculos afetados e preserva os motivos individuais. Escolher um novo destino resolve o impedimento de encerramento.
