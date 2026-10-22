# PR #207 — ficha `api-block8`

> **FOCO:** 31 erros em 21 arquivos próprios, congelados em
> [progresso](pr207-lint-progress.md): 30 erros em 20 arquivos da API e 1 em
> `scripts/imports/teaching-program.ts`. Worktree limpa no início, HEAD
> `eb9cb61`. Medição atual: **30 erros**, todos na API; o script passou no
> lint direcionado com 0 erros e 1 aviso. Próxima ação: zerar as áreas da API
> e seus testes. Gate: lint direcionado 0, typecheck e
> testes pertinentes, lint API completo sem novos fingerprints e lint da raiz
> verde. Baselines: `/tmp/lazuli-pr207-api-full-block7.json` e
> `/tmp/lazuli-pr207-root-after-block7.log`.

- Coordenação, handoff, progresso, fichas dos blocos 6 e 7, skill de lint,
  `AGENTS.md`, status e HEAD lidos antes da edição. Não há outro agente ativo.
- O lint da raiz após o bloco 7 falhou no script de importação por argumento
  `any` de `JSON.parse` passado à assinatura tipada de `importTeachingProgram`.
  A API completa foi medida separadamente: 30 erros, 0 novos fingerprints
  frente ao baseline do bloco 7. O script foi reservado na coordenação antes
  de qualquer edição.
- `scripts/imports/teaching-program.ts` agora valida o JSON com
  `teachingProgramImportSchema` antes de chamar a importação tipada. Lint
  direcionado: 0 erros, 1 aviso de caminho de arquivo dinâmico preexistente.
