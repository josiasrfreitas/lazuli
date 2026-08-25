# Build Tasks: Porta de entrada (login + proteção de rotas)

Generated from: .design/login/DESIGN_BRIEF.md
Date: 2026-08-25

Ordem: primitivos primeiro (o formulário depende deles), depois o guard (a proteção é o valor real da entrega), depois as duas telas, e por último a remoção do atalho de desenvolvimento — que só sai quando existe caminho de entrada de verdade.

## UI primitives (`packages/ui`, cada um ≤200 linhas + story)

- [x] **`label`**: label de formulário com tokens de tipografia (`control`), estado desabilitado herdado do grupo. Story com estados. _Novo; envolve `Field.Label` do Base UI._
- [x] **`field`**: composição label + slot de controle + descrição + mensagem de erro, ligando `id`/`aria-describedby` sem exigir react-hook-form. Story com estado válido e inválido. _Novo; envolve `Field.Root` do Base UI, que o `Input` do repo já é (`Field.Control`)._

## Tokens (`packages/ui/src/styles/tokens/`)

- [x] **Voz de moldura**: `--lz-font-grotesk`, `--lz-font-mono`, escala `hero` (clamp + leading 0.95 + tracking tight), `--lz-tracking-eyebrow` e a família `--marquee-*` (superfície, texto, hairline, acento periwinkle). Pontes no `tailwind-bridge.css`. Consumidos só pelas telas de moldura. _Decisão de 2026-08-25 a partir do mockup da `/403`._

## Guard (proteção de rotas, `apps/web`)

- [x] **Client de auth**: `apps/web/src/lib/auth-client.ts` — `createAuthClient` de `better-auth/react` com `magicLinkClient`. Único ponto de import do client de auth. Done = `signIn.magicLink`, `signIn.social` e `signOut` tipados. _Novo._
- [x] **Route group `(app)`**: `layout.tsx` server-side lê a sessão (`auth.getSession`) e redireciona para `/login` quando não há; `page.tsx` redireciona `/` → `/alunos`; `alunos/page.tsx` migra para dentro do grupo sem mudança de conteúdo. Done = `/` e `/alunos` sem sessão caem no `/login`. _Modifica `app/page.tsx`, move `app/alunos/`._
- [x] **Helper de papel**: `apps/web/src/lib/require-role.ts` — resolve a sessão, compara com os papéis aceitos e redireciona para `/403`. Nasce pequeno; nenhuma página o usa nesta entrega. _Novo._

## Moldura compartilhada (`apps/web/src/components/marquee/`)

- [x] **`MarqueeLayout`**: fundo `--marquee` com grid de hairlines sutil, split-screen (editorial à esquerda, card à direita), colapsa para coluna única abaixo de ~1024px. Partes: eyebrow em mono, título hero, corpo, slot de ações, rodapé com hairline. _Novo; server component._
- [x] **`MarqueeCard`**: card emoldurado com header e footer de metadados em mono e cantos marcados. Recebe título, código e pares rótulo/valor do footer. _Novo; server component._

## Telas

- [x] **`/403`**: `app/403/page.tsx` reproduzindo o mockup — eyebrow `ERRO 403 —— SEM PERMISSÃO`, hero "Esta área / é restrita." (segunda linha em gold), corpo, CTA periwinkle "Voltar ao início ↗", rodapé `CÓDIGO DO ERRO: LAZ-403`; card `AMOSTRA MINERAL` com `SpecimenCrystal` (SVG inline) e "403" sobreposto, legenda `FORBIDDEN`, footer `STATUS: BLOQUEADO | MOTIVO: SEM PERMISSÃO`. Botão "Sair" (client) quando há sessão. Fora do route group protegido. Done = renderiza com e sem sessão; Sair derruba a sessão. _Depends on: moldura + client de auth._
- [x] **`/login`**: `page.tsx` (server, redireciona quem já tem sessão) na mesma moldura — eyebrow `LAZULI —— ENTRAR`, hero "Sua gestão escolar, / simplificada." (segunda linha em gold), uma frase de corpo; o card à direita recebe o `LoginCard` (client) com Google, divisor, campo de email via `field`, estados idle/enviando/enviado/erro e leitura de `?error=`. Copy pt-BR. Done = envio real chega no Mailpit e a negação mostra o alert genérico. _Depends on: primitivos + moldura + client de auth._

## Cleanup

- [x] **Remover o atalho de desenvolvimento**: reverter o bypass em `packages/api/src/trpc/context.ts`, deletar `packages/api/src/trpc/dev-auth-env.ts`, remover `DEV_AUTH_EMAIL` de `.env`/`.env.example` e ajustar os testes que o cobriam. Done = procedures exigem sessão em qualquer ambiente. _Modifica a Foundation da vertical de Alunos._

## Review

- [x] **Verificação end-to-end**: sem sessão `/` e `/alunos` → `/login`; login com `dev@lazuli.local` → Mailpit → link → `/alunos`; email desconhecido → alert genérico sem envio; `/login` com sessão → `/alunos`; `/403` + Sair. Lint, typecheck e `pnpm test:component-lines` verdes.
- [x] **Design review**: rodar `/design-review` contra este brief com screenshots (desktop 1280 e mobile 375; estados idle, enviado, erro, `/403`). _Feito como loop de 4 rounds com medição; achados e consertos em `DESIGN_REVIEW.md`._
