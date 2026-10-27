export type IdentityField = "cpf" | "name" | "rg" | "birthDate";
export type DocumentFamily = "cin" | "rg" | "unknown";
export interface OcrBox {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** Provider-neutral lines. Coordinates are page-relative, 0..1; page starts at 1. */
export interface IdentityOcrLine {
  id: string;
  text: string;
  page: number;
  box?: OcrBox;
  confidence?: number;
}
export interface FieldCandidate {
  value: string;
  raw: string;
  lineIds: string[];
  labelId: string;
  method: "inline" | "geometry" | "text-order" | "document-scan";
  validation: "valid" | "invalid";
  warnings: string[];
  ocrConfidence: number | null;
}
export interface ExtractedIdentityField {
  value: string | null;
  status: "found" | "missing" | "ambiguous" | "invalid" | "not_applicable";
  candidates: FieldCandidate[];
}
export interface IdentityExtraction {
  version: "1";
  family: DocumentFamily;
  fields: Record<IdentityField, ExtractedIdentityField>;
  /** Extraction is never an identity or authenticity verification. */
  requiresReview: true;
  warnings: string[];
}
export interface FieldAnchor {
  line: IdentityOcrLine;
  field: IdentityField | "other";
  remainder: string;
}
