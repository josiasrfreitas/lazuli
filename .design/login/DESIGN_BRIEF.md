# Design Brief: Porta de entrada (login + proteção de rotas)

> Escopo: página `/login` (Google + magic link), proteção server-side das rotas de produto e página `/403`. Substitui o atalho de desenvolvimento `DEV_AUTH_EMAIL` criado na Foundation da vertical de Alunos.

## Problem

O `apps/web` hoje não tem porta de entrada: `/` mostra um placeholder público e `/alunos` responde a qualquer visitante porque o contexto tRPC resolve um admin seedado via `DEV_AUTH_EMAIL`. O backend de auth já está inteiro — Better Auth com magic link e Google, hook que bloqueia quem não é staff habilitado, rota `/api/auth/[...all]` montada — mas nada disso é alcançável pela interface. Enquanto isso, a secretaria não tem como entrar com a conta institucional, e qualquer pessoa com a URL vê dados de aluno.

## Solution

Uma tela de entrada que apresenta o produto antes de pedir qualquer coisa: Google como caminho primário e magic link por email como alternativa, ambos sem senha. A escola não tem Google Workspace — e não precisa ter: o provedor só prova quem é a pessoa; **quem decide o acesso é a entidade `User`**. `evaluateStaffAccess` exige linha `User` existente, `isEnabled` e papel habilitado; os dois provedores rodam com `disableSignUp: true`, então nenhum deles cria conta. Uma conta Gmail pessoal entra sem problema desde que o email bata com um `User` cadastrado. As rotas de produto passam a viver em um route group com verificação de sessão no servidor — sem sessão, redirect para `/login`. Quem está autenticado mas tenta uma URL que seu papel não alcança cai em `/403`, uma página que explica o limite e oferece saída (Sair) em vez de um beco sem fim.

## Experience Principles

1. **Uma porta, dois caminhos** — Google e magic link no mesmo card, sem cadastro, sem senha, sem "criar conta". Quem pode entrar já existe no sistema; a tela só reconhece.
2. **Erro honesto, sem vazamento** — qualquer negação (email desconhecido, usuário desabilitado, papel não habilitado) devolve a mesma mensagem genérica. A tela nunca confirma se um email existe.
3. **Apresente o produto, não o login** — todo mundo já sabe o que é uma tela de entrada. O espaço editorial do `/login` diz o que o Lazuli faz ("Sua gestão escolar, simplificada"); não explica como digitar um email.
4. **Sem jargão decorativo** — nada de metáfora de mineração na copy funcional, nem de código inventado. `LAZ-403` existe porque o 403 existe; no login não havia código real, então o slot ficou vazio.

## Aesthetic Direction

Revisto em 2026-08-25 a partir do mockup de `/403` fornecido pelo designer. A superfície não autenticada ganha voz própria — decisão explícita, não deriva.

- **Philosophy**: _marquee mineral_. A tela de entrada é a capa da escola, não a ferramenta. Fundo navy profundo, título em grotesk pesado, rótulos em mono espaçado, e uma "amostra mineral" emoldurada como peça central — o lápis-lazúli que dá nome ao produto.
- **Duas vozes, deliberadas**: a moldura (login, 403, erros) fala alto em grotesk + mono; o produto autenticado (Alunos) continua em Cambria serifada, calmo e denso. A troca de voz marca a passagem de "fora" para "dentro".
- **Layout**: split-screen em ambas as telas. Esquerda editorial — eyebrow em mono (`ERRO 403 —— SEM PERMISSÃO`), título hero em duas linhas com a segunda em gold, corpo curto, CTA, e um rodapé com hairline e código. Direita: card emoldurado com header e footer de metadados em mono, conteúdo ao centro.
- **Cor**: `--marquee` (navy profundo) como fundo, `--marquee-foreground` para o texto, `--brand` (gold) como único acento quente, `--marquee-accent` (periwinkle) no CTA primário. Hairlines em `--marquee-border`.
- **Tone**: institucional e um pouco cerimonioso. Nem pedido de desculpas, nem piada de 404.
- **Tema**: sempre dark — os tokens `--marquee-*` vivem fora dos blocos de tema porque estas telas não são themeáveis.
- **Anti-references**: telas de login SaaS genéricas com ilustração 3D, gradiente colorido, "Welcome back 👋", badges de social proof, botão de Google só com ícone; e o oposto — página de erro cinza com carinha triste.

### Tokens novos (`packages/ui/src/styles/tokens/`)

| Token                                                         | Papel                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `--lz-font-grotesk`                                           | Título hero e CTA das telas de moldura (stack de sistema)   |
| `--lz-font-mono`                                              | Eyebrows, metadados do card, código de acesso               |
| `--lz-text-hero` / `--lz-leading-hero` / `--lz-tracking-hero` | Título fluido (clamp 44→72px), leading 0.95, tracking tight |
| `--lz-tracking-eyebrow`                                       | Espaçamento largo dos rótulos em mono                       |
| `--marquee*` (6 tokens)                                       | Superfície, texto, hairline e acento das telas de moldura   |

O produto autenticado não consome nenhum deles — `--lz-font-display` continua Cambria.

## Existing Patterns

- **Backend de auth pronto** (`packages/auth`): `createAuth` com magic link (`disableSignUp: true`) + Google (`disableSignUp: true`); `sendMagicLink` chama `evaluateStaffAccess` antes de enviar; hook `session.create.before` repete a checagem na criação de sessão. `STAFF_ACCESS_DENIED_MESSAGE` é a mensagem genérica única.
- **Rota montada**: `apps/web/src/app/api/auth/[...all]/route.ts` via `toNextJsHandler`.
- **Tokens e primitivos** (`packages/ui`): paleta navy/gold com tema dark completo, ramp tipográfica, `button` (variantes primary/secondary/ghost/link), `input` (com estado `invalid`), `alert` (+ icon/content/title/description).
- **Regras duras**: componente ≤ 200 linhas físicas (`pnpm test:component-lines`); primitivos em `packages/ui`, composições em `apps/web`; `apps/web` não importa Prisma; código e docs em inglês, copy de UI em pt-BR.

## Decisões fechadas no grill

- **Método**: magic link + Google, exatamente como o ADR 0004 decidiu. Sem email/senha, sem novo ADR, sem mudança no backend de auth.
- **Proteção de rotas**: verificação server-side em layout de route group. Sem `middleware.ts` — o layout já roda no servidor a cada request e mantém a lógica junto das rotas que protege.
- **Escopo do `/403`**: usuário autenticado que alcança uma URL fora do seu papel. Erro de login é erro de login e fica no `/login`.
- **Sign-out**: só na `/403` nesta entrega. Header autenticado com menu de usuário vem com o AppShell da vertical de Alunos.
- **Raiz**: `/` redireciona para `/alunos`.

## Component Inventory

| Component       | Status              | Notes                                                                       |
| --------------- | ------------------- | --------------------------------------------------------------------------- |
| button          | Exists              | "Entrar com Google" (secondary + ícone), "Receber link de acesso" (primary) |
| input           | Exists              | Campo de email, `type="email"`, estado `invalid`                            |
| alert           | Exists              | Negação genérica, link expirado                                             |
| `label`         | New (`packages/ui`) | Label real de formulário, tokens `control`/`caption`                        |
| `field`         | New (`packages/ui`) | Composição label + controle + mensagem de erro com `aria-describedby`       |
| MarqueeLayout   | New (`apps/web`)    | Moldura compartilhada: fundo navy, grid sutil, split-screen                 |
| MarqueeCard     | New (`apps/web`)    | Card emoldurado com header/footer de metadados em mono                      |
| SpecimenCrystal | New (`apps/web`)    | Cristal de lápis-lazúli em SVG inline (só na `/403`)                        |
| LoginCard       | New (`apps/web`)    | Conteúdo do card no `/login`: Google, divisor, magic link, estados (client) |
| SignOutButton   | New (`apps/web`)    | Botão "Sair" da `/403` (client)                                             |

## Key Interactions

- **Enviar magic link**: idle → botão em `loading` → estado "enviado": o card troca para "Enviamos um link para {email}" com instrução curta e ação secundária "usar outro email" (volta ao formulário com o campo preenchido).
- **Negação no envio** (email desconhecido / desabilitado / papel não habilitado): alert destructive com a mensagem genérica única. Nenhum email sai.
- **Falha genérica** (rede, rate limit): alert com "Não foi possível enviar o link. Tente novamente." — não reusa a mensagem de acesso negado, que seria mentira.
- **Link inválido ou expirado**: a verificação redireciona para `/login?error=…`; a página abre com alert "Link inválido ou expirado. Peça um novo."
- **Google**: `signIn.social({ provider: "google" })` → redirect OAuth → volta em `/` → `/alunos`.
- **Já autenticado em `/login`**: redirect para `/`.
- **Sem sessão em rota protegida**: redirect para `/login`.
- **`/403`** (conforme o mockup): eyebrow `ERRO 403 —— SEM PERMISSÃO`; título hero "Esta área / é restrita." (segunda linha em gold); corpo "Você não tem permissão para abrir esta página. Se isso parece um engano, fale com a secretaria."; CTA periwinkle "Voltar ao início ↗"; rodapé com hairline e `CÓDIGO DO ERRO: LAZ-403`. À direita, card `AMOSTRA MINERAL` / `LAZ-403` com o cristal e "403" sobreposto, legenda `FORBIDDEN` em gold, e footer `STATUS: BLOQUEADO | MOTIVO: SEM PERMISSÃO`. Botão "Sair" acompanha o CTA para quem tem sessão.

## Responsive Behavior

Desktop-first, como o resto do produto. Abaixo de 1024px (breakpoint `lg`) o split vira coluna única: o editorial completo empilha sobre o card, mantendo o pitch visível também no celular — decisão confirmada no design review de 2026-08-25, revendo a ideia original de esconder o editorial abaixo de ~768px. O `/login` cabe quase inteiro numa dobra de 844px. Sem layout mobile dedicado além disso.

## Accessibility Requirements

- Label real associada ao campo (o primitivo `field` cuida do `htmlFor`/`id`), nunca placeholder como label.
- Erro do campo anunciado via `aria-describedby`; alert de página com `role="alert"` (padrão do primitivo).
- Foco visível em todos os controles (`--lz-shadow-focus`, já no `button`/`input`).
- Botão do Google com texto, não só ícone.
- Contraste AA no tema dark (tokens já calibrados).
- Estado "enviado" anunciado (o card trocado é um `role="status"`).

## Out of Scope

- Header/shell autenticado com sign-out global (vem no AppShell da vertical de Alunos).
- Gestão de usuários, convites, atribuição de papel.
- Email/senha, "lembrar de mim", 2FA.
- Tema light no produto.
- RBAC por página além do helper mínimo — nesta entrega nenhuma página é restrita por papel; a `/403` existe para o acesso via URL e para as páginas restritas que virão.
- Página de perfil do usuário.

## Limitação conhecida (resolvida em 2026-08-25)

Se um usuário fosse desabilitado entre o envio do magic link e o clique, o hook `session.create.before` lançava `UNAUTHORIZED` dentro da rota de verificação — que respondia JSON cru em vez de redirecionar para `/login`. O mesmo valia para a conta Google sem `User` correspondente no callback OAuth. Corrigido no `packages/auth`: o erro de negação carrega o código `STAFF_ACCESS_DENIED` (que o callback social já converte em redirect) e um `hooks.after` faz a rota de verificação do magic link redirecionar para `/login?error=STAFF_ACCESS_DENIED`. A tela de login distingue só dois casos — acesso negado ("Acesso não autorizado. Fale com a secretaria.") e link inválido/expirado — sem revelar qual dos três motivos de negação ocorreu.

## Copy (stop-slop)

A copy das duas telas passou pelas regras de `stop-slop`: voz ativa com sujeito humano, sem em-dash, sem enumeração de três itens por retórica, sem "rótulo: explicação". O corpo do `/login` coloca a pessoa na cena ("Você atende o telefone e responde na hora, sem abrir três planilhas") em vez de descrever o software de longe. O corpo do `/403` troca "Seu perfil não tem permissão" por "Você não tem permissão" — perfil não é quem age.

Jargão de mineração ficou restrito ao card decorativo (`AMOSTRA MINERAL`, `FORBIDDEN`), que é etiqueta de vitrine, não instrução. A copy que carrega significado é literal.
