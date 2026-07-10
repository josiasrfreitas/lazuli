/**
 * Shared pdfmake layout for generated reports: style dictionary, page frame,
 * footer, and table helpers. Templates stay pure — the generation timestamp
 * is injected as a pre-formatted string, never read from the clock here.
 */

import type {
  Content,
  ContentTable,
  StyleDictionary,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

const PAGE_MARGIN = 40;
const FOOTER_MARGIN_TOP = 10;
const FOOTER_FONT_SIZE = 8;
const BASE_FONT_SIZE = 10;
const TITLE_FONT_SIZE = 16;
const SECTION_FONT_SIZE = 12;
const TABLE_FONT_SIZE = 9;
const SUBTITLE_SPACING = 12;
const SECTION_SPACING_TOP = 14;
const SECTION_SPACING_BOTTOM = 6;
const NOTE_SPACING_TOP = 4;

export const REPORT_STYLES: StyleDictionary = {
  reportTitle: { fontSize: TITLE_FONT_SIZE, bold: true },
  reportSubtitle: {
    fontSize: TABLE_FONT_SIZE,
    color: "#555555",
    margin: [0, 2, 0, SUBTITLE_SPACING],
  },
  sectionHeader: {
    fontSize: SECTION_FONT_SIZE,
    bold: true,
    margin: [0, SECTION_SPACING_TOP, 0, SECTION_SPACING_BOTTOM],
  },
  tableHeader: { fontSize: TABLE_FONT_SIZE, bold: true, fillColor: "#EEEEEE" },
  tableCell: { fontSize: TABLE_FONT_SIZE },
  metaLine: { fontSize: BASE_FONT_SIZE, margin: [0, 1, 0, 1] },
  note: {
    fontSize: FOOTER_FONT_SIZE,
    italics: true,
    color: "#666666",
    margin: [0, NOTE_SPACING_TOP, 0, 0],
  },
};

/** Wraps report content in the shared A4 frame with title, subtitle, and page footer. */
export function buildReportDocument(input: {
  title: string;
  generatedAtLabel: string;
  content: Content[];
}): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN + FOOTER_MARGIN_TOP],
    defaultStyle: { font: "Roboto", fontSize: BASE_FONT_SIZE },
    styles: REPORT_STYLES,
    footer: (currentPage, pageCount) => ({
      text: `Página ${currentPage} de ${pageCount}`,
      alignment: "center",
      fontSize: FOOTER_FONT_SIZE,
      color: "#666666",
      margin: [0, FOOTER_MARGIN_TOP, 0, 0],
    }),
    content: [
      { text: input.title, style: "reportTitle" },
      { text: `Gerado em ${input.generatedAtLabel}`, style: "reportSubtitle" },
      ...input.content,
    ],
  };
}

/** Header + string rows as a full-width striped table. */
export function buildDataTable(input: {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  widths?: readonly (string | number)[];
}): ContentTable {
  return {
    table: {
      headerRows: 1,
      widths: [...(input.widths ?? input.headers.map(() => "*"))],
      body: [
        input.headers.map((header) => ({ text: header, style: "tableHeader" })),
        ...input.rows.map((row) => row.map((cell) => ({ text: cell, style: "tableCell" }))),
      ],
    },
    layout: "lightHorizontalLines",
  };
}

/** "Label: value" meta line under a section. */
export function metaLine(label: string, value: string): Content {
  return {
    text: [{ text: `${label}: `, bold: true }, { text: value }],
    style: "metaLine",
  };
}
