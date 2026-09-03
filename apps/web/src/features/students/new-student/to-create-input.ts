import { studentCreateInputSchema, type z } from "@lazuli/validators";

import { parseDateBR } from "~/lib/masks";

import type { NewStudentFields } from "./reducer";

export type StudentCreateInput = z.input<typeof studentCreateInputSchema>;

function orUndefined(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed === "" ? undefined : trimmed;
}

/**
 * Wizard fields → `students.create` input. Empty strings become absent fields;
 * the `dd/mm/aaaa` birth date is pinned to UTC midnight so no timezone shifts
 * the calendar day the secretary typed (the reducer already rejected invalid
 * dates, so an unparsable value here is simply absent).
 */
export function toCreateInput(fields: NewStudentFields): StudentCreateInput {
  const guardianName = orUndefined(fields.guardianName);
  const birthDate = parseDateBR(fields.birthDate);

  return {
    fullName: fields.fullName.trim(),
    phone: orUndefined(fields.phone),
    email: orUndefined(fields.email),
    birthDate: birthDate === null ? undefined : new Date(`${birthDate}T00:00:00.000Z`),
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
