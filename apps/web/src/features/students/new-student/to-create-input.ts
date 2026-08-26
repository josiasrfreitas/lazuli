import { studentCreateInputSchema, type z } from "@lazuli/validators";

import type { NewStudentFields } from "./reducer";

export type StudentCreateInput = z.input<typeof studentCreateInputSchema>;

function orUndefined(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed === "" ? undefined : trimmed;
}

/**
 * Wizard fields → `students.create` input. Empty strings become absent fields;
 * the date-only birth date is pinned to UTC midnight so no timezone shifts the
 * calendar day the secretary typed.
 */
export function toCreateInput(fields: NewStudentFields): StudentCreateInput {
  const guardianName = orUndefined(fields.guardianName);

  return {
    fullName: fields.fullName.trim(),
    phone: orUndefined(fields.phone),
    email: orUndefined(fields.email),
    birthDate: fields.birthDate === "" ? undefined : new Date(`${fields.birthDate}T00:00:00.000Z`),
    documentType: fields.documentType === "" ? undefined : (fields.documentType as "CPF" | "RG"),
    documentNumber: orUndefined(fields.documentNumber),
    guardian:
      guardianName === undefined
        ? undefined
        : {
            mode: "create",
            input: {
              fullName: guardianName,
              phone: orUndefined(fields.guardianPhone),
              email: orUndefined(fields.guardianEmail),
            },
          },
  };
}
