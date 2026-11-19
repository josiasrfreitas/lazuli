import { z } from "zod";

const maxLength = 1200;
const minNarrativeLength = 3;
const maxOwnerLength = 160;
const narrative = z
  .string()
  .trim()
  .min(minNarrativeLength, "Descreva o que aconteceu.")
  .max(maxLength);
const id = z.string().uuid();
const reference = z.discriminatedUnion("type", [
  z.object({ type: z.literal("renegotiation"), id }),
  z.object({ type: z.literal("renewal"), id }),
]);
const base = z.object({ id, semesterId: id, eventId: id, narrative }).strict();
export const exitRiskReasonSchema = z.enum([
  "FINANCIAL",
  "DISINTEREST",
  "SCHEDULE_CONFLICT",
  "COURSE_DISSATISFACTION",
  "RELOCATION_OR_TRANSPORT",
  "OTHER",
]);
export const exitRiskReasonLabels: Record<z.infer<typeof exitRiskReasonSchema>, string> = {
  FINANCIAL: "Financeiro",
  DISINTEREST: "Desinteresse",
  SCHEDULE_CONFLICT: "Incompatibilidade de horário",
  COURSE_DISSATISFACTION: "Insatisfação com o curso",
  RELOCATION_OR_TRANSPORT: "Mudança de cidade ou dificuldade de deslocamento",
  OTHER: "Outro motivo",
};
export const formationRiskSchema = base.extend({
  kind: z.literal("RISK"),
  riskReason: exitRiskReasonSchema.optional(),
  verbalReport: z.boolean({ message: "Informe se houve manifestação verbal." }),
});
export const formationCaseSchema = z.discriminatedUnion("kind", [
  formationRiskSchema,
  base.extend({ kind: z.literal("AGREEMENT"), reference }),
  base.extend({ kind: z.literal("CONTACT"), outcome: narrative }),
  base.extend({
    kind: z.literal("HANDOFF"),
    nextOwner: z.string().trim().min(1, "Informe quem assume o caso.").max(maxOwnerLength),
    outcome: narrative,
    reference: reference.optional(),
  }),
  base.extend({
    version: z.number().int().positive(),
    kind: z.literal("REVIEW"),
    reassessment: z.enum(["CONTINUES", "CHANGED", "RESOLVED"]),
  }),
  base.extend({ kind: z.literal("NOTE") }),
  base.extend({ version: z.number().int().positive(), kind: z.literal("SCHEDULE_RISK") }),
  base.extend({
    version: z.number().int().positive(),
    kind: z.literal("CHANGE_REQUEST"),
    outcome: z.enum(["Horário", "Modalidade", "Adaptação"], {
      message: "Selecione o motivo da troca.",
    }),
  }),
  base.extend({ version: z.number().int().positive(), kind: z.literal("RETRACT_REQUEST") }),
  base.extend({ version: z.number().int().positive(), kind: z.literal("BLOCK") }),
  base.extend({ version: z.number().int().positive(), kind: z.literal("UNBLOCK") }),
]);
export type FormationCaseInput = z.infer<typeof formationCaseSchema>;
