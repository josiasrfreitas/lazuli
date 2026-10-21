import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WindowFields,
  ItemFields,
  RevisionReason,
} from "../../src/features/stage-planning/form-fields.js";
import { ContentFields, draftContent } from "../../src/features/class-records/content-fields.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function controls(element: ReactElement): { markup: string; tags: string[] } {
  const markup = renderToStaticMarkup(element);
  return { markup, tags: markup.match(/<(?:input|textarea)\b[^>]*>/gu) ?? [] };
}
function checkTextControls(tags: string[], names: string[]): void {
  assert.deepEqual(
    tags.map((tag) => /\bname="([^"]+)"/u.exec(tag)?.[1]),
    names,
  );
  for (const tag of tags) {
    assert.match(tag, /placeholder="[^"]+"/u);
    assert.match(tag, /autoComplete="off"|autocomplete="off"/u);
    assert.doesNotMatch(tag, /type="date"/u);
  }
}

void it("gives planning-window dates masked-text controls and a correction reason", () => {
  const { markup, tags } = controls(
    createElement(WindowFields, {
      values: { plannedStartOn: "", plannedEndOn: "", objective: "", reason: "" },
      errors: {},
      editing: true,
      change: () => {},
    }),
  );
  checkTextControls(tags, ["plannedStartOn", "plannedEndOn", "objective", "reason"]);
  assert.equal(tags.filter((tag) => /placeholder="dd\/mm\/aaaa"/u.test(tag)).length, 2);
  assert.doesNotMatch(markup, /role="combobox"/u);
});

void it("keeps optional reference fields collapsed while the planned activity is filled", () => {
  const { markup, tags } = controls(
    createElement(ItemFields, {
      values: {
        plannedOn: "21/10/2026",
        kind: "CONTENT",
        title: "Conversa em duplas",
        reference: "",
        pageFrom: "",
        pageTo: "",
        reason: "",
      },
      errors: {},
      editing: false,
      change: () => {},
    }),
  );
  checkTextControls(tags, ["plannedOn", "title", "reference", "pageFrom", "pageTo"]);
  assert.doesNotMatch(markup, /<details\b[^>]*\bopen=/u);
  assert.doesNotMatch(markup, /role="combobox"/u);
  assert.match(markup, /data-slot="segmented-control"/u);
});

void it("opens optional pages when invalid and labels the exact failing control", () => {
  const { markup } = controls(
    createElement(ItemFields, {
      values: {
        plannedOn: "21/10/2026",
        kind: "CONTENT",
        title: "Prática oral",
        reference: "",
        pageFrom: "",
        pageTo: "",
        reason: "",
      },
      errors: { pageTo: "Informe um intervalo válido." },
      editing: false,
      change: () => {},
    }),
  );
  assert.match(markup, /<details\b[^>]*\bopen=/u);
  assert.match(markup, /Informe um intervalo válido\./u);
  const field =
    (markup.match(/<input\b[^>]*>/gu) ?? []).find((tag) => /name="pageTo"/u.test(tag)) ?? "";
  assert.match(field, /aria-invalid="true"/u);
});

void it("requires a named, non-autofilled narrative for removing a planned activity", () => {
  const { markup, tags } = controls(
    createElement(RevisionReason, { value: "", onChange: () => {} }),
  );
  assert.match(markup, /Motivo da revisão/u);
  checkTextControls(tags, ["reason"]);
});

void it("keeps actual content separate from optional references in the diary form", () => {
  const value = { ...draftContent(null), account: "Praticamos perguntas em duplas." };
  const { markup, tags } = controls(
    createElement(ContentFields, {
      prefix: "shared",
      value,
      change: () => {},
      clearError: () => {},
      errors: {},
    }),
  );
  checkTextControls(tags, [
    "shared-account",
    "shared-reference",
    "shared-pageFrom",
    "shared-pageTo",
  ]);
  assert.doesNotMatch(markup, /<details\b[^>]*\bopen=/u);
  assert.doesNotMatch(markup, /role="combobox"/u);
});
