# P06 — Criar pagador dentro da contratação

Fonte: [issue #122](https://github.com/josiasrfreitas/lazuli/issues/122),
[brief](../DESIGN_BRIEF.md) e [plano do épico](../TASKS.md).
Data: 24/09/2026. Status: implementação e validação local concluídas; PR/CI em acompanhamento.

## Entrega e evidências

Um único PR entrega cadastro inline de pagador, documento CPF/RG opcional e contatos,
gravados com o contrato mensal. O operador continua podendo selecionar um pagador existente.
As etapas abaixo são checkpoints do mesmo PR, não entregas separadas por camada.

A dependência #121 está fechada e P05 está presente nesta árvore:

- `packages/validators/src/contracts.ts` aceita apenas `payerId`.
- `packages/api/src/finance/internal/contracts.ts` valida as partes, preserva condições e grava
  contrato, pedido e parcelas. `contractFingerprint` calcula SHA-256 do JSON da entrada.
- `packages/api/src/finance/router.ts` possui autorização administrativa, transação e recuperação
  do resultado após corrida de comandos concorrentes.
- `packages/db/prisma/schema.prisma` mantém `Payer.taxId` sem tipo, telefone e email opcionais.
- `packages/validators/src/finance.ts` já tem seleção/criação de pagador para pedidos independentes;
  preservar esses consumidores ao acrescentar documentos tipados.
- `apps/web/src/features/contracts/` contém modal, prévia e busca reais. `PartyPicker` mantém
  busca e nome selecionado em estado local; desmontá-lo perde essa apresentação.
- Alunos já usa tipo CPF/RG, número opcional e exige tipo quando existe número. Não há autorização
  nesta issue para acrescentar validação de dígitos verificadores ou deduplicação documental.

Respeitar ADRs 0007 (pagador separado de responsável), 0010 (padrão de documentos) e 0018
(`finance(db, staffUserId)`, autorização e transação no tRPC). Não alterar regras financeiras de P05.

## Sequência de execução

- [x] **Fechar o desenho de compatibilidade antes do comportamento afetado.** Proposta: adicionar
      `documentType` e `documentNumber` anuláveis a `Payer`, reutilizando o enum CPF/RG existente,
      e conservar `taxId` como dado legado sem tipo. Uma migration nova e aditiva não copia,
      classifica, normaliza nem apaga históricos. Novos documentos tipados usam apenas os novos
      campos. Impor número → tipo também no banco; manter o comportamento de Alunos para tipo
      sem número. Sem unicidade por nome/documento. Inventariar leitores/escritores de `taxId`,
      incluindo criação de pagador/pedido, seeds e DTOs. Registrar a escolha de compatibilidade
      no work item antes da implementação; se surgir conflito com requisito/ADR, consultar o dono.
      _Modifica: Payer e migration. Reutiliza: enum e regra de documentos de Alunos._

- [x] **Entregar o cenário completo “Cadastrar novo pagador”.** Adicionar ao contrato uma
      alternativa exclusiva de entrada para novo pagador: nome obrigatório, documento opcional,
      telefone e email opcionais. Preservar a entrada existente com `payerId`, inclusive sua
      serialização usada pelo fingerprint; rejeitar entradas com ambos os caminhos ou nenhum.
      Compartilhar validação de documentos sem importar o formulário de Alunos nem modificar
      silenciosamente o contrato legado de `taxId`. Não acrescentar regras de contato mais fortes
      que as existentes sem requisito. No servidor, consultar comando prévio primeiro, validar
      aluno/condições, criar pagador com autoria e gravar contrato/pedido/parcelas na mesma transação.
      Resolver o novo ID sem alterar o payload original usado para idempotência. No modal,
      acrescentar “Buscar existente” / “Cadastrar novo” na seção de partes, campos e erros
      associados; enviar uma única criação de contrato. Cancelar não grava pagador.
      Verificar criação sem documento e com CPF/RG, seguida de consulta real do contrato.
      _Depende: compatibilidade. Reutiliza: Dialog, FormSection/FormRow, Field, Input, Label,
      FieldError e SegmentedControl. Modifica: validators, Finance, estado/modelo/modal.
      Cria: seção local de campos do pagador, se necessária para manter componentes pequenos._

- [x] **Concluir alternância e reutilização entre contratos.** Manter separadamente o rascunho
      do novo pagador e a seleção/busca existente, incluindo nome visível. Elevar o estado necessário
      do picker ou preservá-lo montado; não deixar ID selecionado com campo aparentemente vazio.
      Validar e enviar somente o modo ativo. Preservar rascunho e identidade do comando em erro
      e retry; resetar ao fechar/cancelar ou concluir, conforme P05. Atualizar/invalidate a busca
      após sucesso para encontrar o novo pagador ao contratar para o segundo irmão. Homônimos
      permanecem registros distintos, selecionados por ID; não inferir identidade por nome,
      documento ou responsável do aluno. Se necessário, apresentar contato/documento tipado
      como informação secundária na busca para distinguir opções, sem chamar `taxId` de CPF.
      _Reutiliza: PartyPicker e busca de partes. Modifica: estado do formulário/picker e cache._

- [x] **Provar falhas e retries do fluxo completo.** Uma falha depois de criar o pagador deve
      desfazer pagador, contrato, pedido e parcelas. Repetir a mesma carga após resposta perdida
      retorna o mesmo contrato/pagador; submissões concorrentes com mesmo comando deixam uma
      única árvore persistida. Mesmo comando com dados diferentes, inclusive contatos/documento
      ou modo, resulta em conflito sem efeitos adicionais. Preservar replay de comandos P05 já
      persistidos: não regravar fingerprints históricos nem introduzir defaults na entrada antiga
      que mudem seu hash. Erros mantêm formulário editável; durante envio impedir submissão dupla
      e alterações que tornem incerta a carga em andamento. Preservar bloqueios dos demais cenários
      financeiros ainda não suportados.
      _Reutiliza: comando, recuperação de concorrência e testes P05. Modifica: tratamento dos novos campos._

- [ ] **Verificar interação e concluir o PR.** Cobrir busca carregando/vazia/com erro, erros de
      campo/servidor, envio e sucesso. Conferir teclado, foco no primeiro erro, labels/descrições,
      alternância acessível e ausência de overflow em 1280 × 800 e viewport estreito. Usar tokens
      dark existentes e texto pt-BR. Storybook apoia estados; exercitar também o app real com banco.
      _Reutiliza: tokens, componentes e infraestrutura de testes existentes._

## Evidência de teste

Aplicar `ship-with-tests` e `docs/testing/README.md` desde o início. Contrato protegido:
uma intenção de contratação grava todas as entidades uma única vez, preserva identidades e não
atribui um tipo inventado aos documentos antigos. Defeitos plausíveis: pagador órfão, duplicação
no retry, fusão de homônimos e perda de rascunho. Os resultados esperados vêm do aceite de #122.

| Camada                 | Evidência necessária                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unidade — validators   | Nome obrigatório; documento ausente válido; CPF/RG explícitos; número sem tipo inválido; modo exclusivo; contatos opcionais; entrada P05 preservada.                                                               |
| Unidade — formulário   | Alternância conserva ambos os rascunhos e seleção visível; somente modo ativo vira payload; erros aninhados chegam aos campos corretos. Exercitar lógica de produção, não cópia do reducer.                        |
| Integração — banco/API | Documento e contatos persistidos; autoria; irmãos com mesmo payerId e contratos distintos; homônimos com IDs distintos; rollback após escrita; replay e conflito; invariantes da migration e taxId legado intacto. |
| Transporte — tRPC real | Criar novo pagador com contrato e consultar; autorização negada sem gravação; concorrência passa pela recuperação do router e não deixa pagadores extras. Reutilizar cobertura P05 sem repetir matrizes unitárias. |
| UI real                | Alternar modos, corrigir erro, cancelar sem criar, concluir e buscar o pagador no contrato do irmão; desktop, viewport estreito e teclado. O test:e2e placeholder não vale como evidência.                         |

Estender testes em `packages/validators/test/contracts.unit.test.ts`,
`packages/api/test/finance/contracts.integration.test.ts`, `contracts.transport.test.ts` e
`contract-parties.integration.test.ts`, além dos testes de formulário em `apps/web/test/features/`.
Criar testes de migration em `packages/db/test/schema/` quando necessários. Os testes atuais
de markup não comprovam alternância interativa; acrescentar evidência comportamental apropriada.
Preservar identificadores históricos/fixtures existentes e isolar os novos cenários.

Executar testes afetados com banco isolado, formatação, lint/typecheck dos workspaces afetados,
`pnpm test:quality:changed --base <base>`, verificação de migration/drift e `git diff --check`.
Inspecionar o diff completo. CI completa build, suites e mutation conforme o guia; reportar
explicitamente qualquer verificação local pendente e seu motivo.

## Limites

Sem saneamento ou backfill de documentos, deduplicação, vínculo com Guardian, cadastro separado
antecipado, parcelamento especial, integração em Novo aluno ou implementação das próximas issues.
Web não importa Prisma. Dados pessoais ficam no banco; este fluxo não precisa de Hatchet.
O PR referencia/conclui apenas #122 e não encerra #116. O plano não altera o estado das issues.

## Ajuste solicitado durante implementação

Contratos havia divergido de Alunos e Recebíveis no cabeçalho, densidade e composição da tabela.
A correção usa essas telas como referência: `DataTablePage` recebe título/resumo e compõe o
cabeçalho; `DataTable` recebe colunas, dados, estado e paginação e compõe os primitives existentes.
A página não escolhe densidade, altura, padding ou markup de linhas. As tabelas de Alunos e
Recebíveis conservam suas interações existentes. Contrato público em
[docs/frontend/data-tables.md](../../../docs/frontend/data-tables.md).

[Evidências de validação](VALIDATION.md).
