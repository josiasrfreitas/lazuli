/**
 * Server-side pdfmake rendering: docDefinition → PDF bytes. Uses the Roboto
 * fonts bundled with pdfmake (base64 vfs) so pt-BR accents render correctly
 * without external font files.
 */

import PdfPrinter from "pdfmake";
import vfs from "pdfmake/build/vfs_fonts.js";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

const ROBOTO_FONTS = {
  Roboto: {
    normal: fontBuffer(vfs["Roboto-Regular.ttf"]),
    bold: fontBuffer(vfs["Roboto-Medium.ttf"]),
    italics: fontBuffer(vfs["Roboto-Italic.ttf"]),
    bolditalics: fontBuffer(vfs["Roboto-MediumItalic.ttf"]),
  },
};

export function renderPdf(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const printer = new PdfPrinter(ROBOTO_FONTS);
    const document = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    document.on("error", reject);
    document.end();
  });
}

function fontBuffer(base64: string | undefined): Buffer {
  if (base64 === undefined) {
    throw new Error("Fonte Roboto não encontrada no vfs do pdfmake.");
  }

  return Buffer.from(base64, "base64");
}
