# PR #207 — ficha `api-block6`

> **FECHADO:** bloco 6 API, 24 arquivos próprios, 100 erros removidos.
> Commit `a3d2d17` (`lint (bloco 6): resolver consultas e fluxos da API`).
> O lint direcionado terminou com **0 erros e 2 avisos**. O lint completo da
> API caiu de 230 para **130 erros**, sem novos fingerprints por
> arquivo/regra/mensagem. O lint da raiz confirmou os 130 erros restantes da
> API; o bloco 5 Web passou no lint completo separado com 0 erros.

- Inventário: os 24 caminhos da seção “Bloco 6” em
  [pr207-lint-progress.md](pr207-lint-progress.md). Nenhum outro arquivo de
  produto ou teste entrou no commit.
- Checks: typecheck API passou; 88/88 testes unitários passaram; integração
  específica de semestre 5/5 e suíte API completa 314/314 passaram em bancos
  temporários com migrações aplicadas e sem drift. Os bancos foram removidos.
- O gate `test:quality:changed --staged` terminou com 0 erros e 0 avisos.
  Prettier dos arquivos próprios e `git diff --check` passaram.
- `pnpm test:affected --staged` parou na fase unitária: o runner iniciou API e
  Web em paralelo, causando timeouts sob carga. A API isolada passou depois,
  e sua suíte completa de integração também passou. Não houve alteração no
  produto para contornar esse timeout.
- Snapshot API completo: `/tmp/lazuli-pr207-api-full-block6.json`; baseline:
  `/tmp/lazuli-pr207-api-full-after-students.json`. Os 130 erros restantes
  ficam fora do inventário do bloco 6; 15 avisos persistem na API completa.
