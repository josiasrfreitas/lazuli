import { z } from "zod";

const hatchetEnvironmentSchema = z.object({
  HATCHET_CLIENT_TOKEN: z.string().min(1),
  HATCHET_CLIENT_NAMESPACE: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
});
export function readHatchetEnvironment(): z.infer<typeof hatchetEnvironmentSchema> {
  return hatchetEnvironmentSchema.parse(process.env);
}
