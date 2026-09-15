# Design Tokens — Aplicação na vertical de Parcelas

Os tokens existentes cobrem os papéis visuais previstos no brief de Parcelas, incluindo o
agrupamento de Vencidas da #57. A auditoria de 2026-09-15 define sua aplicação abaixo; a composição
final ainda precisa ser verificada no build. Não foi identificada necessidade de novas cores,
escalas, fontes ou efeitos nesta fase.

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
- O título usa `text-2xl` (24 px, mesma dimensão de `text-h2`), subtítulo usa `text-sm`
  e informações secundárias usam `text-xs`; essas utilities existentes são reconhecidas pelo
  linter shadcn. O conteúdo tabular herda a tipografia dos primitivos.
- Informações secundárias, como saldo restante em pagamento parcial, usam a escala existente e
  `muted-foreground`, sem reduzir abaixo de `text-micro`.

### Espaçamento e layout

- Página: `DataTablePage` atual de Alunos, com máximo de 96 rem, `p-6` e `gap-4`.
  Header e controles dividem uma faixa; o conteúdo ocupa a altura restante do viewport.
- Controles: busca à esquerda, tabs à direita e `gap-3`, permitindo quebra de linha.
- Tabela: `TableContainer` e densidade padrão existentes; largura mínima e scroll horizontal ficam
  sob responsabilidade do primitivo. Cabeçalho sticky e rodapé permanecem visíveis;
  a composição usa seis larguras fracionárias estáticas, sem estilos inline.
- Resumo de pagador vencido: composição dentro da grade da tabela. Padding e altura derivam da
  densidade da tabela e da escala existente; a altura acomoda as duas linhas e eventuais quebras
  de texto, sem cortar nomes ou fixar uma altura que impeça o crescimento do conteúdo.
- Radius e sombras permanecem os definidos em `scale.css` e `effects.css`.

### Motion e foco

- Transições usam `duration-fast` e `ease-standard` já aplicados pelos primitivos.
- Nenhuma animação decorativa é adicionada à troca de tabs, carregamento ou agrupamentos.
- Estados de foco usam `shadow-focus`/`ring`; cor nunca é o único indicador de status ou interação.
- Durante refetch, a estrutura anterior pode permanecer visível conforme o padrão de Alunos, sem
  alterar geometria ou introduzir skeleton intermitente. Na #52, isso se limita à mesma busca/tab
  e à paginação; trocar o filtro mostra loading, evitando linhas atribuídas ao filtro errado.

## Componentes semânticos

- `Badge` já oferece `neutral`, `success`, `warning` e `destructive`, cobrindo todos os status do
  brief.
- `Table`, `TableContainer`, `TableHead`, `TableCell`, `TableSkeleton` e `TableEmpty` fornecem
  densidade, bordas, estados e overflow.
- `Input`, `Tabs` e `Pagination` já consomem os tokens de controle, tipografia, foco e motion.
- O resumo financeiro permanece composição da feature. Novos primitivos estruturais estão
  autorizados quando a composição justificar, conforme brief e arquitetura atualizados; essa
  decisão é independente de criar tokens. Um eventual primitivo deve consumir os papéis existentes.

## Aplicação na view Vencidas — #57

Aplicação após refinamento aprovado em 2026-09-15, preservando a densidade editorial calma:

| Elemento                                    | Aplicação existente                                        | Intenção                                      |
| ------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| Superfície do resumo                        | `bg-muted`                                                 | Separar o resumo das parcelas em `bg-card`    |
| Divisão entre grupos                        | `border-border rounded-lg`                                 | Separar grupos sempre abertos                 |
| Nome do pagador                             | `text-foreground font-semibold`, tamanho do corpo tabular  | Primeiro nível de leitura                     |
| Quantidade, beneficiários e rótulo do saldo | `text-xs text-muted-foreground`                            | Informação secundária legível                 |
| Saldo em aberto                             | `text-destructive font-semibold font-numeric tabular-nums` | Dar destaque ao total pelo peso e alinhamento |
| Atraso nas parcelas                         | `Badge` destructive, texto “1 dia” / “N dias”              | Reservar a cor de urgência para o atraso      |
| Orientação da busca                         | `text-xs text-muted-foreground`                            | Explicar a inclusão do grupo completo         |

- O total do resumo usa vermelho; os saldos das parcelas usam cor neutra e peso semibold.
  A variação líquida usa texto secundário com ↓ ou ↑; o original fica no tooltip.
- Manter padding horizontal da densidade da tabela para alinhar resumo, parcelas e cabeçalhos.
  Usar a escala existente para o padding vertical necessário às duas linhas do resumo.
- O nome e o texto secundário podem quebrar linha; o valor monetário permanece inteiro. O resumo
  fica acima da tabela; as cinco colunas de Vencidas têm distribuição própria, com nomes completos.
- O resumo não muda de aparência ao passar o mouse e não recebe cursor de ação. Ao compor com
  `TableRow`, verificar o hover herdado para preservar esse comportamento.
- Os grupos ficam sempre abertos: não há ícones de expansão, animação ou tokens para esse estado.
- A busca não cria highlight em nomes ou parcelas. O agrupamento não usa cores por pagador/aluno.
- Aplicar os mesmos papéis semânticos em light e dark, usando as paletas `.light`/`.dark` existentes.
  O produto continua iniciando em dark; não criar outro mecanismo de tema para esta feature.

## Resultado da auditoria

Nenhuma alteração em `packages/ui/src/styles/tokens/` é proposta nesta fase. O build deve verificar
legibilidade, contraste das combinações aplicadas e distinção entre resumo e parcelas, incluindo
nomes longos e múltiplos beneficiários. A auditoria dos arquivos não substitui essa verificação
visual. Se surgir uma lacuna concreta, avaliar a extensão mínima do sistema existente.

## Ajuste mínimo do shell aprovado na #52

A verificação em 375 px encontrou a sidebar fixa de 240 px comprimindo os controles. Nesta entrega,
o shell passa a mostrar um menu nativo de navegação abaixo de 640 px e mantém a sidebar em larguras
maiores. O menu reutiliza os destinos e filtros por papel, fecha ao navegar ou pressionar Escape
e devolve o foco ao acionador. A data utilitária do topo aparece a partir de 640 px. O acabamento
ampliado de responsividade continua na #54.
