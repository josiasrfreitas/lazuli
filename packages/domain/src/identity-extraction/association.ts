import type { FieldAnchor, IdentityOcrLine, OcrBox } from "./types.js";

const COLUMN_TOLERANCE = 0.09;
const ROW_TOLERANCE = 0.7;
const MAX_LABEL_GAP = 7;
const FALLBACK_WINDOW = 5;
const MAX_NAME_LINES = 3;
const NAME_LINE_GAP = 1.8;
export interface AssociatedText {
  raw: string;
  lines: IdentityOcrLine[];
  method: "inline" | "geometry" | "text-order" | "document-scan";
}
function rowAligned(first: OcrBox, second: OcrBox): boolean {
  return Math.abs(first.top - second.top) <= Math.max(first.height, second.height) * ROW_TOLERANCE;
}
function belowAligned(first: OcrBox, second: OcrBox): boolean {
  const gap = second.top - first.top;
  return (
    gap > first.height * ROW_TOLERANCE &&
    gap <= first.height * MAX_LABEL_GAP &&
    Math.abs(second.left - first.left) <= COLUMN_TOLERANCE
  );
}
function reachable(label: OcrBox, value: OcrBox): boolean {
  return (
    belowAligned(label, value) ||
    (rowAligned(label, value) && value.left >= label.left + label.width)
  );
}
function blocksPath({ from, to, box }: { from: OcrBox; to: OcrBox; box: OcrBox }): boolean {
  if (rowAligned(from, to))
    return rowAligned(box, to) && box.left > from.left && box.left < to.left;
  return (
    box.top >= from.top &&
    box.top < to.top &&
    Math.abs(box.left - to.left) <= COLUMN_TOLERANCE &&
    (box.top > from.top + from.height * ROW_TOLERANCE ||
      Math.abs(box.left - to.left) < Math.abs(from.left - to.left))
  );
}
function blocked(input: {
  anchor: FieldAnchor;
  value: IdentityOcrLine;
  anchors: readonly FieldAnchor[];
}): boolean {
  const from = input.anchor.line.box!;
  const to = input.value.box!;
  return input.anchors.some(({ line }) => {
    if (line.id === input.anchor.line.id || line.page !== input.value.page || !line.box)
      return false;
    return blocksPath({ from, to, box: line.box });
  });
}
function geometryValues(input: {
  anchor: FieldAnchor;
  lines: readonly IdentityOcrLine[];
  anchors: readonly FieldAnchor[];
}): IdentityOcrLine[] {
  const label = input.anchor.line;
  const anchorIds = new Set(input.anchors.map((anchor) => anchor.line.id));
  return input.lines
    .filter(
      (line) =>
        line.page === label.page &&
        line.box &&
        !anchorIds.has(line.id) &&
        reachable(label.box!, line.box) &&
        !blocked({ ...input, value: line }),
    )
    .toSorted(
      (first, second) => first.box!.top - second.box!.top || first.box!.left - second.box!.left,
    );
}
function stopsTextSearch(anchor: FieldAnchor, next: FieldAnchor | undefined): boolean {
  if (!next) return false;
  if (next.field === anchor.field || anchor.field === "name") return true;
  return (
    anchor.field === "birthDate" && /VALIDADE|EXPIRY|EMISSAO|EXPEDICAO|ISSUE/iu.test(next.line.text)
  );
}
function textValues(input: {
  anchor: FieldAnchor;
  lines: readonly IdentityOcrLine[];
  anchors: readonly FieldAnchor[];
}): IdentityOcrLine[] {
  const index = input.lines.findIndex((line) => line.id === input.anchor.line.id);
  const following = input.lines.slice(index + 1, index + 1 + FALLBACK_WINDOW);
  const found: IdentityOcrLine[] = [];
  for (const line of following) {
    if (line.page !== input.anchor.line.page) break;
    const label = input.anchors.find((anchor) => anchor.line.id === line.id);
    if (stopsTextSearch(input.anchor, label)) break;
    if (!label) found.push(line);
  }
  return found;
}
function wrappedName(lines: readonly IdentityOcrLine[]): IdentityOcrLine[] {
  const selected: IdentityOcrLine[] = [];
  for (const line of lines.slice(0, MAX_NAME_LINES)) {
    const previous = selected.at(-1);
    if (
      previous?.box &&
      line.box &&
      (line.box.top - previous.box.top > previous.box.height * NAME_LINE_GAP ||
        Math.abs(line.box.left - previous.box.left) > COLUMN_TOLERANCE)
    )
      break;
    if (!/^[\p{L} .’'-]+$/u.test(line.text)) break;
    selected.push(line);
  }
  return selected;
}
export function associatedTexts(input: {
  anchor: FieldAnchor;
  lines: readonly IdentityOcrLine[];
  anchors: readonly FieldAnchor[];
}): AssociatedText[] {
  const inline: AssociatedText[] = input.anchor.remainder
    ? [{ raw: input.anchor.remainder, lines: [input.anchor.line], method: "inline" }]
    : [];
  const geometric = Boolean(input.anchor.line.box);
  const lines = geometric ? geometryValues(input) : textValues(input);
  const method: AssociatedText["method"] = geometric ? "geometry" : "text-order";
  if (input.anchor.field !== "name")
    return [...inline, ...lines.map((line) => ({ raw: line.text, lines: [line], method }))];
  const name = geometric ? wrappedName(lines) : lines.slice(0, 1);
  return name.length > 0
    ? [...inline, { raw: name.map((line) => line.text).join(" "), lines: name, method }]
    : inline;
}
