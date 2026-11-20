# Rematrículas e planejamento PPT

Direcionamento do proprietário em 17/11/2026. Registrado para retomada; estas regras
não devem ser confundidas com funcionalidades já implementadas. A implementação
comercial fica temporariamente em espera enquanto examinamos o planejamento PPT.

## Significado operacional

A operação chama de rematrícula tanto o acompanhamento da compra de material quanto
a renovação do contrato. A página de Contratos deverá permitir controlar ambos.

## Matrícula e material

- Escolher a vigência em semestres comerciais de seis meses, sem acoplamento aos
  semestres do calendário acadêmico. A quantidade de semestres corresponde à
  quantidade de materiais; o contrato anual contempla dois materiais.
- Para cada material, distinguir pagamento no ato de pagamento futuro.
- Escolher a forma de pagamento individualmente para os materiais pagos no ato.
- Para os demais, permitir indicar o próximo semestre comercial, um semestre
  posterior ou deixar o momento em aberto. Não exigir antecipadamente a forma de
  pagamento desses materiais.
- Livros previstos no contrato não equivalem a livros já comprados/pagos. A solução
  anterior baseada apenas em aquisições precisa ser revista antes da entrega.

## Acompanhamento na página de Contratos

- Fim do contrato: permitir ordenar a vigência pelo término mais próximo.
- Fim do estágio regular: relacionar contrato, aluno, turma e período da turma.
- Fim do estágio PPT: usar o estágio e planejamento individuais do aluno, não um
  estágio compartilhado da turma.
- Representar compactamente os materiais previstos, seus pagamentos e a posição
  do aluno nessa cobertura. A retirada da coluna Pagador foi solicitada.
- Separar necessidade de material de necessidade de renovar contrato, mesmo que a
  operação reúna ambas sob o nome rematrícula.

## Próximo recorte autorizado

Inspecionar o planejamento do aluno PPT, comparando-o ao planejamento já disponível
para turmas. Não implementar agora o novo modelo comercial.

## Referências

- GitHub #236: agregado de livros, virada, PPT e rematrícula.
- #263: entrega e progressão dos livros do aluno.
- #279: avanço da turma ao fim do semestre.
- #292: acompanhamento de rematrículas e materiais na página de Contratos.
- A janela de 60 dias e a sugestão de livros na renovação são comportamento atual,
  mas não resolvem por si só o direcionamento acima.

## Inspeção do PPT em 17/11/2026

- Acesso: perfil do aluno, Pedagógico, Plano de ensino PPT
  (`?secao=planejamento&percurso=<progressId>`).
- `StudentPlanning` seleciona o percurso individual e reutiliza
  `PlanningWorkspace`, `PlanningJourney` e `ProgramExplorer`. A implementação
  oferece conteúdo realizado/próximo, projeção de datas e comparação de carga.
- O estágio vem de `PedagogicalProgress`, não de `Class.sharedStage`.
  Os registros lidos são filtrados pelo aluno e plano correspondentes.
- As aulas disponíveis ainda vêm das sessões da turma e do calendário letivo.
  `stage-planning/write.ts` normaliza o término para o fim do semestre.
- `PlanningAdjustments` oculta Adicionar aulas/Encerrar antes para o escopo
  individual. Essas ações não têm paridade com as da turma regular.
- Há textos compartilhados que ainda dizem “turma” e “semestre” no contexto PPT.
- Na base local inspecionada: zero programações ativas de modalidade PERSONALIZED
  e zero percursos PPT com plano vinculado. No navegador, João Pedro Fontes Azevedo
  (Essentials 2, PPT 16:00) mostra “A programação deste estágio ainda não foi
  importada”. Portanto, não foi validado um percurso PPT preenchido de ponta a ponta.
- Próximo passo proposto, ainda não executado: preparar um caso PPT com programação
  e registros para avaliar projeção, progresso e continuidade individual antes de
  conectar o fim do estágio às pendências comerciais.
