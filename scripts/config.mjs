/** Returns a child-process environment with explicit overrides. */
const DEFAULT_WORKSPACE_COMPOSE_HEALTH_TIMEOUT_MS = 120_000;

export function getProcessEnvironment(overrides = {}) {
  return { ...process.env, ...overrides };
}

export const workspaceComposeHealthTimeoutMs = Number(
  process.env.LAZULI_COMPOSE_HEALTH_TIMEOUT_MS ?? DEFAULT_WORKSPACE_COMPOSE_HEALTH_TIMEOUT_MS,
);
