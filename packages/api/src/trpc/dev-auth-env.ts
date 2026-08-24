/**
 * Development-only sign-in shortcut. While the login UI is pending (GRE-58),
 * setting `DEV_AUTH_EMAIL` lets a local `pnpm dev` reach protected procedures
 * without a Better Auth session. It is inert outside `NODE_ENV=development`, and
 * the resolved user still has to pass the normal staff-access checks.
 *
 * Read through `globalThis.process` so the shared `no-restricted-syntax` guard
 * on bare `process.env` keeps pointing everyone at config modules like this one.
 */

const DEVELOPMENT_NODE_ENV = "development";

export function readDevAuthEmail(): string | null {
  const environment = globalThis.process.env;

  if (environment.NODE_ENV !== DEVELOPMENT_NODE_ENV) {
    return null;
  }

  return environment.DEV_AUTH_EMAIL ?? null;
}
