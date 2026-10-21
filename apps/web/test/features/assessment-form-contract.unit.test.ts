import assert from "node:assert/strict";
import { it } from "node:test";
import { registerHooks } from "node:module";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, createTRPCClient } from "../../src/lib/trpc.js";
import { AssessmentUploadProvider } from "../../src/features/assessment-files/queue-provider.js";
import { useAssessmentEntry } from "../../src/features/assessments/assessment-entry-state.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
// CSS is a browser dependency; this test observes actual form markup and controllers.
registerHooks({
  load(...args) {
    const [url, context, nextLoad] = args;
    if (url.endsWith(".module.css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { AssessmentEntryForm } =
  await import("../../src/features/assessments/assessment-entry-dialog.js");
const { ConfirmationForm, useConfirmation } =
  await import("../../src/features/assessments/confirmation-dialog.js");
type Assessment = RouterOutputs["assessments"]["byProgress"];
const data: Assessment = {
  progressId: "00000000-0000-4000-8000-000000000175",
  assessmentId: null,
  version: 0,
  fileScope: { enrollmentId: "form-enrollment", from: "2026-10-01", through: null },
  student: { id: "form-student", fullName: "Aluno de prova" },
  class: { id: "form-class", name: "Turma de prova" },
  stage: { id: "form-stage", name: "F1", track: { id: "form-track", name: "Fundamentals" } },
  startedOn: "2026-10-01",
  endedOn: null,
  current: true,
  grades: [],
  results: [],
  status: "INCOMPLETE",
  decision: null,
  decisionReason: null,
  confirmedAt: null,
  confirmedBy: null,
  canConfirm: true,
  today: "2026-10-21",
};
function EntryHarness({
  recovery,
  correcting,
}: {
  recovery: boolean;
  correcting: boolean;
}): ReactElement {
  const state = useAssessmentEntry({
    data: { ...data, confirmedAt: correcting ? new Date("2026-10-20T15:00:00Z") : null },
    competence: "WRITTEN",
    initialPhase: recovery ? "RECOVERY" : "BLOCK_ONE",
    trigger: {} as HTMLButtonElement,
    onSaved: () => {},
    onClose: () => {},
  });
  return createElement(AssessmentEntryForm, { state: { ...state, gradeChanged: correcting } });
}
function ConfirmationHarness(): ReactElement {
  const state = useConfirmation(data, () => {});
  return createElement(ConfirmationForm, { data, state });
}
function render(children: ReactElement): string {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    return renderToStaticMarkup(
      createElement(trpc.Provider, {
        client: createTRPCClient(),
        queryClient,
        children: createElement(QueryClientProvider, {
          client: queryClient,
          children: createElement(AssessmentUploadProvider, { userId: "form-user", children }),
        }),
      }),
    );
  } finally {
    queryClient.clear();
  }
}
function attribute(tag: string, name: string): string | null {
  return (
    [...tag.matchAll(/\s([\w-]+)="([^"]*)"/gu)].find(
      (match) => match[1]?.toLowerCase() === name.toLowerCase(),
    )?.[2] ?? null
  );
}
void it("keeps every grade, recovery and correction field named, masked and protected from autofill", () => {
  for (const variant of [
    { recovery: false, correcting: false, fields: 3 },
    { recovery: true, correcting: false, fields: 4 },
    { recovery: false, correcting: true, fields: 4 },
  ]) {
    const markup = render(createElement(EntryHarness, variant));
    // File inputs feed the separate persistent byte-upload queue, not the grade form payload.
    const controls = (markup.match(/<(?:input|textarea)\b[^>]*>/gu) ?? []).filter(
      (tag) => attribute(tag, "type") !== "file",
    );
    assert.equal(controls.length, variant.fields);
    for (const control of controls) {
      assert.match(attribute(control, "name") ?? "", /-(?:score|date|reason|notes|correction)$/u);
      assert.equal(attribute(control, "autocomplete"), "off");
      assert.notEqual(attribute(control, "placeholder"), null);
      assert.notEqual(attribute(control, "placeholder"), "");
      assert.notEqual(attribute(control, "type"), "date");
    }
    assert.equal((markup.match(/<form\b/gu) ?? []).length, 1);
    assert.doesNotMatch(markup, /role="combobox"|<select\b/gu);
  }
});
void it("makes the coordinator decision a real form with one named explanation and pill choices", () => {
  const markup = render(createElement(ConfirmationHarness));
  const controls = markup.match(/<input\b[^>]*>/gu) ?? [];
  assert.equal(controls.length, 1);
  assert.equal(attribute(controls[0], "name"), "assessment-reason");
  assert.equal(attribute(controls[0], "autocomplete"), "off");
  assert.equal(
    attribute(controls[0], "placeholder"),
    "Registre as evidências que sustentam esta decisão",
  );
  assert.equal((markup.match(/<form\b/gu) ?? []).length, 1);
  assert.doesNotMatch(markup, /role="combobox"|<select\b/gu);
  assert.match(markup, /Repetir estágio/u);
});
