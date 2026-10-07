# Design Tokens: V1 — Reuse do sistema Lazuli

Base: [DESIGN_BRIEF.md](DESIGN_BRIEF.md). A etapa de gerar novos tokens foi dispensada porque
a entrega reutiliza o sistema existente. Este artefato registra as fontes e o uso esperado;
não duplica valores em outro CSS nem introduz um tema próprio.

## Fontes canônicas

Caminhos relativos à raiz do repositório:

| Fonte                                               | Aplicação nesta entrega                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/ui/src/styles/globals.css`                | Entrada dos tokens e estilos base.                                            |
| `packages/ui/src/styles/tokens/color.css`           | Superfícies, texto, bordas, foco e estados; inclui light e dark.              |
| `packages/ui/src/styles/tokens/typography.css`      | Cambria para corpo/display; fonte numérica existente para números e ocupação. |
| `packages/ui/src/styles/tokens/scale.css`           | Unidade de espaço, alturas de controles, raios e dimensões da tabela.         |
| `packages/ui/src/styles/tokens/effects.css`         | Sombras, foco, duração, easing e opacidade de estado desabilitado.            |
| `packages/ui/src/styles/tokens/tailwind-bridge.css` | Ponte para as classes consumidas pelos componentes.                           |

## Aplicação semântica

- Página e texto: `background`, `foreground`, `muted-foreground`.
- Superfícies e separadores: `card`, `popover`, `border`, `input`.
- Ação principal: variante primária de Button; ações secundárias usam variantes existentes.
- Ocupação excedente: semântica `warning`/`warning-muted` com texto explícito. Excesso de
  capacidade é informação operacional, não erro de validação nem motivo de botão desabilitado.
- Falha real: semântica `destructive`; sucesso: `success`; foco: `ring`.
- Títulos e controles: escala tipográfica e variantes dos componentes, sem novos tamanhos por tela.
- Formulários: agrupamento por significado; datas, horários e capacidade não se esticam como nomes.

Consumir tokens semânticos e APIs de variantes, sem valores de cor avulsos ou overrides internos
nos componentes. Espaçamento externo pode compor layout; densidade interna pertence ao primitive.

## Limites e verificação

Não modificar paleta, tema, fontes ou breakpoints globais nesta documentação. Usar o tema atual
do app e conservar compatibilidade com os tokens existentes; não construir seletor de temas.
Novos tokens só quando um estado real não puder ser expresso pelo sistema, com justificativa
no work item. Não há lacuna desse tipo demonstrada no planejamento atual.

Validar contraste, foco, hierarquia de ações, larguras e rolagem no navegador durante a
implementação. Tokens existentes não comprovam a qualidade visual de uma composição nova.
Seguir `docs/frontend/README.md`, `docs/frontend/forms.md` e `docs/frontend/data-tables.md`.
