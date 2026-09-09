export function getTestEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...process.env, ...overrides };
}
