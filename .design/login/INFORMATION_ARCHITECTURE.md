# Information Architecture: Porta de entrada

> Complementa `DESIGN_BRIEF.md`. Define a divisão entre superfície pública e superfície protegida do `apps/web` — o esqueleto que toda vertical futura herda.

## Site Map

- `/login` — **público**. Sessão ativa → redirect para `/`.
- `/403` — **tolerante**: renderiza com ou sem sessão. Fora do route group protegido de propósito (uma página de acesso negado que redireciona para o login seria um loop).
- `(app)/` — **route group protegido**. Layout server-side verifica a sessão; sem sessão → redirect `/login`.
  - `/` → redirect para `/alunos`.
  - `/alunos` — listagem (vertical de Alunos).
- `/api/auth/[...all]` — handler do Better Auth (magic link, callback do Google, sign-out). Não é superfície de navegação.

O route group `(app)` não aparece na URL: `/alunos` continua `/alunos`. O que ele carrega é o guard — entrar no grupo significa "esta rota exige sessão".

## Navigation Model

- **Não há navegação nesta entrega.** As três páginas são terminais: o login leva ao produto, o `/403` leva para fora ou de volta ao início.
- A navegação primária (sidebar) nasce com o AppShell da vertical de Alunos, dentro de `(app)/`.
- Sign-out mora na `/403` por ora; migra para o menu de usuário do AppShell quando ele existir.

## Content Hierarchy

### /login

1. **Painel editorial** (esquerda, ~50% em desktop): eyebrow `LAZULI —— ENTRAR`, título hero "Sua gestão escolar, / simplificada." e uma frase sobre o dia da secretaria. Apresenta o produto; não explica o login.
2. **Card de acesso** (direita, header `ACESSO`): botão "Entrar com Google" (caminho primário) → divisor "ou" → campo de email + "Receber link de acesso" → alert de erro quando houver. Footer com `MÉTODO: SEM SENHA` e `SESSÃO: 30 DIAS`.
3. **Estado enviado**: substitui o corpo do card (confirmação + "usar outro email"). O painel editorial não muda.

### /403

1. Eyebrow `ERRO 403 —— SEM PERMISSÃO` e título hero "Esta área / é restrita.".
2. Texto genérico de duas linhas, sem jargão.
3. Ações: "Voltar ao início" (primária) e "Sair" (só com sessão).
4. Rodapé `CÓDIGO DO ERRO: LAZ-403`; à direita, o card da amostra mineral.

## User Flows

### Login feliz — magic link

1. Visitante abre `/alunos` sem sessão → layout de `(app)` redireciona para `/login`.
2. Digita o email institucional → "Receber link de acesso".
3. Backend valida o acesso de staff **antes** de enviar; envia via SMTP (Mailpit em dev).
4. Card troca para "Enviamos um link para {email}".
5. Clica no link no email → `/api/auth/magic-link/verify` cria a sessão → redirect `/` → redirect `/alunos`.

### Login feliz — Google

1. `/login` → "Entrar com Google" → redirect OAuth.
2. Callback cria a sessão (o hook `session.create.before` barra quem não é staff) → `/` → `/alunos`.

### Acesso negado no envio

1. Email desconhecido, usuário desabilitado ou papel não habilitado → o backend lança `UNAUTHORIZED` antes de enviar.
2. Card permanece no formulário e mostra o alert genérico. Nenhum email é enviado — a tela não revela qual dos três casos ocorreu.

### Link inválido ou expirado

1. Clique em link já usado ou vencido → verificação redireciona para `/login?error=INVALID_TOKEN`.
2. `/login` abre com alert "Link inválido ou expirado. Peça um novo.", formulário pronto para novo envio.

### Sessão ativa chega no login

`/login` com sessão → redirect `/` → `/alunos`. Não existe tela de "você já está logado".

### Acesso sem permissão de papel

1. Usuário autenticado alcança uma URL restrita ao seu papel (nenhuma nesta entrega; o helper existe para as próximas).
2. Guard de papel → redirect `/403`.
3. "Sair" encerra a sessão e volta ao `/login`; "Voltar ao início" leva a `/`.

## URL Patterns

| Rota                  | Arquivo                          | Guard                                |
| --------------------- | -------------------------------- | ------------------------------------ |
| `/login`              | `app/login/page.tsx`             | Sessão presente → `redirect("/")`    |
| `/login?error=<code>` | idem                             | `error` só controla o alert exibido  |
| `/403`                | `app/403/page.tsx`               | nenhum                               |
| `/`                   | `app/(app)/page.tsx`             | sessão (layout do grupo) → `/alunos` |
| `/alunos`             | `app/(app)/alunos/page.tsx`      | sessão (layout do grupo)             |
| `/api/auth/*`         | `app/api/auth/[...all]/route.ts` | do Better Auth                       |

Slugs de rota em pt-BR (`/alunos`), como o resto do produto; `/login` e `/403` ficam como estão por serem convenções reconhecíveis.

## Estados de URL

- `?error=<code>` em `/login`: vem da verificação do magic link (`INVALID_TOKEN` e afins). Qualquer código conhecido cai na mesma mensagem — a tela não enumera causas.
- Nada mais nesta entrega usa estado de URL.
