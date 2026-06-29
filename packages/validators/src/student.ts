import { z } from "zod";

export const DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE =
  "Informe o tipo do documento quando preencher o numero.";
export const MINOR_REQUIRES_GUARDIAN_MESSAGE =
  "Responsavel obrigatorio para alunos menores de idade.";
export const MINOR_GUARDIAN_REQUIRES_CONTACT_MESSAGE =
  "Informe telefone ou email do responsavel para alunos menores de idade.";

const REQUIRED_TEXT_MESSAGE = "Campo obrigatorio.";
const INVALID_DATE_MESSAGE = "Data invalida.";
const SEARCH_QUERY_MAX_LENGTH = 80;

const requiredText = z.string().trim().min(1, REQUIRED_TEXT_MESSAGE);
const optionalText = z.string().trim().min(1, REQUIRED_TEXT_MESSAGE).nullish();

export const documentTypeSchema = z.enum(["CPF", "RG"]);
export const studentStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DROPPED", "SUSPENDED"]);
export const dateOnlyInputSchema = z.coerce.date({
  errorMap: () => ({ message: INVALID_DATE_MESSAGE }),
});

export const addressInputSchema = z
  .object({
    street: optionalText,
    number: optionalText,
    complement: optionalText,
    neighborhood: optionalText,
    city: optionalText,
    state: optionalText,
    postalCode: optionalText,
  })
  .strict();

const personDocumentShape = {
  documentType: documentTypeSchema.nullish(),
  documentNumber: optionalText,
};

export const guardianCreateInputSchema = z
  .object({
    ...personDocumentShape,
    fullName: requiredText,
    relationship: optionalText,
    phone: optionalText,
    email: optionalText,
    address: addressInputSchema.nullish(),
  })
  .strict()
  .superRefine(validateDocumentPair);

export const guardianUpdateInputSchema = z
  .object({
    ...personDocumentShape,
    fullName: requiredText.optional(),
    relationship: optionalText,
    phone: optionalText,
    email: optionalText,
    address: addressInputSchema.nullish(),
  })
  .strict()
  .superRefine(validateDocumentPair);

export const createGuardianReferenceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("connect"), id: z.string().uuid() }).strict(),
  z
    .object({
      mode: z.literal("create"),
      input: guardianCreateInputSchema,
      useStudentAddress: z.boolean().optional(),
    })
    .strict(),
]);

export const updateGuardianReferenceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("connect"), id: z.string().uuid() }).strict(),
  z.object({ mode: z.literal("disconnect") }).strict(),
  z
    .object({
      mode: z.literal("create"),
      input: guardianCreateInputSchema,
      useStudentAddress: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("update"),
      input: guardianUpdateInputSchema,
      useStudentAddress: z.boolean().optional(),
    })
    .strict(),
]);

export const studentCreateInputSchema = z
  .object({
    ...personDocumentShape,
    fullName: requiredText,
    phone: optionalText,
    email: optionalText,
    birthDate: dateOnlyInputSchema.nullish(),
    status: studentStatusSchema.optional(),
    notes: optionalText,
    address: addressInputSchema.nullish(),
    guardian: createGuardianReferenceSchema.optional(),
  })
  .strict()
  .superRefine(validateDocumentPair);

export const studentUpdateContactInputSchema = z
  .object({
    ...personDocumentShape,
    fullName: requiredText.optional(),
    phone: optionalText,
    email: optionalText,
    birthDate: dateOnlyInputSchema.nullish(),
    address: addressInputSchema.nullish(),
    guardian: updateGuardianReferenceSchema.optional(),
  })
  .strict()
  .superRefine(validateDocumentPair);
export const studentIdInputSchema = z.object({ id: z.string().uuid() }).strict();
export const studentUpdateContactProcedureInputSchema = z
  .object({
    id: studentIdInputSchema.shape.id,
    input: studentUpdateContactInputSchema,
  })
  .strict();

export const studentUpdateNotesInputSchema = z
  .object({ id: z.string().uuid(), notes: z.string().trim().nullish() })
  .strict();

export const studentSearchInputSchema = z
  .object({ query: requiredText.max(SEARCH_QUERY_MAX_LENGTH) })
  .strict();

function requireDocumentType(
  documentType: z.infer<typeof documentTypeSchema> | null | undefined,
  context: z.RefinementCtx,
): void {
  if (documentType === null || documentType === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE,
      path: ["documentType"],
    });
  }
}

type DocumentPairInput = {
  documentNumber?: string | null | undefined;
  documentType?: z.infer<typeof documentTypeSchema> | null | undefined;
};

function validateDocumentPair(input: DocumentPairInput, context: z.RefinementCtx): void {
  if (input.documentNumber !== null && input.documentNumber !== undefined) {
    requireDocumentType(input.documentType, context);
  }
}
