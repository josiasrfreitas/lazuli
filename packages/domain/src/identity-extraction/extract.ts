import { associatedTexts, type AssociatedText } from "./association.js";
import { anchorFor, documentFamily, normalized } from "./profiles.js";
import { parseFieldValue } from "./values.js";
import type {
  ExtractedIdentityField,
  FieldAnchor,
  FieldCandidate,
  IdentityExtraction,
  IdentityField,
  IdentityOcrLine,
} from "./types.js";

const LOW_OCR_CONFIDENCE = 90;
const FIELD_NAMES: IdentityField[] = ["cpf", "name", "rg", "birthDate"];
function candidate(input: {
  anchor: FieldAnchor;
  text: AssociatedText;
  today: string;
}): FieldCandidate | undefined {
  if (input.anchor.field === "other") return undefined;
  const parsed = parseFieldValue({
    field: input.anchor.field,
    raw: input.text.raw,
    today: input.today,
  });
  if (!parsed) return undefined;
  const lines = [input.anchor.line, ...input.text.lines];
  const confidences = lines.flatMap((line) =>
    line.confidence === undefined ? [] : [line.confidence],
  );
  const ocrConfidence = confidences.length > 0 ? Math.min(...confidences) : null;
  const warnings = [...parsed.warnings];
  if (input.text.method === "document-scan") warnings.push("cpf_label_unrecognized");
  if (input.text.method === "text-order") warnings.push("geometry_unavailable");
  if (ocrConfidence !== null && ocrConfidence < LOW_OCR_CONFIDENCE)
    warnings.push("low_ocr_confidence");
  return {
    value: parsed.value,
    raw: input.text.raw,
    lineIds: [...new Set(lines.map((line) => line.id))],
    labelId: input.anchor.line.id,
    method: input.text.method,
    validation: parsed.valid ? "valid" : "invalid",
    warnings,
    ocrConfidence,
  };
}
function resolved(candidates: FieldCandidate[]): ExtractedIdentityField {
  const valid = candidates.filter((entry) => entry.validation === "valid");
  const values = new Set(valid.map((entry) => normalized(entry.value)));
  if (values.size > 1) return { status: "ambiguous", value: null, candidates };
  if (valid.length > 0) return { status: "found", value: valid[0]!.value, candidates };
  return { status: candidates.length > 0 ? "invalid" : "missing", value: null, candidates };
}
function fieldResult(input: {
  field: IdentityField;
  lines: readonly IdentityOcrLine[];
  anchors: FieldAnchor[];
  today: string;
}): ExtractedIdentityField {
  const candidates: FieldCandidate[] = [];
  for (const anchor of input.anchors.filter((entry) => entry.field === input.field)) {
    for (const text of associatedTexts({ ...input, anchor })) {
      const found = candidate({ anchor, text, today: input.today });
      if (found) candidates.push(found);
      // A complete inline value belongs to this label; do not also consume the
      // next row. An unreadable label suffix must not hide a value below it.
      if (found?.validation === "valid" && text.method === "inline") break;
    }
  }
  return resolved(candidates);
}
function standaloneCpf(lines: readonly IdentityOcrLine[], today: string): ExtractedIdentityField {
  const candidates = lines.flatMap((line) => {
    if (anchorFor(line)) return [];
    const found = candidate({
      anchor: { line, field: "cpf", remainder: "" },
      text: { raw: line.text, lines: [line], method: "document-scan" },
      today,
    });
    return found?.validation === "valid" ? [found] : [];
  });
  // A unique checksum-valid CPF can survive an unreadable label. Multiple
  // different CPFs stay ambiguous; never select an arbitrary number.
  return resolved(candidates);
}
function validBox(box: NonNullable<IdentityOcrLine["box"]>): boolean {
  const { left, top, width, height } = box;
  return (
    [left, top, width, height].every((value) => Number.isFinite(value)) &&
    left >= 0 &&
    top >= 0 &&
    width > 0 &&
    height > 0 &&
    left + width <= 1 &&
    top + height <= 1
  );
}
function validLine(line: IdentityOcrLine): boolean {
  if (!line.id || !line.text.trim() || !Number.isInteger(line.page) || line.page < 1) return false;
  if (!line.box) return true;
  return validBox(line.box);
}
/** Pure extraction from a single holder's document. Never use the result to auto-verify identity. */
export function extractIdentityDocument(input: {
  lines: readonly IdentityOcrLine[];
  today: string;
}): IdentityExtraction {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.today))
    throw new Error("today must be an ISO calendar date");
  const lines = input.lines.filter((line) => validLine(line));
  if (new Set(lines.map((line) => line.id)).size !== lines.length)
    throw new Error("OCR line IDs must be unique");
  const family = documentFamily(lines);
  const anchors = lines.flatMap((line) => {
    const anchor = anchorFor(line);
    return anchor ? [anchor] : [];
  });
  const fields = {} as Record<IdentityField, ExtractedIdentityField>;
  for (const field of FIELD_NAMES)
    fields[field] =
      family === "cin" && field === "rg"
        ? { value: null, status: "not_applicable", candidates: [] }
        : fieldResult({ field, lines, anchors, today: input.today });
  if (family !== "unknown" && fields.cpf.status === "missing")
    fields.cpf = standaloneCpf(lines, input.today);
  return {
    version: "1",
    family,
    fields,
    requiresReview: true,
    warnings: lines.length === input.lines.length ? [] : ["invalid_ocr_lines_ignored"],
  };
}
