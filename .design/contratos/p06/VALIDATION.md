# P06 — Validação local

Executada em 24/09/2026, com workspace completo e `pnpm seed:contracts`.

- Validators: 117 testes passando; Web: 106; UI: 7.
- Integração/transporte afetados: 10 testes passando em banco temporário, com deploy das migrations
  e verificação de drift. Inclui rollback, concorrência, replay, autorização, homônimos e legado.
- Typecheck de DB/API/validators/UI/Web/Storybook passou. Lint dos arquivos alterados passou
  com avisos contextuais; lint completo e demais gates serão executados pelo CI.
- Navegador real: alternância mantém seleção e rascunho; validação foca CPF/RG; criação permite
  encontrar o novo pagador. Resposta perdida após commit seguida de retry deixa exatamente um
  pagador e um contrato. Cancelar o rascunho não grava nenhum dos dois.
- Desktop 1280 × 800: Alunos e Contratos têm cabeçalho da página de 30 px, cabeçalho da tabela
  e linhas de 48 px, padding horizontal de 20 px. A tabela compartilhada define densidade,
  largura mínima das colunas, estados e paginação. A página fornece conteúdo e dados.
- Evidência visual em [evidence](evidence/): formulário desktop/mobile e comparação das tabelas.

Os testes de tipo rejeitam overrides de densidade, estilo da tabela e estilo da paginação.
Testes de renderização cobrem dados, skeleton, erro, vazio e busca sem resultados. Stories
documentam esses estados; seus plays ainda não foram executados localmente.

Build, suites completas e mutation ficam no CI para evitar carga redundante na máquina local.
A repetição de lint completo foi interrompida a pedido do usuário; os testes e typechecks já
haviam concluído. A migration é aditiva e não classifica nem altera `taxId` histórico.

## Acompanhamento do CI

Primeira execução: validators alcançou 93,07%, mas oito mutações de schemas discriminados
antigos em `student.ts` impediram a importação do módulo. A exportação de um helper incluiu
esse arquivo inteiro no escopo. Correção 1: retirar a alteração de Alunos e usar apenas seu
enum/mensagem públicos na regra de documento do novo pagador. Nenhum gate ou configuração de
mutação foi alterado. Os cinco sobreviventes de Contratos apontavam normalização documental
e caminhos/mensagens de erro; os testes agora verificam esses contratos explicitamente.
