# P07 — Negociar outra quantidade de parcelas

Data: 25/09/2026. Status: implementado e validado localmente; gates completos no CI.
Evidências e limitações: [VALIDATION.md](VALIDATION.md).
Fonte: [issue #123](https://github.com/josiasrfreitas/lazuli/issues/123),
[brief](../DESIGN_BRIEF.md), [IA](../INFORMATION_ARCHITECTURE.md),
[decisões financeiras](../FINANCIAL_DECISIONS.md) e [plano do épico](../TASKS.md).

## Entrega

Um único PR entrega expansão do parcelamento especial, prévia, calendário completo,
gravação e síntese fiel na tabela. Os checkpoints abaixo pertencem à mesma fatia vertical.
Principal = duração em meses × mensalidade acordada; mudar a quantidade de parcelas
não muda esse principal nem o fim da vigência. A diferença de centavos fica na última parcela.

Dependência #121 está fechada e seu fluxo está presente nesta árvore. P06 também está presente.
O [registro posterior de P06](../p06/VALIDATION.md#vigência-a-partir-do-primeiro-pagamento)
documenta a escolha do usuário de usar primeiro pagamento como início e calcular duração pela
data final. Preservar esse formulário, sem restaurar os inputs antigos do brief.
O código atual valida o piso sobre a mensalidade acordada e lê pontualidade dos Ajustes;
P07 não altera essa negociação. Se for necessário mudar essas regras, resolver a divergência
com o dono antes do comportamento afetado.

## Evidências e pontos de alteração

| Local                                                   | Situação e ação proposta                                                                                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/monthly-contract.ts`               | Prévia gera uma parcela por mês de duração. Acrescentar quantidade opcional, mantendo cálculo do principal e `addCalendarMonths`.                                                                               |
| `packages/domain/src/installment-generation.ts`         | Já divide centavos com resto na última parcela, mas o gerador limita dias e deriva primeiro vencimento. Reutilizar somente a divisão monetária, extraindo-a se necessário; preservar os calendários existentes. |
| `packages/validators/src/contracts.ts`                  | Input estrito ainda não aceita quantidade. Acrescentar campo opcional sem default que altere o payload antigo.                                                                                                  |
| `packages/api/src/finance/internal/contracts.ts`        | Recalcula a prévia no servidor e persiste `installmentCount = durationMonths`. Passar quantidade ao domínio e persistir a quantidade efetiva.                                                                   |
| `packages/api/src/finance/internal/contracts-select.ts` | Já lê valores das parcelas, mas o DTO não descreve seus valores individuais. Expor síntese baseada no nominal persistido.                                                                                       |
| `packages/db/prisma/schema.prisma`                      | `Order.installmentCount` já é independente de `Contract.durationMonths`; nenhuma migration prevista. Conferir limites dos campos `Int` ao validar montantes.                                                    |
| `apps/web/src/features/contracts/`                      | Modificar modelo/estado, `PaymentSection` e coluna Plano. Reutilizar modal, campos de moeda/datas, tokens dark e primitivos existentes.                                                                         |

## Decisões antes do comportamento afetado

- [x] **Limitar quantidade à duração, confirmado pelo usuário em 25/09/2026.**
      `1 <= installmentCount <= durationMonths`, sempre inteiro. Assim, contrato de 12 meses
      aceita até 12 parcelas; 18 é inválido. O teto atual de duração de 120 meses também limita
      a quantidade possível. Ao reduzir a duração abaixo da quantidade especial já digitada,
      mostrar erro e pedir correção, sem alterar silenciosamente a negociação. Validar no
      domínio e na entrada do servidor, além do formulário. Conferir valores persistíveis
      nos campos monetários do banco. _Modifica: regras de entrada e mensagens._

## Checkpoints de implementação

- [x] **Criar e consultar um contrato com plano especial.** Acrescentar `installmentCount`
      opcional no input; ausência continua significando duração em meses. A prévia compartilhada
      divide o principal em centavos inteiros, com resto na última parcela, e calcula cada
      vencimento a partir da primeira cobrança original. Validar a quantidade também no domínio
      antes de alocar o calendário. O servidor recalcula usando condições autorizadas e grava
      contrato/pedido/parcelas na transação existente de `finance(db, staffUserId)`.
      No modal, expansão “Parcelamento especial” contém “Quantidade de parcelas” e prévia imediata;
      12 meses × R$ 250 com quantidade 3 mostra e grava 3 × R$ 1.000. A tabela deve exibir
      esse plano após criar e após recarregar. _Reutiliza: cálculo de vigência, divisão em centavos,
      Dialog, FormSection, Field e Input. Modifica: domínio, validator, criação, DTO e formulário._

- [x] **Conferir o calendário e os planos com centavos diferentes.** Disponibilizar expansão
      independente “Ver calendário completo”, com sequência, data e nominal de cada parcela,
      também no plano comum. Derivar a síntese dos valores reais: “3 × R$ 1.000,00” quando iguais;
      “3 parcelas · valores variáveis” quando diferentes, com os valores individuais no calendário da prévia
      (R$ 333,33, R$ 333,33 e R$ 333,34). Na tabela usar a síntese persistida, nunca mensalidade
      como valor da parcela nem total/quantidade arredondado como se todas fossem iguais.
      Distinguir mensalidade de referência dos valores das cobranças; não reutilizar
      `onTimeMonthlyCents` como valor em dia de toda parcela especial. Qualquer valor em dia
      exibido por cobrança usa o nominal daquela cobrança e a regra percentual existente.
      _Depende: cenário anterior. Reutiliza: tokens numéricos, formatadores e controles acessíveis.
      Modifica: PaymentSection, seleção/DTO e contract-columns. Cria: composição local do calendário._

- [x] **Voltar ao plano comum e corrigir erros sem perder a negociação.** Distinguir ativação
      do plano especial da expansão do calendário. Desativar o especial restaura quantidade
      derivada da duração e omite `installmentCount` do envio; proposta: preservar a quantidade
      especial em rascunho para reativação durante a sessão. Editar quantidade não altera datas,
      mensalidade ou partes. Recalcular ao editar duração/preço. Entrada vazia ou inválida produz
      erro associado ao campo, sem prévia antiga válida ou envio silencioso do plano comum.
      Não reportar quantidade inválida como erro de mensalidade. Preservar dados em falha do
      servidor, bloquear edição/submissão duplicada durante envio e resetar no cancelamento/sucesso.
      _Reutiliza: ciclo do modal e foco no primeiro erro. Modifica: modelo/estado e erros de criação._

- [x] **Preservar replay e atomicidade.** O novo campo participa do fingerprint quando enviado.
      Não inserir defaults na entrada antiga nem regravar fingerprints históricos. Repetição da
      mesma carga retorna o contrato original; mesmo comando com outra quantidade resulta em
      conflito. Verificar rollback e concorrência com a infraestrutura existente, incluindo
      criação inline de partes quando relevante. Manter bloqueios de recebimentos contratuais
      ainda incompatíveis, inclusive API/lote. _Reutiliza: transação, identidade de comando e
      recuperação de concorrência. Modifica: testes dos contratos afetados._

- [x] **Validar a experiência completa.** Conferir 1280 × 800 e viewport estreito, calendário
      longo com rolagem utilizável, teclado, foco, labels, erro anunciado, `aria-expanded` e
      retorno ao plano comum. Não introduzir modal aninhado. Preservar carregamento/falha/ausência
      de Ajustes pelos estados existentes; conferir prévia incompleta, submissão e sucesso. Exercitar
      criação real e leitura após recarregar; Storybook complementa a evidência.
      _Reutiliza: estados, tokens e componentes existentes. Modifica: composições da feature._

## Evidência de teste e gates

Carregar `ship-with-tests` ao iniciar código e seguir `docs/testing/README.md`.
Inspecionar e estender testes existentes antes de criar novas suítes.

| Camada                | Contrato e defeito que deve detectar                                                                                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domínio               | 12 × 25.000 centavos → principal 300.000, três parcelas de 100.000, vigência inalterada; 100.000 em três → `[33333, 33333, 33334]`. Soma exata, quantidade/sequência corretas; uma parcela; quantidade omitida; inválidos e limites definidos.                                         |
| Calendário            | 31/01 → 28/02 ou 29/02 → 31/03, sem deslocar o dia dos meses seguintes; primeira cobrança preservada.                                                                                                                                                                                  |
| Validators/modelo web | Input antigo continua igual; especial envia quantidade; retorno ao comum omite o campo; erro de quantidade fica no campo correto.                                                                                                                                                      |
| Integração Finance    | Criar pelo módulo real e consultar: duração/principal preservados, quantidade/valores/datas persistidos; síntese da consulta corresponde ao nominal, inclusive após ajustes/pagamentos. Retry não duplica; alteração de quantidade com mesmo comando conflita; falha desfaz gravações. |
| Transporte            | Adaptador real aceita/serializa quantidade, rejeita input inválido sem gravar e mantém autorização. Aproveitar cobertura existente sem repetir todos os cálculos.                                                                                                                      |
| UI                    | Síntese uniforme versus variável; calendário completo acessível; alternância, foco/erros e criação real seguida de leitura em desktop e viewport estreito. `test:e2e` atual é placeholder.                                                                                             |

Referências existentes: `monthly-contract.unit.test.ts`, `installment-generation.unit.test.ts`,
`contracts.integration.test.ts`, `contracts.transport.test.ts`, testes de pagador contratual e
`apps/web/test/features/new-contract-form-contract.unit.test.ts`.

Durante implementação executar testes direcionados por camada; antes de concluir, revisar diff
completo, `git diff --check`, formatação, lint/typecheck dos workspaces afetados e
`pnpm test:quality:changed --base <base>`. Executar os testes afetados em sequência com infraestrutura isolada;
o runner agregado pode ser usado quando paralelismo estiver autorizado. Rodar mutação aplicável às regras puras alteradas; investigar
sobreviventes relevantes. Build e demais gates completos seguem CI, registrando concretamente
quais não rodaram localmente e por quê.

## Limites

Sem edição/renegociação de contratos já gravados, parcelas com valores/datas manuais, nova
política de pontualidade, motor de juros, progresso/filtros, material ou conclusão do épico.
Este plano não autoriza migração de históricos. A conclusão exige os exemplos da issue
observáveis no app e no banco, além dos testes apropriados.
