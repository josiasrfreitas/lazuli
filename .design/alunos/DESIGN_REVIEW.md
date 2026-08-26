# Design Review: Vertical de Alunos

Reviewed against: `.design/alunos/DESIGN_BRIEF.md` (+ `.design/alunos/INFORMATION_ARCHITECTURE.md`)
Philosophy: editorial institucional dark
Date: 2026-08-26

Formato: crítica medida no browser (viewport 1280×900, chrome-devtools). Toda queixa foi confirmada com `getBoundingClientRect()`/`getComputedStyle()` ou fluxo real de teclado; nenhum achado entrou por impressão visual. Estados cobertos: lista cheia, filtrada (`?busca=camila`), vazia (`?busca=zzzz`), erro de query (fetch bloqueado), loading (rede Slow 3G), painel aberto, wizard etapas 1–3 com validação de menor. Os mockups originais não existem mais em disco; a review julga contra o brief/IA e a coerência interna do design system.

## Screenshots

Todos em `.design/alunos/screenshots/`, desktop 1280.

| Screenshot                                 | O que mostra                                                      |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `review-list-1280.png`                     | Lista cheia (pós-conserto das colunas)                            |
| `review-filtered-1280.png`                 | Busca "camila" (3 linhas)                                         |
| `review-empty-1280.png`                    | Busca sem resultado (empty state dentro do frame da tabela)       |
| `review-panel-1280.png`                    | Painel de preview (Felipe Andrade: freq 50% e R$ 380,00 vencidos) |
| `review-row-focus-1280.png`                | Linha focada via Tab (`:focus-visible` com ring)                  |
| `review-wizard-step1-1280.png`             | Wizard etapa Dados                                                |
| `review-wizard-step1-error-1280.png`       | Nome vazio bloqueado com erro associado ao campo                  |
| `review-wizard-step1-minor-1280.png`       | Menor de idade: seção Responsável obrigatória                     |
| `review-wizard-step2-1280.png` / `-step3-` | Etapas Turma e Financeiro (placeholders com Pular)                |
| `review-wizard-error-scrolled-1280.png`    | Pós-conserto: submit falho rola e foca o primeiro campo inválido  |

Nota de captura: screenshot de viewport com overlay aberto sai com o backdrop invertido para claro — artefato do capture CDP com `backdrop-filter: blur`; o rendering real é dark (computed styles conferidos). Overlays foram registrados por screenshot de elemento.

## Summary

A vertical entrega o brief: cada linha responde turma/frequência/financeiro com hierarquia serifada calma, o painel preserva o contexto da ligação e o wizard nunca bloqueia por etapas futuras. Os quatro achados da review eram de estabilidade e feedback (colunas que deslizam, toolbar que some, erro fora da dobra, motion sem redução) — todos consertados, verificados no browser e commitados. Nenhum achado de fidelidade estética.

## Consertado

1. **Colunas deslizavam entre estados** (`students-table.tsx`): com layout automático, a linha `colspan` dos estados vazio/erro redistribuía as colunas — TURMA saltava de x=572 (dados) para x=418 (vazio), um pulo de 154px a cada troca de estado. _Fix_: larguras explícitas no header + `table-fixed` (`min-w-2xl` preserva o scroll deliberado no mobile). Verificado: headers em x=[273, 565, 711, 877, 1023, 1169] idênticos nos estados dados, skeleton, vazio e erro; tabela 974px dentro do container de 976px, sem overflow. Commit `4ea84a0`.
2. **Toolbar só montava com dados** (`students-page.tsx`): busca e tabs pulavam para dentro no primeiro load e desapareciam em erro de query — impedindo limpar a busca que causou o erro. _Fix_: `StudentsControls` renderiza sempre; `statusTabsVm` aceita counts ausentes e as tabs aparecem sem número até a query resolver. Verificado com rede Slow 3G (toolbar presente sobre o skeleton, tabs "Todos/Ativos/Inativos" sem contagem) e com `students.list` bloqueado (busca "camila" continua editável ao lado do estado de erro com "Tentar de novo"). Commit `adf3aa1`.
3. **Erro de validação abaixo da dobra no wizard** (`new-student/`): o corpo do dialog rola (558px de conteúdo em ~411px de viewport útil a 1280×700) e o erro de responsável de menor nascia fora da tela — Avançar parecia não fazer nada. _Fix_: o reducer ganha `errorsRevision`, incrementado só em submit falho (cliente ou servidor); `useScrollToError` rola o primeiro `[aria-invalid]` para o centro e o foca. Verificado: Avançar com menor sem responsável rolou o corpo 199px e focou "Nome do responsável" (`review-wizard-error-scrolled-1280.png`). Digitação não re-dispara (coberto por teste do reducer). Commit `fe614eb`.
4. **Dialog/sheet ignoravam `prefers-reduced-motion`** (`packages/ui`): tabs e skeleton já respeitavam (`motion-reduce:*`), mas o fade+blur do backdrop e o translate dos popups não. _Fix_: `motion-reduce:transition-none` no backdrop, no dialog e no sheet. Verificado: 5 regras sob `(prefers-reduced-motion: reduce)` no CSS servido e classes presentes nos elementos vivos. Commit `174616d`.

## Medido e aceito (sem conserto)

- **Contraste** sobre o bg da tabela (`rgb(18,21,29)`): destructive 5.42:1, success 10.27:1, headers `text-micro` 10.08:1, contagem das tabs 9.11:1 — AA em todos, incluindo os corpos de 11px.
- **Teclado**: linha com `tabIndex=0`, Enter abre o painel, Esc fecha e o foco retorna à linha de origem; ring `:focus-visible` confirmado por Tab real. Os segmentos laterais do ring são clipados pelo container de scroll da tabela (topo/base visíveis) — aceito, o affordance permanece legível.
- **Responsivo**: sheet full-width abaixo de 768; container da tabela assume o scroll horizontal sem alargar a página (verificado a 1024 e 740).
- **Console limpo** em todas as navegações.
- **Validação de menor**: bloqueia corretamente no cliente espelhando o backend. Um teste manual anterior via CDP `fill` sugeria furo, mas era artefato do teste (o preenchimento não disparava o `onChange` do React); redigitado por teclado, o fluxo bloqueia e o servidor segue como autoridade.

## Dívidas registradas (fora do escopo desta review)

- **Paginação sem contexto**: o rodapé mostra só "Página 1 de 2" — não há intervalo/total ("1–10 de 17 alunos") nem escolha de itens por página. Registrado a pedido do usuário nesta review; fica para uma task própria (toca `Pagination` em `packages/ui` e o contrato de `students.list`).
- `students.*` usa `adminProcedure`; o contrato pede `staffProcedure` (ADMIN+TEACHER). Adiado, registrado no PR #46.
- Suíte `test:db` completa colide com o seed dev — documentado em `.design/alunos/TASKS.md` (dívida anterior a esta vertical).

## Adendo — achados da review do PR #49 (pullfrog, 2026-08-26)

Três achados inline, todos confirmados no código e consertados com verificação no browser:

1. **Fechar o wizard com a criação em voo**: o X e o Esc fechavam durante o `students.create` pendente; um sucesso tardio reabria o preview e um erro tardio caía num dialog já fechado. _Fix_: pedido de fechamento é ignorado enquanto `isPending`. Verificado com fetch atrasado 8s: Esc ignorado, e a rejeição chegou num wizard aberto, na etapa Dados, com o alert "Não foi possível criar o aluno" e os campos preservados.
2. **Sheet sem título no loading/erro**: o painel sem dados não montava `SheetTitle`, deixando o dialog sem `aria-labelledby`. _Fix_: título sr-only "Aluno" estável até o nome chegar. Verificado em Slow 3G: `aria-labelledby` presente nos dois estados (loading → "Aluno"; carregado → nome do aluno).
3. **Navegação cega a role**: todo perfil via "Alunos", mas `students.*` é `adminProcedure` — um professor clicava e levava FORBIDDEN. _Fix_ (decisão do usuário): nav configurável por role. `nav-items.ts` vira a fonte única (item declara `roles`), a sidebar filtra por `identity.role` e o `/` redireciona pelo mesmo mapa — perfil sem vertical aberta vê um placeholder calmo em vez de cair numa tela negada (`review-home-teacher-1280.png`, logada como TEACHER). Resíduo consciente: URL direta `/alunos` para um professor ainda mostra o estado de erro da tabela; a solução de verdade segue sendo a dívida do `staffProcedure`.

## What Works Well

- **Densidade serena de verdade**: a linha carrega seis fatos e continua calma — serifa no nome, `font-numeric tabular-nums` nos números, cor apenas onde há significado (50% e R$ 380,00 em destructive, "Em dia" em success, "—" muted para ausência). É a tradução fiel do princípio 3 do brief.
- **Camadas disciplinadas**: `view-model.ts` puro e testado decide tudo que é regra visual (tons, rótulos, estados da tabela); os componentes ficam presentacionais. O estado da URL (nuqs) faz filtro, página e painel sobreviverem a refresh e link compartilhado.
- **Estados dentro do frame**: loading/vazio/erro moram dentro da moldura da tabela (skeleton com barras desiguais, empty states com ação) — a página não salta entre estados, agora nem nas colunas.
- **Wizard leve como prometido**: só o nome é obrigatório, Turma/Financeiro são skippáveis com placeholders honestos ("Matrícula em breve"), e as rejeições do servidor voltam mapeadas campo a campo na etapa Dados.
