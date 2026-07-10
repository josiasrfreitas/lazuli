/**
 * RFC 4180-style CSV serialization for generated report artifacts. A UTF-8
 * BOM is prepended so Excel opens pt-BR accents correctly.
 */

const UTF8_BOM = "\uFEFF";
const CSV_DELIMITER = ",";
const CSV_LINE_BREAK = "\r\n";
const CSV_QUOTE = '"';
const NEEDS_QUOTING = /[",\r\n]/;

export function csvEscape(value: string): string {
  if (!NEEDS_QUOTING.test(value)) {
    return value;
  }

  return `${CSV_QUOTE}${value.replaceAll(CSV_QUOTE, `${CSV_QUOTE}${CSV_QUOTE}`)}${CSV_QUOTE}`;
}

/** Serializes header + data rows into one BOM-prefixed CSV document. */
export function buildCsvDocument(rows: readonly (readonly string[])[]): string {
  const lines = rows.map((row) => row.map((cell) => csvEscape(cell)).join(CSV_DELIMITER));

  return `${UTF8_BOM}${lines.join(CSV_LINE_BREAK)}${CSV_LINE_BREAK}`;
}
