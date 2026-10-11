import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
const MAX_NAME = 160;
const MAX_NOTE = 2000;
const optionalText = z.string().trim().max(MAX_NAME).nullable();
export const leadCaptureSchema = z
  .object({
    id: z.string().uuid(),
    fullName: z.string().trim().min(1, "Informe o nome do futuro aluno.").max(MAX_NAME),
    phone: optionalText,
    email: z.union([z.string().trim().email(), z.literal("")]).nullable(),
    contactName: optionalText,
    source: optionalText,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.phone && !value.email)
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Informe telefone ou e-mail para contato.",
      });
  });
export const leadNextStepSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string().uuid().nullable(),
    nextAction: z.string().trim().max(MAX_NOTE).nullable(),
    nextActionOn: civilDateSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.nextAction) !== Boolean(value.nextActionOn))
      context.addIssue({
        code: "custom",
        path: ["nextActionOn"],
        message: "Informe o próximo passo e a data juntos.",
      });
  });
export const leadContactSchema = z
  .object({
    id: z.string().uuid(),
    candidateId: z.string().uuid(),
    contactedOn: civilDateSchema,
    summary: z.string().trim().min(1, "Registre o que foi conversado.").max(MAX_NOTE),
  })
  .strict();
