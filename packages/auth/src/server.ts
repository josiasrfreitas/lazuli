import type { AuthInstance } from "./auth.js";

let authInstance: Promise<AuthInstance> | undefined;

async function getAuth(): Promise<AuthInstance> {
  authInstance ??= createAuthInstance();
  return authInstance;
}

async function createAuthInstance(): Promise<AuthInstance> {
  const [{ db }, { createAuth }] = await Promise.all([import("@lazuli/db"), import("./auth.js")]);

  return createAuth({ database: db });
}

export const auth: AuthInstance = {
  async handler(request) {
    const instance = await getAuth();
    return instance.handler(request);
  },
};
