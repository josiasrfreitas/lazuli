import { z } from "@lazuli/validators";

const profile = z.string().optional();

export const localAddressProfile =
  process.env.NODE_ENV === "development" ? profile.parse(process.env.AWS_PROFILE) : undefined;
