import { randomBytes } from "node:crypto";

const CODE_BYTES = 6;
/** Generated once on creation; independent from editable academic names. */
export function generateClassInternalCode(year: number): string {
  return `TUR-${year}-${randomBytes(CODE_BYTES).toString("hex").toUpperCase()}`;
}
