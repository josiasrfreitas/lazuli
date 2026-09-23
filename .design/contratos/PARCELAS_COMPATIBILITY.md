# Recebíveis — evolução de Parcelas para a vertical de Contratos

Refinamento: [decisões financeiras confirmadas](./FINANCIAL_DECISIONS.md). Pendências e
entregas futuras: [issue #115](https://github.com/josiasrfreitas/lazuli/issues/115).

Avaliação solicitada durante a fase 3 do design-flow, em 22/09/2026. Inspeção de código e
contratos de dados; não é revisão visual formal nem execução da aplicação. Nenhum código foi
alterado. A coluna de origem e a hierarquia dos valores foram confirmadas pelo usuário;
as demais recomendações e regras pendentes estão identificadas abaixo.

## Decisões confirmadas na IA

- O nome da página será **Recebíveis**, no título e na navegação. **Cobranças** fica reservado
  para um módulo futuro. O cabeçalho Parcela será substituído por **Sequência**, conforme
  confirmado, preservando valores como “3 de 12” e “1 de 1”.
  Labels das tabs passam a **Todos, Vencidos e Pagos** por concordância; referências abaixo
  a Todas/Vencidas/Pagas também descrevem a implementação atual, antes dessa mudança.
- Adicionar uma coluna própria de **Origem**, em Todas, Pagas e nas tabelas de Vencidas.
  A origem deve ser identificável diretamente, sem depender de tooltip ou navegação.
- Destacar saldo nas parcelas abertas e valor recebido nas pagas. Nominal e ajustes ficam
  como informações complementares. Isso não redefine cálculo de juros ou pagamento parcial.
- Preservar o agrupamento de Vencidas por pagador. Origem é informação de cada parcela;
  não dividir os grupos por tipo de cobrança.

Proposta de ordem: `Sequência · Origem · Pagador · Beneficiário · Vencimento · Valor · Situação`
em Todas/Pagas; em Vencidas, o pagador permanece no resumo e cada linha mostra
`Sequência · Origem · Beneficiário · Vencimento · Em aberto · Atraso`.

Vocabulário confirmado para Origem: **Multa**, **Mensalidade** e **Material**. O usuário definiu que
“Multa” é suficiente como rótulo. O cabeçalho do aluno será **Beneficiário**, no singular.
O valor vem da origem real da obrigação, retornada pela API; não inferir a origem pelo
valor, quantidade de parcelas ou nome do aluno. Multa e mensalidade precisam ser distinguidas
mesmo que ambas usem Order do tipo CONTRACT. A representação técnica dessa distinção ainda
é proposta no ER. Tipos históricos existentes também precisam de rótulos fiéis, sem renomear
registros para encaixá-los nas novas categorias. Isso não cria novos fluxos para esses tipos.

Nas tabelas de Vencidas, hoje os cabeçalhos são visualmente ocultos. Ao adicionar Origem,
garantir leitura inequívoca da coluna; a proposta é exibir o cabeçalho de cada tabela do grupo
com a mesma estrutura. Seu acabamento visual será verificado no build.

## Conclusão

A estrutura atual atende à consulta operacional: Todas e Pagas em tabela, Vencidas agrupada
por pagador, busca por pagador/beneficiário e paginação no servidor. Contratos individuais
continuam compatíveis com grupos de vários alunos de um mesmo pagador.

A tela não atende integralmente às novas regras sem evolução. Faltam identificação da origem
da cobrança e apresentação clara dos valores; juros, pontualidade e desistência também exigem
alterações no domínio e nas consultas. Não é necessário substituir a página por outra.

## O que preservar

- Todas, Vencidas e Pagas como perspectivas de consulta.
- Um grupo por pagador em Vencidas, com total, maior atraso e parcelas sempre visíveis.
- Na busca de Vencidas, mostrar a dívida vencida completa dos pagadores encontrados, como hoje.
- Separação entre o total vencido do grupo e obrigações futuras; nenhuma soma de futuras no
  total apresentado em Vencidas.
- Busca e paginação no servidor, estado na URL, estados de erro/vazio/loading e composição
  com `DataTablePage` e os primitivos existentes.
- Consulta sem ação geral de recebimento: criar esse fluxo continua fora do brief atual.

## Lacunas e ajustes recomendados

| Tema                   | Evidência atual                                                                                            | Consequência no novo modelo                                                                         | Recomendação                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Origem da cobrança     | DTO retorna `orderId`, mas não tipo, descrição ou referência de contrato                                   | Duas linhas “1 de 1” do mesmo aluno podem ser material, mensalidade ou multa, sem distinção visível | Coluna própria de Origem confirmada pelo usuário em todas as views                                                             |
| Valor nas views planas | A UI mostra sempre `originalAmountCents`; saldo secundário só aparece se há pagamento parcial              | Ajustes sem pagamento e desconto na quitação ficam ocultos na leitura do valor                      | Definir rótulos explícitos para original, recebido e saldo, conforme o estado                                                  |
| Pontualidade           | A consulta soma ajustes aplicados; não retorna condição contratual ou valor condicional em dia             | Antes do pagamento, o operador não conhece pela tela o benefício ainda aplicável                    | Mostrar a condição em dia como informação condicional, sem lançá-la como desconto já aplicado                                  |
| Juros                  | SQL da tela não calcula prévia; o domínio atual usa taxa mensal proporcional aos dias sobre saldo restante | A nova regra diária + mês completo sobre original não será atendida apenas mudando a UI             | Evoluir cálculo/DTO e definir data de referência; separar prévia de ajuste aplicado e evitar dupla contagem                    |
| Desistência            | A consulta exclui qualquer Order cancelado; o domínio zera seu saldo cobrável                              | Cancelar o pedido inteiro faria desaparecer cobranças anteriores devidas                            | Preservar vencidas, encerrar futuras abrangidas e identificar eventual multa; status de encerramento depende da regra a fechar |
| Beneficiário           | API usa lista de beneficiários por Order; agrupamento reúne todos os alunos do pagador                     | Novo contrato tem um aluno, mas grupos e dados anteriores podem ter vários                          | Mostrar singular nos novos compromissos; manter leitura correta dos históricos e plural no resumo do pagador                   |
| Linguagem da página    | Subtítulo “Mensalidades e vencimentos”, embora a consulta não filtre tipo de Order                         | Material e outras origens já podem aparecer como se fossem mensalidades                             | Usar subtítulo abrangente, como “Vencimentos e pagamentos”; reservar Cobranças para o módulo futuro                            |

O CPF/RG opcional fica no cadastro de pagador. Sua inclusão não exige nova coluna de documento
em Parcelas. Eventual uso na busca/desambiguação depende de necessidade de operação e não foi
adicionado automaticamente ao escopo.

## Exemplos que deixam a diferença visível

### R$ 250 quitados por R$ 230 no prazo

Com ajuste aplicado de −R$ 20 e alocação de R$ 230, o ledger existente já consegue derivar
saldo zero e status Paga. Entretanto, a tabela atual mostra R$ 250 como Valor, sem informar
os R$ 230 recebidos ou o desconto. Portanto, suporta o fato financeiro registrado, mas não
o explica na apresentação nem calcula automaticamente o direito à pontualidade.

Direção confirmada: em Pagas, destacar “Recebido: R$ 230” e permitir ler nominal e desconto aplicado.
Uma parcela ainda aberta deve distinguir “valor em dia” condicional de saldo já registrado.

### Parcela original de R$ 250 com R$ 30 de juros já aplicados

Sem pagamento, Todas mostra R$ 250; Vencidas mostra R$ 280 e variação líquida de R$ 30.
A diferença vem da apresentação: ambas recebem saldo e valores derivados. A prévia de juros
ainda não aplicada não entra nesses R$ 280 pela consulta atual.

Recomendação: as views precisam explicar qual valor mostram. Se exibirem total atualizado
para hoje, o servidor deve retornar essa composição e a data de referência. Não somar
novamente juros que já estão em ajustes. Após pagamento parcial, juros usam o saldo restante; detalhar alocação e períodos conforme
as decisões financeiras e a issue de organização.

### Dois irmãos, um pagador e desistência de apenas um contrato

O agrupamento atual por `payerId` é adequado e deve continuar reunindo as cobranças de ambos.
O encerramento precisa preservar as parcelas devidas do desistente e todas as obrigações do
outro aluno. Isso exige mudar a semântica do encerramento no motor; mudar só o badge não basta.

### Material quitado e mensalidade em aberto

A consulta atual já abrange Orders de material, pois não filtra o tipo. Sua apresentação não
mostra essa origem. A necessidade de distinguir cobranças independe dos campos da futura
entidade Material; a definição dessa entidade permanece adiada pelo usuário.

## Limites e decisões necessárias

- O registro de rompimento foi adiado pelo usuário para a futura página do contrato, em uma
  área de ações sensíveis. Não adicionar essa ação a Recebíveis ou à listagem de Contratos.
  A análise das regras de encerramento permanece como dependência da entrega futura desse fluxo.
- Fonte das partes confirmada: Orders contratuais obtêm pagador/beneficiário pelo Contract;
  Orders independentes têm referências próprias. A consulta atual faz join direto pelo
  `Order.payer_id` e lê `OrderBeneficiary`; busca, agrupamento, totais e retorno das linhas
  precisam usar a resolução efetiva de partes. A mesma regra vale para validar alocações de
  pagamento. Essa evolução pertence ao módulo Finance, não aos componentes de Parcelas.
- Nome confirmado: **Recebíveis**. Planejar a estratégia de URL preservando os links e filtros
  existentes em `/parcelas`. A escolha de título não renomeia entidades ou contratos de API.
- A hierarquia saldo nas abertas / recebido nas pagas está confirmada. Antes do build,
  detalhar apresentação complementar de original, ajustes, condição de pontualidade e prévia
  para uma data, além dos estados dispensados/encerrados.
- Pagamento parcial, prevenção de reaplicação de juros e data efetiva foram refinados nas
  decisões financeiras vinculadas acima. Alocação e períodos de cálculo ainda exigem detalhe;
  o corte da desistência permanece para a entrega futura.
- Não transformar “Dispensada” em sinônimo automático de encerrada por desistência. O estado
  final precisa representar o efeito financeiro real e seu motivo.
- Não adicionar navegação para contrato/aluno até a entrega da página unificada do aluno.
- Preservar os registros anteriores com múltiplos beneficiários; definir migração antes de
  mudar a cardinalidade dos consumidores.

## Evidências e validação futura

- [Página e subtítulo](../../apps/web/src/features/installments/installments-page.tsx).
- [Tabela plana](../../apps/web/src/features/installments/installments-table.tsx) e
  [formatação de valores/status](../../apps/web/src/features/installments/view-model.ts).
- [Agrupamento visual](../../apps/web/src/features/installments/overdue-payer-group.tsx) e
  [saldo/variação líquida](../../apps/web/src/features/installments/overdue-installment-amount.tsx).
- [DTO de parcelas](../../packages/validators/src/finance.ts) e
  [consulta SQL](../../packages/api/src/finance/internal/installments-query.ts).
- [Domínio financeiro](../../packages/domain/src/finance-ledger.ts).

Há testes de integração, transporte e apresentação para Parcelas. Na implementação futura,
estendê-los com os cenários acima e manter paridade entre SQL e domínio. Esta avaliação não
executou testes, pois alterou apenas documentação e não valida comportamento novo implementado.
