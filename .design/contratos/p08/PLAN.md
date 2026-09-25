# P08 — Progresso de pagamento

Escopo: [issue #124](https://github.com/josiasrfreitas/lazuli/issues/124).

Regra confirmada pelo responsável nesta tarefa em 25/09/2026: preservar o total do
plano original e informar dispensas separadamente. Cinco parcelas pagas e duas
dispensadas em doze mostram “5 de 12 pagas” e “2 dispensadas”. Pagamento parcial
não conta como parcela paga. Cancelamento preserva os pagamentos realizados e o
denominador; parcelas dispensadas e canceladas não se tornam pagamentos.

O modelo atual registra dispensa por parcela e cancelamento por pedido. A consulta
informa separadamente as parcelas não pagas e não dispensadas de um pedido cancelado.
O fluxo futuro de encerramento por parcela continua fora deste recorte.

## Execução

- [x] Acrescentar os agregados à consulta existente, por contrato, usando pagamentos
      e ajustes válidos. Material independente e contratos de irmãos não entram.
- [x] Compor texto e barra acessíveis na tabela existente, com tokens semânticos e
      os estados de carregamento, erro e vazio do DataTable.
- [x] Proteger os agregados com integração no Postgres, a serialização com transporte
      e o texto/semântica acessível com renderização do componente real.
- [x] Conferir desktop 1280 × 800 e viewport estreito; executar checks proporcionais
      e revisar o diff completo.

Os testes de consulta persistem fatos financeiros controlados porque as escritas
contratuais permanecem bloqueadas até suas entregas próprias. Esta tarefa não libera
pagamento, dispensa, ajuste ou cancelamento contratual pela API.

## Validação

- 173 testes unitários de API e web passaram (41 + 132). Os seis testes do novo
  componente passaram novamente após o ajuste visual final.
- 12 testes de integração/transporte passaram em banco PostgreSQL temporário,
  criado com as migrations atuais e removido ao final: progresso, criação/listagem,
  partes contratuais e HTTP/autorização.
- Lint e typecheck dos pacotes afetados, build de produção da web, quality gate dos
  testes alterados, limites de componentes, estilos e formatação dos arquivos
  alterados passaram. O quality gate terminou sem erros nem avisos contextuais.
- O lint de design sinaliza `text-micro` como se fosse uma cor. A classe é o token
  tipográfico existente em `packages/ui/src/styles/tokens/typography.css`; seu uso
  mantém a hierarquia dos detalhes secundários da tabela. Nenhuma regra foi desativada.
- Conferência no navegador da página real `/contratos`: desktop 1280 × 800 e
  viewport 375 × 812, temas claro/escuro, texto de dispensas/cancelamentos, estado
  vazio e barra em 0%, parcial e 100%. A página não apresenta overflow horizontal;
  a tabela mantém sua rolagem interna. Dados temporários de revisão foram removidos.
- O diff foi revisado e `git diff --check` passou.
- [Evidências visuais de antes/depois e mobile](evidence/README.md) foram capturadas
  na página real, com dados fictícios temporários e sem edição das imagens.

A suíte completa do monorepo, duplicação e mutação ficam para CI: os checks locais
foram limitados aos pacotes e contratos afetados. A evidência do agregado é de
integração com banco real; não foram criados mocks de consulta para aumentar
cobertura de mutação. O placeholder `test:e2e` não foi usado como evidência visual.
