# #153 — Registro de pagamentos em Recebíveis

Status: plano aprovado em conversa; implementação em andamento.

Fonte de escopo: https://github.com/josiasrfreitas/lazuli/issues/153.
Referência visual: `.design/registro-pagamentos/WORKSHOP.md`, opção A, com a
decisão final de formulário único prevalecendo sobre o wizard antigo.

## Base verificada

- Branch de trabalho: `issue-153`, HEAD inicial `dbbd7d2`.
- O protótipo está em alterações locais preexistentes. Preservar seu conteúdo;
  não incluí-lo acidentalmente no PR de produção.
- #128 foi entregue pelo PR #152, merge `fc23741`, disponível em `origin/main`.
  Integrar essa base antes do código de produção. Ela contém pontualidade,
  identidade de comando individual e testes; atraso e lote contratual continuam bloqueados.
- Preservar `finance(db, staffUserId)`, domínio puro, transação/autorização no
  servidor e saldos derivados, conforme ADRs 0007 e 0018.

## Decisões aprovadas em conversa

1. Abater juros antes do principal. Juros diários usam o principal remanescente
   em cada intervalo; mensais usam o principal anterior ao pagamento de cada
   aniversário, contado sempre a partir do vencimento original. O pagamento
   reduz a base dos dias seguintes. Não capitalizar juros.
2. Usar aritmética decimal exata; arredondar meio centavo para cima, por
   componente, sobre o acumulado. Subtrair encargos já efetivados e preservar
   a precisão residual entre confirmações. Repetir prévia não grava nem arredonda
   novamente o histórico.
3. Aceitar registro posterior de pagamento passado, mas bloquear inserção
   anterior a fato financeiro já efetivado na parcela. Sem replay geral.
4. Data/forma comuns no formulário, sem exceções por linha nesta entrega.
   Cada recebimento tem identidade explícita e um pagador; permitir separar
   recebimentos do mesmo pagador. Não deduzir identidade por data/forma/pagador.
5. Conferir total efetivamente recebido por recebimento contra suas alocações
   explícitas. Não ratear automaticamente. Definir a apresentação dessa conferência
   preservando o caso comum preenchido e a grade A.
6. Bloquear futuro, valor não positivo e excedente no fluxo novo. Preservar a
   compatibilidade documentada de Material/legado; não mudar silenciosamente o
   contrato da API antiga que permite sobra não alocada. Confirmar o alcance
   dessa política ao fechar as decisões.
7. Formas divididas, novos ajustes negociados e correção/estorno ficam fora desta
   entrega. Operações existentes continuam respeitando suas proteções.
8. Seleção persiste entre páginas/filtros/agrupamentos; marcar todos atua somente
   nos itens visíveis. Exibir quantos selecionados estão fora da vista.
9. Uma identidade estável por operação protege timeout/reenvio; payload diferente
   com a mesma identidade é conflito. Prévia alterada exige nova conferência;
   falhas preservam o rascunho. Retomar o resultado de operação já confirmada.

O responsável aprovou os três grupos de decisões: parcial/encargos,
retroatividade/exceções e lote/seleção/recuperação. Este plano registra as respostas.
O protótipo original está preservado no stash `issue-153: preserve supplied payment
workshop prototype` e na branch local do workshop.

## Exemplos independentes para validar as propostas

- Pontualidade já exigida: nominal R$ 250, em dia R$ 230. Receber R$ 100 no
  prazo deixa saldo R$ 150 sem desconto. Outros R$ 130 no prazo aplicam R$ 20
  de desconto e zeram o saldo; recebido acumulado R$ 230.
- Exemplo proposto de atraso: principal R$ 1.000, vencimento 31/01/2026,
  diário 0,1%, mensal 2%. Em 10/02: 10 dias geram R$ 10; pagamento R$ 210
  quita juros e R$ 200 do principal, restando R$ 800.
- Em 28/02: 18 dias sobre R$ 800 geram R$ 14,40; primeiro aniversário gera
  R$ 16. Novos encargos R$ 30,40. Pagamento R$ 130,40 deixa principal R$ 700.
- Em 31/03: 31 dias sobre R$ 700 geram R$ 21,70; segundo aniversário gera
  R$ 14. Novos encargos R$ 35,70; quitação R$ 735,70. Os juros anteriores
  não entram na base e o aniversário não migra para 28/03.
- Arredondamento proposto: dois acréscimos exatos de R$ 0,005 totalizam
  R$ 0,01 acumulado; não cobrar R$ 0,02 por arredondar cada intervalo.
- Retroatividade proposta: registrado em 30/09 com data efetiva 10/09 é
  aceito se não houver fato posterior a 10/09 já efetivado; caso contrário,
  rejeitar a operação toda, identificando a parcela.

## Ordem de implementação e commits atômicos

1. Integrar #128 e registrar as decisões aprovadas com seus exemplos. Inspecionar
   compatibilidade do estado local e das migrations sem reescrever históricos.
2. Implementar cálculo puro de quitação: pontualidade, principal remanescente,
   encargos incrementais, aniversários, precisão e datas. Commit com unitários
   que comprovem os exemplos aprovados.
3. Implementar prévia sem escrita e confirmação individual com o mesmo cálculo.
   Persistir somente os dados adicionais necessários a encargos/idempotência,
   com migration aditiva se necessária. Commit inclui integração e transporte.
4. Implementar lote de recebimentos explícitos, transação única, bloqueios
   ordenados e revalidação de todas as linhas. Unificar regras dos caminhos
   existentes para impedir bypass. Commit inclui concorrência, rollback, retry
   e equivalência individual/lote com múltiplos pagadores e origens.
5. Implementar formulário único baseado em DenseForm, busca e seleção, grade
   compacta, detalhes, valores sugeridos, edição parcial, totais e recuperação.
   Commit com testes de estado e contrato do formulário.
6. Integrar as duas entradas, checkboxes e toolbar à consulta existente,
   preservando filtros, paginação, ordenação e agrupamentos. Commit com testes
   de seleção e invalidação das consultas de Recebíveis/Contratos.
7. Corrigir problemas encontrados na verificação visual e registrar evidências.
   Revisar o diff completo, abrir PR com a skill `pr` e acompanhar com
   `babysit-pr`; corrigir falhas e feedback pertinentes sem merge automático.

Cada commit deve permanecer coerente; endpoints contratuais só são liberados
quando as respectivas regras e proteções estiverem completas.

## Contratos e defeitos que os testes precisam detectar

- Domínio: resultado independente calculado à mão; detectar juros duplicados,
  capitalização, perda do dia de aniversário, desconto prematuro e arredondamento
  cumulativo incorreto.
- Integração: prévia não escreve; ajustes/pagamentos/alocações confirmam ou
  revertem juntos; detectar aplicação parcial de lote, duplicidade após timeout,
  perda de concorrência e uso de saldo antigo como quitação.
- Transporte real: autorização, datas/centavos serializados, erros por linha,
  identidade de comando e impossibilidade de contornar regras pelos endpoints.
- Consultas: parcial não aumenta contagem de quitadas, dispensa não é pagamento,
  saldos e recebido refletem o ledger após confirmação.
- Interface: preservar edições ao adicionar/remover itens; prévia falha nunca
  aparece como registro concluído; teclado e estados assíncronos exercitados.

## Checks em sequência

Executar um check por vez, sem gates concorrentes; usar concorrência 1 nos
comandos Turbo quando aplicável. Testes focados durante cada mudança, depois:

1. Formatação e `git diff --check`.
2. Lint e duplicação.
3. Typecheck.
4. Gate prospectivo de qualidade dos testes contra a base integrada.
5. Unitários e checks de scripts/componentes/estilos.
6. Integração em banco isolado, com migrations e drift conferidos.
7. Transporte no adaptador real.
8. Build.
9. Navegador em 1280 × 800, 1366 × 768 e viewport estreito: nomes longos,
   valores grandes, homônimos, lote grande, foco, Tab, Enter, Escape, erros,
   ações visíveis e ausência de rolagem horizontal. O caso comum cabe no form.
10. Diff completo, whitespace final e gate de pre-push dos commits.

Não usar `test:e2e` placeholder como evidência. Na entrega, relatar checks
realmente executados e qualquer limitação concreta. CI verde e aprovação de
review são resultados distintos.
