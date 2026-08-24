# Design Tokens — Delta da vertical de Alunos

O sistema de tokens já existia (`packages/ui/src/styles/tokens/`); esta fase aplicou apenas o delta pedido pelo brief. Nada especulativo foi adicionado.

## Mudanças aplicadas

### Tipografia (`tokens/typography.css`)

- `--lz-font-sans` **renomeado** para `--lz-font-body` e trocado para a stack serifada do mockup: `Cambria, Georgia, "Times New Roman", serif`.
- `--lz-font-display` trocado de Poppins para a mesma stack serifada.
- **Novo** `--lz-font-numeric`: `Calibri, "Segoe UI", Helvetica, Arial, sans-serif` — para percentuais, valores em BRL e telefones, sempre combinado com a utility `tabular-nums`.
- Stacks de sistema: `@font-face` da Inter e imports da Poppins removidos (zero payload de webfont). Dependências `@fontsource-variable/inter` e `@fontsource/poppins` removidas do `packages/ui` e do catalog.

### Bridge Tailwind (`tokens/tailwind-bridge.css`)

- `--font-sans` → `--font-body` (utility `font-body`), novo `--font-numeric` (utility `font-numeric`).
- `body` em `globals.css` agora usa `font-body`.

### Testes (`scripts/test-styles.mjs`)

- Asserções de Inter/Poppins substituídas por asserções das novas stacks e da ausência de `@fontsource`; listas de utilities atualizadas (`font-body`, `font-numeric`). `node scripts/test-styles.mjs` e `test-component-contracts.mjs` verdes.

## O que foi verificado e NÃO mudou

- Paleta dark (`.dark` em `color.css`) está completa — todos os papéis semânticos têm valor dark (ring, brand, interactive, success/warning/info/destructive + muted, overlay). Contraste validado pelo teste existente.
- Escala tipográfica, espaçamento, radius, sombras e motion permanecem.
- Componentes usam `font-display` (popover, dialog, alert) — sem mudança de código, herdam a serifa.

## Pendências para o build (fase 6)

- Aplicar classe `.dark` fixa no `<html>` do `apps/web` (tema dark por padrão).
- Usar `font-numeric tabular-nums` nas células de frequência, financeiro e telefone.
- Conferir visualmente no Storybook a hierarquia com a serifa (a review formal fica para a fase 7).
