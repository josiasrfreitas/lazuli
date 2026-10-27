import { z } from "zod";

const addressSearchEnvironmentSchema = z.object({
  AWS_LOCATION_REGION: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).optional(),
});

export function readAddressSearchRegion(): string {
  const environment = addressSearchEnvironmentSchema.parse(process.env);
  return environment.AWS_LOCATION_REGION ?? environment.AWS_REGION ?? "us-east-2";
}
