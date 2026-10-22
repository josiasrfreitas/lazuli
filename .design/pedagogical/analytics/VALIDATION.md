# Visão financeira — #173

Recharts mostra cobranças por vencimento e caixa recebido por data de pagamento. O saldo vencido e suas quatro faixas são a posição atual de todos os anos; o seletor anual afeta fluxo e métodos. Liquidação usa apenas o valor ajustado das parcelas do ano com vencimento até hoje, evitando dividir receitas de coortes diferentes. Parcelas isentas e pedidos cancelados não geram cobrança; pagamentos registrados permanecem caixa, inclusive o saldo não alocado. Não há indicador de lucro sem despesas.

A leitura reutiliza o ledger de Recebíveis, em transação RepeatableRead. Períodos vazios têm meses com zero e um estado explícito nos meios de pagamento. Meses futuros não desenham recebimento como zero; a descrição identifica o mês atual incompleto.

Validação real: seed integrado de 250 alunos aplicado, acesso administrativo, três gráficos renderizados, navegação 2026 → 2025 sem recebimentos → 2026, detalhamento mensal e retorno à operação por Recebíveis. Desktop 1440px em claro/escuro e 390px em escuro; largura do documento igual ao viewport. Os valores detalhados permanecem acessíveis em tabela e legendas. Teste de integração escrito para datas civis, pagamento parcial, caixa não alocado, exclusões e corte temporal; sem execução local por orientação do usuário.

Em 10/10/2026, seed mostrou recebido de R$ 337.762,31, cobranças anuais de R$ 481.642,31 e saldo vencido de R$ 10.120,00 em 20 pagadores. Esses números são dinâmicos e não são fixtures fixas de produto.
