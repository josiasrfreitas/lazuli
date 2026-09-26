# P09 — Situação financeira e vigência

Escopo: [issue #125](https://github.com/josiasrfreitas/lazuli/issues/125).

## Contrato e evidência

Pagamento não altera a vigência do serviço. Dispensa não representa pagamento.
Saldos registrados vencidos e futuros devem ser distinguíveis; simulações não
entram nos valores registrados. A base é o aceite da issue, as decisões 0007 e
0018 e a regra de progresso confirmada na P08.

Defeitos a detectar: quitação inferida apenas de saldo zero; mudança da vigência
por pagamento ou cancelamento do pedido; mistura de vencidas com futuras;
deslocamento de data na virada do dia em São Paulo; inclusão de fatos excluídos,
material ou pagamentos de outro contrato nos agregados.

## Regras confirmadas pelo responsável

Regras confirmadas pelo responsável nesta conversa em 25/09/2026:

- Quitado somente quando todas as parcelas do plano estiverem pagas.
- Saldo zerado por dispensa/ajuste: “Sem saldo a cobrar”, com motivo explícito.
- Pedido cancelado: “Cobrança cancelada”, sem inferir encerramento do serviço.
- Vigência pelas datas comerciais: “Não iniciado”, “Vigente” e “Encerrado”.
  Incluir o dia final como vigente, usando America/Sao_Paulo.

## Implementação

- [x] Resolver a decisão acima e registrar a resposta.
- [x] Derivar situação e totais pelos fatos financeiros válidos do contrato.
      Separar vencidas, vencimento hoje e futuras; usar saldo registrado, sem
      aplicar prévia de juros ou descontos condicionais.
- [x] Retornar vigência independentemente da situação financeira, preservando
      a fronteira `finance(db, staffUserId)` e os cálculos puros no domínio.
- [x] Compor situação financeira e valores na tabela; mostrar estado e datas
      na coluna Vigência. Reutilizar Badge, DataTable e tokens atuais.
- [x] Testar integração dos fatos persistidos e totais, serialização HTTP e
      renderização das células. Cobrir pagamento integral/parcial, dispensa,
      ajuste que zera saldo, cancelamento e datas-limite.
- [x] Conferir a página real em 1280 × 800 e viewport estreito, com nomes longos,
      temas claro/escuro e estados de carregamento, erro e vazio aplicáveis.
- [x] Executar checks proporcionais, revisar o diff completo e `git diff --check`.

As escritas contratuais de pagamento, dispensa, ajuste e cancelamento continuam
dependentes de suas entregas próprias. Os testes podem persistir fatos
controlados para verificar a leitura, como na P08. Não há migração prevista.

## Validação — 26/09/2026

- 303 testes unitários de domínio, API e web passaram no primeiro conjunto de
  verificações; os dois cenários adicionais do domínio passaram no novo dry run
  de mutação. Os 13 testes de apresentação financeira/progresso passaram novamente
  após a mudança final da ordem das colunas.
- 12 testes de integração e transporte passaram em Postgres temporário com as
  migrations atuais. O banco temporário foi removido ao final. A consulta HTTP
  agora respeita a data de referência do contexto, como as demais consultas
  financeiras; isso foi observado pelo teste de serialização com data fixa.
- Mutação do novo módulo `contract-status.ts`: 98/98 mutantes detectados, sem
  sobreviventes e sem mutantes sem cobertura. A primeira rodada revelou lacunas
  para saldos iguais em hoje/futuro, datas Date do banco e plano sem parcelas;
  os testes adicionais cobrem esses comportamentos.
- Lint e typecheck de domínio, API e web passaram. Build de produção da web,
  limites de componentes, estilos, formatação dos arquivos alterados e
  `git diff --check` passaram.
- O gate prospectivo de testes passou com três avisos contextuais revisados:
  dois apontam um loop sobre dois casos literais, cujas asserções sempre executam;
  outro aponta a preparação determinística da contagem paga conforme o cenário
  de apresentação. Nenhuma asserção foi dispensada nem regra desativada.
- O lint mantém avisos existentes e sinaliza usos do token tipográfico `text-micro`
  como cor fora do tema. As células usam os tokens semânticos existentes.
- Página real conferida no build de produção local: 1280 × 800 e 375 × 812,
  claro/escuro, nomes longos e rolagem interna da tabela. Situação financeira e
  vigência foram colocadas lado a lado para ficarem simultaneamente visíveis
  no desktop. A largura da página permaneceu igual à do viewport em ambos.
- Carregamento observado com resposta atrasada; erro de consulta observado com
  falha de rede simulada; recuperação pelo botão Tentar de novo; busca sem
  resultados e tabela vazia após remoção dos dados temporários. O transporte
  normal foi restaurado e os ajustes financeiros locais foram restaurados.
- [Evidências visuais](evidence/README.md) foram capturadas sem edição das imagens.

A suíte completa do monorepo e duplicação ficam para CI: as verificações locais
cobrem os pacotes e contratos afetados. A mutação local cobre o novo cálculo puro;
CI mantém a seleção completa de arquivos alterados. O placeholder `test:e2e`
não foi usado como evidência da interface. Sem migrations ou liberação das
escritas financeiras futuras.
