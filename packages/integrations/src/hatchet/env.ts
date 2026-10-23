import { z } from "zod";

const hatchetEnvironmentSchema = z.object({
  HATCHET_CLIENT_TOKEN: z.string().min(1),
  HATCHET_CLIENT_NAMESPACE: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
});
export function readHatchetEnvironment(): z.infer<typeof hatchetEnvironmentSchema> {
  const parsed = hatchetEnvironmentSchema.parse(process.env);
  const deploymentEnvironment = process.env.LAZULI_ENV;
  if (
    (deploymentEnvironment === "staging" || deploymentEnvironment === "prod") &&
    parsed.HATCHET_CLIENT_NAMESPACE !== `lazuli-${deploymentEnvironment}`
  ) {
    throw new Error(`HATCHET_CLIENT_NAMESPACE must be lazuli-${deploymentEnvironment}.`);
  }
  return parsed;
}
