# Design Tokens — Aplicação na vertical de Parcelas

O sistema de tokens estabelecido pela vertical de Alunos atende integralmente ao brief de Parcelas.
Esta fase é uma auditoria de reuso: não adiciona cores, escalas, fontes ou efeitos específicos para
Financeiro.

## Filosofia

Parcelas herda a **densidade editorial calma** da área autenticada. A interface mantém superfícies
sóbrias e reserva contraste semântico para informação financeira que realmente exige atenção. A
urgência vem de texto, ordem e tokens de status; não de uma nova identidade visual para a vertical.

## Fonte de verdade

- `packages/ui/src/styles/tokens/color.css` — paletas light e dark e papéis semânticos.
- `packages/ui/src/styles/tokens/typography.css` — famílias, escala e métricas tipográficas.
- `packages/ui/src/styles/tokens/scale.css` — unidade de 4 px, alturas de controle e radius.
- `packages/ui/src/styles/tokens/effects.css` — sombras, foco, opacidade e motion.
- `packages/ui/src/styles/tokens/tailwind-bridge.css` — utilities públicas consumidas pelos
  componentes.

O produto autenticado já aplica `.dark` no elemento `<html>`. A paleta light permanece completa para
um futuro seletor de tema, sem alteração neste slice.

## Contrato de aplicação

### Cor

| Uso em Parcelas               | Token ou utility existente         | Regra                                                   |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------- |
| Página e superfície da tabela | `background`, `card`               | Mantêm o contraste estrutural do AppShell               |
| Texto principal e secundário  | `foreground`, `muted-foreground`   | Hierarquia calma, sem opacidade arbitrária              |
| Bordas e divisões             | `border`, `border-strong`          | Separam grupos e tabela sem criar caixas excessivas     |
| Paga                          | `success`, `success-muted`         | Badge com texto “Paga”                                  |
| Vence hoje                    | `warning`, `warning-muted`         | Badge com texto “Vence hoje”                            |
| Vencida                       | `destructive`, `destructive-muted` | Badge ou texto de atraso; vermelho permanece localizado |
| A vencer e Dispensada         | `muted`, `muted-foreground`        | Variante neutral existente                              |
| Foco e interação              | `ring`, `interactive`              | Busca, tabs, retry e paginação seguem os primitivos     |

Não há cor “financeira”, cor por tab ou novo tom para agrupamentos. O resumo do pagador usa
superfícies e bordas neutras; atraso e saldo vencido podem consumir `text-destructive` quando a
hierarquia exigir ênfase.

### Tipografia e números

- Títulos e corpo continuam em `font-display` e `font-body`, com a stack Cambria/Georgia existente.
- Parcela, datas, dinheiro, dias de atraso, contadores e paginação usam
  `font-numeric tabular-nums`.
- Labels de status usam o tamanho e peso do `Badge`; não criam uma escala local.
- O título da página segue Alunos com `text-h2`; subtítulo e conteúdo tabular usam
  `text-caption` quando aplicável.
- Informações secundárias, como saldo restante em pagamento parcial, usam a escala existente e
  `muted-foreground`, sem reduzir abaixo de `text-micro`.

### Espaçamento e layout

- Página: `max-w-6xl`, `p-8` e `gap-5`, iguais a `StudentsPage`.
- Controles: busca à esquerda, tabs à direita e `gap-4`, permitindo quebra de linha.
- Tabela: `TableContainer` e densidade padrão existentes; largura mínima e scroll horizontal ficam
  sob responsabilidade do primitivo.
- Resumo de pagador vencido: composição dentro da grade da tabela. Padding e altura derivam da
  densidade da tabela; não introduz uma escala própria.
- Radius e sombras permanecem os definidos em `scale.css` e `effects.css`.

### Motion e foco

- Transições usam `duration-fast` e `ease-standard` já aplicados pelos primitivos.
- Nenhuma animação decorativa é adicionada à troca de tabs, carregamento ou agrupamentos.
- Estados de foco usam `shadow-focus`/`ring`; cor nunca é o único indicador de status ou interação.
- Durante refetch, a estrutura anterior pode permanecer visível conforme o padrão de Alunos, sem
  alterar geometria ou introduzir skeleton intermitente.

## Componentes semânticos

- `Badge` já oferece `neutral`, `success`, `warning` e `destructive`, cobrindo todos os status do
  brief.
- `Table`, `TableContainer`, `TableHead`, `TableCell`, `TableSkeleton` e `TableEmpty` fornecem
  densidade, bordas, estados e overflow.
- `Input`, `Tabs` e `Pagination` já consomem os tokens de controle, tipografia, foco e motion.
- O resumo de pagador é composição da feature e deve consumir esses papéis; não justifica um novo
  primitivo nem um token de componente global.

## Resultado da auditoria

Nenhum arquivo em `packages/ui/src/styles/tokens/` precisa mudar. A Fase 6 deve validar o uso correto
das utilities existentes nos novos componentes e adicionar testes apenas para o comportamento e os
contratos realmente novos.
