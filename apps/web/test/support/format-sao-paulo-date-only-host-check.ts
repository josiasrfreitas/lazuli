import { toDateOnlySaoPaulo } from "../../src/lib/format.js";

const SAO_PAULO_BOUNDARY_INSTANT: unknown = new Date("2026-07-01T02:30:00.000Z");

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

function assertDate(value: unknown): asserts value is Date {
  if (!isDate(value)) {
    throw new TypeError("Expected a Date input.");
  }
}

assertDate(SAO_PAULO_BOUNDARY_INSTANT);

process.stdout.write(toDateOnlySaoPaulo(SAO_PAULO_BOUNDARY_INSTANT));
