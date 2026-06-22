/** Returns a child-process environment with explicit overrides. */
export function getProcessEnvironment(overrides = {}) {
  return { ...process.env, ...overrides };
}
