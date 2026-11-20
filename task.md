# Leads — origem, importação por planilha e duplicidade de telefone

## Objetivo e ponto de retomada

Entregar no Lazuli três melhorias no cadastro de Leads: selecionar a origem em um enum com a opção **Outro**, importar leads por planilha e impedir que o mesmo telefone gere dois cadastros. Este documento registra o trabalho a implementar após a limpeza de contexto. A branch observada foi `feat/catalogo-estagios` e já contém alterações de exportação e edição de estágios. Conferir o estado do Git ao retomar e preservar o trabalho existente.

| Issue                                                                                   | Entrega                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#308 — telefone duplicado](https://github.com/josiasrfreitas/lazuli/issues/308)        | Avisar a equipe e impedir a duplicação no cadastro manual e na importação. Cobrir também a edição que tenta atribuir a um lead o telefone de outro.                                                                                                       |
| [#309 — origem do lead](https://github.com/josiasrfreitas/lazuli/issues/309)            | A decisão desta conversa é usar enum com **Outro**. A issue original também pede opções cadastráveis pelo master em Parâmetros. Esse requisito difere da decisão atual. Registrar a mudança de escopo antes de considerar a issue integralmente atendida. |
| [#312 — importar e exportar leads](https://github.com/josiasrfreitas/lazuli/issues/312) | A exportação de Leads em XLSX já foi implementada na frente de exports. Falta implementar a entrada por planilha e validar o fluxo completo.                                                                                                              |

## Comportamento atual confirmado

- `apps/web/src/features/admissions/lead-capture-fields.tsx` e `candidate-fields.tsx` editam a origem como texto livre. `lead-context.tsx` apresenta esse texto na ficha.
- `packages/db/prisma/schema.prisma` guarda origem e telefone em `AdmissionCandidate.source` e `phone`, ambos opcionais. Os validadores de admissões já exigem pelo menos telefone ou e-mail. Preservar o cadastro somente com e-mail.
- `packages/api/src/admissions/router.ts` expõe dois caminhos de escrita, `capture` e `save`. Examinar `capture.ts` e `candidates.ts` antes de alterar a persistência. O campo `deduplicationKey` do registro de atividade de captura usa o ID do lead e não garante unicidade do telefone.
- A planilha de Leads implementada pelo worker em `packages/worker-handlers/src/exports/listings.ts` contém nome, telefone, e-mail, interesse, estágio, formato, status e cadastro. Considerar a compatibilidade dos cabeçalhos e a inclusão da origem ao definir o formato de importação.

## 1. Origem padronizada

- Usar a mesma definição de origem no cadastro rápido, na edição, na ficha, na validação da API e na importação. Apresentar rótulos em português. A lista exata de opções ainda não foi escolhida. Levantar as origens existentes antes de fechar o enum. Instagram, indicação e pesquisa no Google são exemplos para avaliar.
- **Proposta para Outro:** exibir “Qual origem?” quando selecionado, guardar o detalhe e mostrá-lo na ficha. Ao trocar para uma opção padronizada, limpar o detalhe anterior. Manter possível deixar a origem em branco.
- Criar uma migração nova. Mapear textos históricos de correspondência inequívoca para o enum. Preservar textos desconhecidos como Outro com o detalhe original e preservar valores vazios. Revisar exemplos legados antes do backfill.

## 2. Impedir duplicação pelo telefone

- Reutilizar a normalização de telefone do projeto quando compatível. Deduplicar o número completo com DDD. Espaços, parênteses e hífens não devem distinguir leads. Testar também a equivalência entre o formato nacional brasileiro e o mesmo número com +55. Preservar DDDs distintos e o comportamento de números internacionais aceitos.
- Aplicar a regra no servidor a todos os caminhos de criação e alteração, incluindo a importação. Garantir unicidade também sob concorrência no PostgreSQL. Uma consulta prévia só serve para antecipar o aviso.
- Permitir que um lead mantenha seu próprio número na edição. Telefones ausentes não devem conflitar entre si. Arquivados e matriculados continuam sendo registros existentes. Verificar a política de exclusão lógica ao definir o índice.
- Antes de aplicar a restrição, verificar colisões nos dados históricos com a mesma normalização proposta. Se houver colisões, identificar os registros afetados para saneamento pelo responsável. Preservar histórico e vínculos; fusão ou exclusão automática exigem uma decisão específica.
- Em conflito, mostrar uma mensagem em português e preservar os dados preenchidos. Na planilha, indicar a linha afetada e distinguir repetição no próprio arquivo de telefone já cadastrado.

## 3. Importação por planilha

- Adicionar a ação **Importar planilha** na página de Leads, respeitando as permissões da operação de cadastro. O formato ficou delegado. Sugestão inicial: XLSX, com modelo acessível pela própria tela e colunas identificadas por cabeçalho.
- Documentar no modelo os campos mínimos aceitos pela captura atual, os opcionais e os valores permitidos. Tratar telefones como texto. Reusar as regras de cadastro para nome, contato, origem e demais campos suportados. Definir explicitamente como ler a aba de dados de um arquivo exportado pelo Lazuli, que também contém uma aba Filtros.
- **Fluxo proposto:** selecionar o arquivo, validar cabeçalhos e linhas, apresentar quantidades e motivos por linha, confirmar a gravação das válidas e exibir o resultado final. Uma linha duplicada nunca deve sobrescrever silenciosamente um lead existente. Repetir a confirmação ou reprocessar um job não deve criar novos cadastros, inclusive para linhas somente com e-mail.
- Validar conteúdo, tamanho e quantidade de linhas antes do processamento pesado. Escolher limites de acordo com o volume suportado e comunicá-los na tela. Testar arquivo vazio, inválido e planilha com linhas válidas, inválidas e repetidas misturadas.
- Seguir a fronteira já usada para arquivos: processamento pesado no worker, arquivo privado, metadados no PostgreSQL e identificador mínimo no Hatchet. Restringir acesso ao resultado e evitar nome, telefone, e-mail e conteúdo de células nos logs. Ao finalizar, atualizar a listagem preservando seus filtros.

## Ordem de implementação e verificação

1. Ler o AGENTS.md do repositório, o guia de frontend e as regras atuais de admissão. Inventariar os caminhos de gravação, as opções históricas de origem e as colisões de telefone.
2. Entregar enum, compatibilidade com dados anteriores e deduplicação no banco e na API. Exercitar cadastro e edição com número equivalente, número próprio e telefone vazio. Testar duas criações simultâneas para o mesmo telefone.
3. Implementar a importação sobre essas mesmas regras. Testar repetição entre linhas, conflito com registros existentes, reenvio após falha e captura manual simultânea à importação. Conferir que os totais apresentados correspondem ao que foi gravado.
4. Validar no navegador cadastro, edição, Outro, upload, retorno por linha e atualização da listagem. Conferir um XLSX real e os fluxos de acesso e falha. Rodar os testes focados, revisar o diff e executar `git diff --check`. O usuário pediu **sem lint** nesta sessão.
