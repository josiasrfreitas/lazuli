import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttachmentPanel } from "../../src/components/attachment-panel.js";

void it("makes a closed attachment panel inert while retaining its content", () => {
  const html = renderToStaticMarkup(
    createElement(AttachmentPanel, {
      id: "student-document-panel",
      title: "Anexos do aluno",
      open: false,
      children: createElement("p", null, "Documento recebido"),
    }),
  );
  assert.match(html, /<aside[^>]*id="student-document-panel"/);
  assert.match(html, /aria-label="Anexos do aluno"/);
  assert.match(html, /data-open="false"/);
  assert.match(html, /inert=""/);
  assert.match(html, /Documento recebido/);
});

void it("disables all navigation actions while an attachment operation is busy", () => {
  const html = renderToStaticMarkup(
    createElement(AttachmentPanel, {
      open: true,
      busy: true,
      onBack: () => {},
      onMobile: () => {},
      onClose: () => {},
      children: "Arquivo em processamento",
    }),
  );
  assert.match(html, /<button(?=[^>]*aria-label="Voltar aos anexos")(?=[^>]* disabled="")/);
  assert.match(html, /<button(?=[^>]*aria-label="Enviar pelo celular")(?=[^>]* disabled="")/);
  assert.match(html, /<button(?=[^>]*aria-label="Fechar anexos")(?=[^>]* disabled="")/);
  assert.doesNotMatch(html, /inert=""/);
});
