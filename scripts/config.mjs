/** Returns a child-process environment with explicit overrides. */
const DEFAULT_WORKSPACE_COMPOSE_HEALTH_TIMEOUT_MS = 120_000;

export function getProcessEnvironment(overrides = {}) {
  return { ...process.env, ...overrides };
}

/** Prevents Git hooks from leaking their repository/index context into nested fixture commands. */
export function getGitIndependentProcessEnvironment(overrides = {}) {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))),
    ...overrides,
  };
}

export const workspaceComposeHealthTimeoutMs = Number(
  process.env.LAZULI_COMPOSE_HEALTH_TIMEOUT_MS ?? DEFAULT_WORKSPACE_COMPOSE_HEALTH_TIMEOUT_MS,
);
