# P07 — Validação

25/09/2026 · issue [#123](https://github.com/josiasrfreitas/lazuli/issues/123).

## Resultado observado

- Contrato de 12 meses, mensalidade R$ 250: principal R$ 3.000, três parcelas de R$ 1.000;
  vigência de 31/01/2026 até 31/01/2027 preservada.
- Contrato de quatro meses, mensalidade R$ 250: principal R$ 1.000, parcelas R$ 333,33,
  R$ 333,33 e R$ 333,34; vigência até 31/05/2026 preservada.
- Ambos criados pelo app e relidos após recarregar. Consulta ao banco confirmou
  `durationMonths / principalAmountCents / installmentCount / valores`:
  `12 / 300000 / 3 / [100000,100000,100000]` e
  `4 / 100000 / 3 / [33333,33333,33334]`.
- Quantidade 13 em contrato de 12 meses impede criação, mantém o rascunho e foca o campo com
  `aria-invalid` e descrição do erro. Retorno ao comum restaura quatro parcelas de R$ 250;
  reativar especial recupera a quantidade digitada.
- Tab/Enter permitem abrir o parcelamento avançado; o calendário aparece junto da prévia,
  sem segundo botão. Foco visível.
  Mobile real emulado de 375 × 812, sem overflow horizontal da página; criação concluída.
- Na captura anterior de 120 parcelas, a área tinha 254 px de altura e 4.199 px de conteúdo;
  a rolagem chegou à parcela 120 em 31/12/2035. O mesmo contêiner agora aparece junto da
  prévia do parcelamento avançado.
- A inspeção visual encontrou sobreposição da coluna Plano com Vigência. Corrigida com
  largura padrão e quebra de linha; print final conferido.

## Prints reais do app

Dados de fixtures locais. Sem montagem ou edição dos prints. Desktop 1280 × 800.
O antes foi capturado restaurando temporariamente apenas `PaymentSection` do HEAD anterior;
o arquivo implementado foi restaurado antes dos checks finais. Os prints da prévia registram
a versão anterior aos últimos ajustes visuais; o usuário está conferindo a interface atual.

| Evidência                           | Arquivo                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| Antes: plano comum                  | [Desktop](evidence/before-common-plan-desktop.png)              |
| Depois: três parcelas de R$ 1.000   | [Desktop](evidence/special-plan-desktop.png)                    |
| Resto de centavos na última parcela | [Desktop](evidence/variable-plan-desktop.png)                   |
| Quantidade acima da duração         | [Erro e foco](evidence/quantity-limit-desktop.png)              |
| Plano variável em 375 × 812         | [Mobile](evidence/variable-plan-mobile.png)                     |
| Contratos persistidos após reload   | [Tabela corrigida](evidence/contracts-after-reload-desktop.png) |
| Rolagem até a parcela 120           | [Calendário longo](evidence/long-calendar-desktop.png)          |

## Checks locais

Execuções finais sequenciais, conforme pedido. Nenhum timeout de teste foi aumentado.

- Unitários: domínio 108, validators 131 e web 125 aprovados.
- Integração/transporte: 13 aprovados, nas suítes `contract-payers.integration`,
  `contracts.integration`, `contract-payers.transport`, `contracts.transport`, uma por vez.
  Banco temporário criado pelos helpers de `scripts/lib/ephemeral-test-database.mjs`,
  migrations aplicadas e banco removido no `finally`. Protegem persistência, rollback,
  replay/conflito, leitura derivada, HTTP e autorização.
- Typecheck dos quatro workspaces da feature, de UI e de Storybook aprovado.
- Lint dos arquivos alterados aprovado; warnings de estilo já presentes no padrão da UI.
- Gate prospectivo de testes: zero erros e zero warnings contextuais.
- Formatação e `git diff --check` aprovados.
- Mutação do domínio: **94,78%** (127/134); `monthly-contract.ts` e
  `installment-amounts.ts`: **100%**. Mutação de `contracts.ts` nos validators:
  **92,65%** dos cobertos (63/68; cinco sem cobertura excluídos pelo gate).

Comandos principais, executados individualmente:

```sh
pnpm --filter @lazuli/domain test
pnpm --filter @lazuli/validators test
pnpm --filter @lazuli/web test
pnpm --filter @lazuli/domain mutate --mutate src/monthly-contract.ts,src/installment-amounts.ts,src/installment-generation.ts --concurrency 1
pnpm --filter @lazuli/validators mutate --mutate src/contracts.ts --concurrency 1
pnpm test:quality:changed --base HEAD
```

### Revisão dos sobreviventes

As duas lacunas relevantes no domínio (zero à esquerda no dia e teto da mensalidade) ganharam
assertivas e deixaram de sobreviver. No gerador antigo restam sete mutantes fora da divisão
extraída: quatro textos/código de erro históricos; validação de dia duplicada em
`deriveFirstDueDate`; leitura de `day` não consumida; cálculo do último dia equivalente para
vencimentos limitados a 5/10/15/20/25. Sem mudança nesses comportamentos nesta fatia.

Nos validators: retirar `!== undefined` é equivalente porque `undefined > duração` é falso;
texto do erro é coberto pelo transporte, não pelo runner unitário de mutação; três mutantes
restantes são da exclusividade histórica de aluno existente/novo, fora da alteração de quantidade.
Não se enfraqueceu teste ou gate para obter aprovação.

## Limitações e CI

Build de produção, lint completo, duplicação, suíte global e mutação completa da API ficam
para CI: localmente foram priorizados os contratos alterados e validação real da interface,
sem multiplicar processos. Não houve ensaio manual de falha de rede/Ajustes indisponíveis;
os estados existentes foram preservados e a suíte web passou.

Execuções iniciais sofreram instabilidade com três servidores Next antigos concorrendo por
recursos. Foram encerrados conforme autorização do usuário; a repetição isolada passou.
O servidor desta tarefa usa a porta 3017. Nenhuma mudança no GC foi incluída.

Sem migration ou reescrita de contratos históricos. Um rollback de código não apaga parcelas
já criadas; a UI anterior perde a síntese fiel dos planos especiais persistidos.

Os últimos ajustes visuais solicitados pelo usuário removeram títulos intermediários, colocaram
o calendário dentro da expansão e introduziram a variante `text` do botão compartilhado.
Foram verificados por testes, lint e typecheck; a validação visual atual está com o usuário.

O campo “Mensalidade acordada” recebe como sugestão inicial o teto de mensalidade dos Ajustes
quando a proposta é carregada. Um valor digitado ou apagado manualmente é preservado; ao
reabrir o formulário, o valor configurado é sugerido novamente. Teste web, lint e typecheck
direcionados passaram para essa alteração.
