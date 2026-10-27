import { z } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import type { NewStudentFieldName, NewStudentFields } from "../students/new-student/reducer";
export const extractionSchema = z.object({
  fields: z.object({
    name: z.string().nullable(),
    cpf: z.string().nullable(),
    rg: z.string().nullable(),
    birthDate: z.string().nullable(),
  }),
});
export type DocumentRow = RouterOutputs["studentDocuments"]["status"]["files"][number];
function extractedValues(file: DocumentRow): Partial<Record<NewStudentFieldName, string | null>> {
  const result = extractionSchema.safeParse(file.extraction);
  if (!result.success) return {};
  const fields = result.data.fields;
  if (file.kind === "guardian") return { guardianName: fields.name };
  if (file.kind !== "student") return {};
  const documentType = fields.cpf ? "CPF" : "RG";
  return {
    fullName: fields.name,
    birthDate: fields.birthDate,
    documentNumber: fields.cpf ?? fields.rg,
    documentType: fields.cpf || fields.rg ? documentType : null,
  };
}
export function documentPrefill(
  file: DocumentRow,
  {
    fields,
    touched,
    automatic = new Map(),
  }: {
    fields: NewStudentFields;
    touched: Set<NewStudentFieldName>;
    automatic?: Map<NewStudentFieldName, string>;
  },
): [NewStudentFieldName, string][] {
  if (file.status !== "READY") return [];
  const values = extractedValues(file);
  const result: [NewStudentFieldName, string][] = [];
  for (const [field, value] of Object.entries(values) as [NewStudentFieldName, string | null][]) {
    if (!shouldPrefill({ field, value }, { fields, touched, automatic })) continue;
    result.push([field, value ?? ""]);
  }
  return result;
}
function shouldPrefill(
  { field, value }: { field: NewStudentFieldName; value: string | null },
  {
    fields,
    touched,
    automatic,
  }: {
    fields: NewStudentFields;
    touched: Set<NewStudentFieldName>;
    automatic: Map<NewStudentFieldName, string>;
  },
): boolean {
  const wasAutomatic = automatic.has(field) && automatic.get(field) === fields[field];
  if (touched.has(field) || (fields[field] && !wasAutomatic)) return false;
  if (!value && !wasAutomatic) return false;
  if (field !== "documentType") return true;
  return (
    !touched.has("documentNumber") &&
    !(fields.documentNumber && automatic.get("documentNumber") !== fields.documentNumber)
  );
}
