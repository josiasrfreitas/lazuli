---
version: 1
slug: "apps-web-src-app-login-login-card-tsx"
primary_target: "apps/web/src/app/login/login-card.tsx"
related_targets: ["apps/web/src/app/login/page.tsx"]
---

# Staff login

Mode: Operate. Extend the existing login surface with email/password, retaining magic-link access.
Audience: pre-provisioned school staff. Public registration remains closed.

## Direction contract

THESIS: Staff can enter immediately with a familiar email/password form, with one primary action and explicit recovery.
OWN-WORLD: Preserve the existing school photograph, navy access panel, gold brand, display headings and shared form controls.
STORY: Enter credentials; for staff without a password, offer separate magic-link login and password registration. Registration emails open /cadastrar-senha on the same site. Existing password recovery remains a separate action. Show pending, failure, expired-link and success states with a clear next action.
FIRST VIEWPORT: Keep the current masthead, photograph and left headline. Add the password field below email in the right panel; Entrar is primary, recovery and magic link secondary. On narrow screens use the existing stacked composition without horizontal overflow.
FORM: Local extension of the established login. No concept seed required; the user requested password login in addition to the existing flow.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

The owner explicitly requested implementation without lint, tests or checks.

No new visual world or shipping raster assets. Compare implementation to the incumbent CSS and assets.
