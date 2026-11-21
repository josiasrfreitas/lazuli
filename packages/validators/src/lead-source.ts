import { z } from "zod";

export const leadSourceSchema = z.enum([
  "REFERRAL",
  "INSTAGRAM",
  "WHATSAPP",
  "WEBSITE",
  "SCHOOL_VISIT",
  "GOOGLE",
  "OTHER",
]);
export const leadSourceLabels: Record<z.infer<typeof leadSourceSchema>, string> = {
  REFERRAL: "Indicação",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Site",
  SCHOOL_VISIT: "Visita à escola",
  GOOGLE: "Pesquisa no Google",
  OTHER: "Outro",
};

const MAX_SOURCE_DETAIL_LENGTH = 160;
export const sourceDetailSchema = z.string().trim().max(MAX_SOURCE_DETAIL_LENGTH).nullish();

export function validateLeadSource(
  value: { source?: string | null | undefined; sourceDetail?: string | null | undefined },
  context: z.RefinementCtx,
): void {
  if (value.source === "OTHER" && !value.sourceDetail)
    context.addIssue({
      code: "custom",
      path: ["sourceDetail"],
      message: "Informe a origem do lead.",
    });
}
