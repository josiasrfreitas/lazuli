# Design Review: Porta de entrada (login + 403)

Reviewed against: `.design/login/DESIGN_BRIEF.md`
Philosophy: marquee mineral
Date: 2026-08-25

Formato: loop de crítica em 4 rounds (screenshot → 3 achados medidos → conserto → screenshot de confirmação). Toda queixa foi medida no browser com `getBoundingClientRect()`/`getComputedStyle()`; nenhum achado entrou por impressão visual. Estados cobertos: `/login` idle, enviado, `?error=INVALID_TOKEN`; `/403` sem e com sessão. Viewports: 1440×900, 1280×800, 1024×800, 768×1024, ~390 (mínimo da janela do Chrome, ~485px real; a faixa <500px foi validada por cálculo de largura de texto).

## Screenshots

| Screenshot                                                                                                          | O que mostra                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `screenshots/review-login-1440.png` / `review-403-1440.png`                                                         | Baseline antes do loop                                                   |
| `screenshots/review-login-1440-r1.png` / `review-403-1440-r1.png`                                                   | Após round 1                                                             |
| `screenshots/review-login-1440-r2.png` / `review-403-session-1440-r2.png`                                           | Após round 2 (403 com sessão, dois botões)                               |
| `screenshots/review-403-1280-r3.png` / `-r3b.png`                                                                   | Round 3: glint + eyebrow a 1280                                          |
| `screenshots/review-login-error-1280-r4.png` / `review-login-sent-1280-r4b.png`                                     | Round 4: estados de erro e enviado                                       |
| `screenshots/review-login-1440-final.png` / `review-403-1440-final.png`                                             | Estado final                                                             |
| `review-login-768.png`, `review-login-390.png`, `review-403-768.png`, `review-403-390.png`, `review-login-1280.png` | Varredura responsiva (as de login 1280/768/390 são pré-conserto do hero) |

## Round 1 — pacing e alinhamento (consertado)

1. **Ritmo vertical uniforme no editorial** (`marquee-layout.tsx`): `gap-8` dava 32px idênticos entre eyebrow→hero, hero→corpo, corpo→ações e ações→nota. Elementos de peso diferente com o mesmo respiro achatam o agrupamento: o eyebrow rotula o hero e deveria colar nele; a nota é rodapé e deveria se afastar. **Fix**: margens graduadas 20/28/40/48px nos próprios componentes (`MarqueeTitle mt-5`, `MarqueeBody mt-7`, `MarqueeActions mt-10`, `MarqueeNote mt-12`).
2. **Espaço morto no stage do `/login`** (`marquee-card.tsx`): `sm:min-h-[24rem]` (384px) contra 226px de conteúdo deixava 79px de vazio acima do botão Google e 79px abaixo do submit. No `/403` o conteúdo já media 507px — o `min-h` só agia no login, e só para pior. **Fix**: removido; o stage abraça o conteúdo.
3. **Bandas do card desalinhadas do conteúdo** (`marquee-card.tsx`): header/footer com `px-6` (texto em x=800.8) contra stage `sm:px-10` (conteúdo em x=816.8) — 16px de offset sem âncora. **Fix**: `sm:px-10` no header e `sm:first:pl-10` na primeira célula do footer; header, stage e footer agora compartilham a mesma borda esquerda (x=817, verificado).

## Round 2 — controles e SVG (consertado)

1. **`h-control-lg` nunca aplicava** (`packages/ui/src/lib/utils.ts`): o tailwind-merge do `cn` não conhecia os tokens de spacing `control-*`, então `h-control-md` (do variant default do Button) e `h-control-lg` (das classes marquee) coexistiam na className e a ordem do stylesheet decidia — todos os controles da moldura renderizavam com 40px, abaixo do touch target de 44px e dos 48px pretendidos (`--lz-control-lg: 3rem`). **Fix**: `spacing: ["control-sm","control-md","control-lg"]` no `extendTailwindMerge`. Botões e input medem 48px agora.
2. **Arcos e glow do cristal cortados pelo viewBox** (`specimen-crystal.tsx`): círculos com `r=130/140` em `cx=120` varrem x = −20…260 numa caixa de 240 — os traços terminavam no ar na borda do SVG, em qualquer escala. **Fix**: `overflow-visible`.
3. **Rodapé Método/Sessão removido do `/login`** (pedido do usuário durante o round): `meta` virou opcional no `MarqueeCard`; card do login é header + stage.

## Round 3 — tipografia e hierarquia (consertado)

1. **Hero quebrava em 3 linhas entre ~1024 e ~1350px** (`typography.css`): `clamp(2.5rem, 5.6vw, 4rem)` satura em 64px a partir de ~1143px de viewport, mas a coluna editorial encolhe mais rápido que o viewport no split (`col ≈ 0.513vw − 107px`). O lead "Sua gestão escolar," precisa de 8.67px de largura por px de fonte (554.8px @ 64px, medido por canvas com o tracking real) — a 1280 cabiam 62px e renderizavam 64. **Fix**: `clamp(2.25rem, 5.75vw - 0.75rem, 4rem)`, cujo slope acompanha a coluna. Verificado: 61.6px/2 linhas a 1280, 46.9px a 1024, 36px no piso (cabe até ~375px).
2. **Glint do cristal descolado**: o quad claro (`opacity 0.28`) tinha vértices internos em pleno meio da faceta (74,124 / 116,58), criando uma aresta interna que nenhuma linha de faceta justifica. **Fix**: realinhado como lasca ao longo da aresta apex→ombro (`120,24 52,74 64,84 121,36`) — lê como luz na aresta.
3. **Detalhe do eyebrow mais claro que o rótulo** (`marquee-layout.tsx`): detalhe em foreground (#eef2fb, luminância ~0.87) contra rótulo em accent (#bacbff, ~0.60), mesmo corpo e peso — a palavra secundária vencia a primária. **Fix**: detalhe em `--marquee-muted` (#a8b7d6, contraste 9:1, AA folgado); a classificação lidera.

## Round 4 — estados internos (consertado)

1. **Ritmo uniforme no estado "link enviado"** (`magic-link-sent.tsx`): `gap-5` dava 20/20/24px. **Fix**: 12/20/32 — o rótulo cola na frase que anuncia, a ação se afasta (medido 341→353, 379→399, 442→474).
2. **Borda do alert invisível** (`login-card.tsx`): o variant destructive traz borda com alpha 0.2, que some sobre o navy — numa superfície onde tudo é regrado por hairline nítida. **Fix**: `border-destructive/40` no alert da moldura.
3. **Input de email a 13.5px** (`login-form.tsx`): fonte <16px dispara auto-zoom do iOS Safari no foco, no único campo de texto da porta de entrada. **Fix**: `text-body` (16px) no input.

## Medido e aceito (sem conserto)

- **Contraste**: `--marquee-muted` sobre `--marquee` = 9.0:1; gold `--brand` = 8.6:1 — AA com folga até no `text-micro` (11px).
- **`/403` a 768×1024 rola** (~1170px de conteúdo): o editorial completo com CTA cabe na primeira dobra; o que fica abaixo é a vitrine decorativa. Encolher o cristal enfraquece a peça e não elimina a rolagem — aceito.
- **Grid do `SurveyGrid` atravessa o card** (bg do card tem 1.5% de opacidade): lê como vitrine de vidro, coerente com a metáfora; a máscara radial faz o fade diagonal parecer vinheta, não corte.
- **Foco**: ring de 3px periwinkle a 48% confirmado via Tab real (`:focus-visible`); estado loading do Button esconde o rótulo (`opacity-0`) sob o spinner — correto.
- **Console limpo** em todas as navegações.

## Divergência do brief, a decidir

- O brief ("Responsive Behavior") diz que abaixo de ~768px o painel editorial _sai da tela_ e um wordmark reaparece sobre o card. A implementação empilha editorial + card e funciona bem (o `/login` cabe quase inteiro numa dobra de 844px). Manter o empilhamento parece melhor que esconder o pitch; o brief é que está desatualizado. Confirmar com o usuário.
- Etiquetas `AMOSTRA MINERAL` / `FORBIDDEN` no card do `/403`: mantidas como etiqueta de vitrine (decisão registrada no brief), pergunta aberta do handoff segue aberta.

## What Works Well

- A troca de voz (grotesk/mono da moldura vs Cambria do produto) está nítida e disciplinada: nenhum token `--marquee-*` vaza para o produto autenticado.
- O card-como-vitrine unifica as duas telas de verdade — o formulário de login lê como espécime tanto quanto o cristal.
- Copy pt-BR direta, sem jargão decorativo; a mensagem de negação não vaza existência de email.
- Acessibilidade de base sólida: label real associada, `role="status"` no estado enviado, `role="alert"` na negação, foco visível, SVG decorativo com `aria-hidden`.
