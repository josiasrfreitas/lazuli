# Revisão individual do tamanho dos PRs

Data: 2026-09-23. Revisão de planejamento, não revisão de código implementado.

Critério solicitado: cada PR deve entregar um comportamento verificável, incluindo dados,
API, interface e testes necessários. Dividir por cenário de uso; não por banco/backend/frontend.
Um PR pode atravessar vários pacotes e continuar coeso. Tamanho é estimativa de complexidade e
risco de revisão, não promessa de quantidade de linhas ou duração.

## Resultado por tarefa original

| Tarefa original                               | Cabe em um PR?                    | Motivo e decisão                                                                                                                                                                                                             | Plano revisado                           |
| --------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| T01 — Nome, rota e origem de Recebíveis       | Sim                               | Uma mudança de consulta: DTO, rótulos, coluna e compatibilidade de URL. Não introduzir tipos/migrations de contrato ou multa aqui                                                                                            | P01                                      |
| T02 — Valores de Recebíveis                   | Sim                               | Os valores nominal, esperado, pago e saldo já existem. Restringir ao significado e apresentação dos fatos registrados                                                                                                        | P02                                      |
| T03 — Ajustes e SYSTEM_ADMIN                  | Sim, com decisões fechadas        | Formulário pequeno, persistência e autorização formam uma capacidade completa. Provisionamento e matriz de acesso precisam estar decididos; excluir gestão de usuários e framework de permissões                             | P03                                      |
| T04 — Modal com prévia                        | Não como PR independente proposto | Storybook não conclui criação. Seleção, datas, cálculo e formulário devem ser revisados junto do caminho mensal real; retirar a separação artificial entre protótipo e submit                                                | P05, junto da parte de criação de T05    |
| T05 — Criar, migrar, adaptar Finance e listar | Não                               | Misturava alteração da origem das partes em leitores/pagamentos existentes, migração, nova escrita e nova tela. Separar compatibilidade de obrigações contratuais da criação do acordo mensal                                | P04 + P05                                |
| T06 — Pagador inline com CPF/RG               | Sim, condicional                  | Uma extensão da criação já existente. Migração aditiva preserva taxId sem classificação automática; saneamento, deduplicação ou remoção definitiva de legado exigiriam escopo próprio                                        | P06                                      |
| T07 — Parcelamento especial                   | Sim                               | Expansão de um fluxo existente, com a mesma regra no preview e na gravação; manter datas, principal e diferença na última parcela juntos                                                                                     | P07                                      |
| T08 — Progresso e situação                    | Melhor dividir                    | São duas perguntas independentes: quantas parcelas foram pagas e qual a condição financeira/vigência. Separar reduz o número de agregados e casos excepcionais por revisão                                                   | P08 + P09                                |
| T09 — Busca/filtros                           | Sim, condicional                  | Cabe se o contrato genérico já estiver entregue. Construí-lo junto transformaria a tarefa em outra iniciativa                                                                                                                | P10                                      |
| T10 — Financeiro em Novo aluno                | Sim, após dependências            | Reutiliza UI e operação de contrato já prontas; createStudent já recebe cliente transacional. Revisar inclusão no wizard e conclusão atômica juntas, sem criar saga ou refazer cadastro de aluno                             | P11                                      |
| T11 — Prévia de pontualidade e todos os juros | Não                               | Acumula regras diferentes e deixa a aplicação financeira para outro PR. Repartir por condição: pontualidade, atraso sem parcial anterior e evolução após pagamento parcial                                                   | P12 + P13 + P14, com a efetivação de T12 |
| T12 — Todos os caminhos de recebimento        | Não                               | Pagamento individual e reconciliação em lote têm caminhos próprios; o lote persiste diretamente e pode contornar as novas regras. Efetivar cada cenário junto da sua leitura e depois adaptar o lote com semântica explícita | P12 + P13 + P14 + P15                    |

Resultado: **15 PRs propostos**. Aumentar o número não é objetivo; P03, P06 e P11 continuam
inteiros porque cortá-los por camada criaria PRs menores, mas menos completos.

## Evidência local relevante

- `packages/api/src/finance/internal/installments-query.ts` consulta partes e beneficiários
  diretamente. A resolução não se resume a trocar o DTO da nova tela.
- `ledger-read.ts`, `student-balances.ts` e `payment-store.ts` também dependem das partes
  do Order; a inspeção local encontrou referências de pagador/beneficiário em nove arquivos
  internos de Finance. É necessário inventariar consumidores, incluindo os fora da pasta.
- `register-payment.ts` valida o pagador contra `installment.order.payerId`, bloqueia parcelas
  e chama `persistPayment`. A nova resolução deve preservar a proteção antes da nova criação.
- `batch-reconcile.ts` possui validação própria, calcula saldo e chama `persistPayment`
  diretamente. Não herda automaticamente o comportamento de `registerPayment`.
- `students/router.ts` já abre uma transação e `students/data.ts` recebe `database` em
  `createStudent`. Isso permite planejar a conclusão conjunta sem presumir coordenação distribuída.
- `apps/web/package.json` mantém `test:e2e` como placeholder. Não contar esse comando como
  validação da experiência; usar os testes por contrato existentes e verificar a UI de fato.

## Verticalidade e estado intermediário

P04 é a única fatia predominantemente habilitadora: torna obrigações contratuais legíveis e
corretamente atribuídas nos consumidores existentes. Inclui schema necessário, resolução,
consultas, proteção de operações ainda incompatíveis e testes. Não é um PR de tabelas vazias
seguido por PRs de repositories, services e controllers. Ainda assim, seus dados contratuais
serão demonstrados com cenários de integração até P05 disponibilizar a criação; isso não conta
como entrega do cadastro ao usuário.

P05 inclui modal, cálculo mensal, escrita e leitura básica reais. Storybook é evidência adicional.
P12–P14 incluem cálculo, validação, persistência atômica e resultado visível em Recebíveis para
cada cenário; não separam “motor pronto” de “interface pronta”. P15 integra outro caso de uso,
o lote existente, sem criar uma tela de recebimento.

Merge e liberação operacional são decisões distintas. Etapas contratuais podem ser revisadas
em PRs dependentes, mas não devem expor publicamente cenários que ainda aplicam regras antigas.
Definir mecanismo de entrega antes de P04: restrição explícita de novas operações/rota, ou
integração conjunta antes da liberação. Não basta esconder botão: API e lote precisam respeitar
os limites. Preservar operações legadas e não inferir termos para históricos.

Não introduzir um framework de flags para esta divisão. Se não houver forma simples de manter
um estado intermediário seguro, revisar a fronteira desses PRs antes de implementar.

## Pontos que ainda limitam a estimativa

Provisionamento do papel, migração histórica, denominador do progresso, distribuição entre
principal/encargos, arredondamento e pagamentos informados retroativamente precisam de definição
conforme #115. O calendário já tem decisões confirmadas; as lacunas restantes não autorizam
reabri-las. A reconciliação atual calcula o valor a pagar: fechar como aplica desconto e encargos
com a data efetiva, sem presumir que saldo registrado equivale ao valor de quitação.

Se uma decisão exigir migração destrutiva, saneamento amplo ou reprocessamento de histórico,
esse trabalho não cabe implicitamente nos PRs acima. Voltar ao dono para delimitar o requisito,
preservando o recorte vertical sempre que possível.
