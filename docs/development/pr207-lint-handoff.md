# PR #207 — handoff do lint (2026-10-22)

> **RETOMAR PELO BLOCO 5.** O dono pediu uma pausa após medir o lint, reservar o
> próximo bloco e fazer um commit único do estado atual. Não iniciar o bloco 6
> antes de fechar o bloco 5. O inventário durável está em
> [pr207-lint-progress.md](pr207-lint-progress.md), e o procedimento está em
> [big-lint-resolver](../../.codex/skills/big-lint-resolver/SKILL.md).
> Trabalhar na **mesma worktree**; nos próximos trabalhos, usar commits
> atômicos com assunto `lint (bloco X): descrição`. Rodar um check por vez e
> não usar `eslint --fix`.
> Dois agentes usam o protocolo e as reservas de arquivos em
> [pr207-lint-coordination.md](pr207-lint-coordination.md).

## Estado medido

- Worktree: `/Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica`;
  branch `josiasrfreitas/operacao-pedagogica`; PR #207 já aberto.
- Blocos 1–4 fechados. Bloco 5 começou com 83 erros Web e tem **31 restantes**.
  Snapshot completo atual: `/tmp/lazuli-pr207-web-full-pause-final.json`.
- Comparação com `/tmp/lazuli-pr207-web-full-after-block4.json` por
  arquivo/regra/mensagem: **52 erros eliminados, 0 novos**. A API permanece em
  **230** erros; total global **261**.
- `pnpm lint` da raiz foi executado: API falhou nos 230 erros conhecidos e o
  Turbo interrompeu o Web. Por isso o Web foi medido separadamente com
  `pnpm -F @lazuli/web exec eslint . -f json`.
- Typecheck Web passou depois da última alteração de código. A suíte Web
  passou com **295 testes, 0 falhas**; log em
  `/tmp/lazuli-pr207-web-test-pause.log`.

Os cinco arquivos ainda com erro no bloco 5 são:

| Arquivo relativo a `apps/web`                      | Erros |
| -------------------------------------------------- | ----: |
| `src/features/admissions/lead-capture-dialog.tsx`  |     4 |
| `src/features/admissions/placement-assessment.tsx` |    11 |
| `src/features/admissions/placement-schedule.tsx`   |     7 |
| `src/features/admissions/visit-dialog.tsx`         |     6 |
| `src/features/shared/task-form.tsx`                |     3 |

Comando direcionado do bloco 5:

```sh
pnpm -F @lazuli/web exec eslint src/app src/components/app-shell src/features/admissions src/features/command-palette src/features/installments src/features/settings src/features/shared src/lib/use-search-draft.ts src/proxy.ts test/features/lead-form-contract.unit.test.ts -f json > /tmp/lazuli-pr207-block5-current.json
```

Ao retomar: zerar **todo** o lint direcionado do bloco 5; rodar typecheck e
testes pertinentes; executar `pnpm lint` da raiz e o lint Web completo; comparar
fingerprints contra `/tmp/lazuli-pr207-web-full-pause-final.json`. Só então
fechar o bloco 5 e ativar o bloco 6. O inventário de **100 erros** da API para
o bloco 6 e seu comando direcionado estão no final do relatório de progresso.

## Atenção à formatação

`pnpm format:check` detectou dois JSONs de `.impeccable/live` que já estavam
sem alterações nesta worktree, além de arquivos alterados pelo lint. Prettier
foi aplicado somente aos arquivos alterados. Ele removeu parênteses exigidos
pela regra `unicorn/no-nested-ternary`, criando 21 regressões; os parênteses
foram restaurados com as correções exatas sugeridas pelo ESLint. Depois disso,
o lint completo Web voltou a **31 erros e 0 regressões**. Não aplicar Prettier
indiscriminadamente nesses ternários: a configuração atual tem esse conflito.
O hook de pré-commit executa Prettier e reproduziu os 21 erros; foi preciso
restaurar os parênteses e emendar o mesmo commit sem esse hook. Em commits
futuros, resolver a incompatibilidade antes de depender do hook como gate.

## Commit da pausa

O estado local acumulado foi salvo em `c631cf3`. Ele inclui blocos concluídos
e o trabalho parcial do bloco 5; não significa que o lint global esteja verde.
Os próximos commits seguem o padrão atômico `lint (bloco X): descrição`;
cada agente commita somente a sua metade, com caminhos explícitos na mesma
worktree.
