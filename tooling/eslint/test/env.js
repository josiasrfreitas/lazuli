/** Provides the inherited process environment to hook integration tests. */
export function getTestEnvironment(overrides) {
  return { ...process.env, ...overrides };
}
