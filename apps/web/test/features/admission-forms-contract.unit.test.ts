import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CandidateIdentityFields } from "../../src/features/admissions/candidate-fields.js";
import { initialCandidateDraft } from "../../src/features/admissions/candidate-model.js";
import { NewEnrollmentStudent } from "../../src/features/admissions/enrollment-fields.js";
import { VisitDateField, VisitTimeFields } from "../../src/features/admissions/visit-fields.js";
import type { VisitDraft } from "../../src/features/admissions/visit-model.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("identifies lead contact errors next to the named controls", () => {
  const markup = renderToStaticMarkup(
    createElement(CandidateIdentityFields, {
      draft: initialCandidateDraft(),
      change: () => {},
      errors: { phone: "Informe telefone ou e-mail de contato." },
    }),
  );
  for (const name of ["fullName", "phone", "email"]) {
    const control = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "u"))?.[0] ?? "";
    assert.match(control, /autoComplete="off"/iu);
    assert.match(control, /placeholder="[^"]+"/u);
    assert.match(markup, new RegExp(`for="${name}"`, "u"));
  }
  assert.match(markup.match(/<input[^>]*name="phone"[^>]*>/u)?.[0] ?? "", /aria-invalid="true"/u);
  assert.match(markup, /Informe telefone ou e-mail de contato\./u);
});
void it("shows the minor's guardian controls and a single masked birth-date control", () => {
  const markup = renderToStaticMarkup(
    createElement(NewEnrollmentStudent, {
      today: "2026-10-11",
      change: () => {},
      errors: { guardianPhone: "Informe o contato do responsável." },
      draft: {
        mode: "create",
        name: "Ana",
        birthDate: "12/10/2008",
        guardianName: "",
        guardianPhone: "",
        search: "",
        student: null,
      },
    }),
  );
  const birth = markup.match(/<input[^>]*name="birthDate"[^>]*>/u)?.[0] ?? "";
  assert.match(birth, /inputMode="numeric"/u);
  assert.match(birth, /placeholder="dd\/mm\/aaaa"/u);
  assert.doesNotMatch(markup, /type="date"/u);
  assert.match(markup, /Responsável pelo menor/u);
  assert.match(
    markup.match(/<input[^>]*name="guardianPhone"[^>]*>/u)?.[0] ?? "",
    /aria-invalid="true"/u,
  );
  assert.match(markup, /Informe o contato do responsável\./u);
});
void it("gives entry visits separate masked date and time controls with the invalid ending labelled", () => {
  const draft: VisitDraft = {
    kind: "INTRODUCTION",
    date: "",
    classId: "",
    meetingKey: "",
    teacher: null,
    startTime: "14:00",
    endTime: "",
    notes: "",
  };
  const props = {
    draft,
    change: () => {},
    errors: { "meeting.endTime": "O término deve ser posterior ao início." },
  };
  const markup = renderToStaticMarkup(
    createElement(
      React.Fragment,
      {},
      createElement(VisitDateField, props),
      createElement(VisitTimeFields, props),
    ),
  );
  for (const name of ["date", "startTime", "endTime"]) {
    const control = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "u"))?.[0] ?? "";
    assert.match(control, /inputMode="numeric"/u);
    assert.match(control, /autoComplete="off"/iu);
    assert.match(control, /placeholder="[^"]+"/u);
    assert.match(markup, new RegExp(`for="${name}"`, "u"));
  }
  assert.doesNotMatch(markup, /type="(?:date|time)"/u);
  assert.match(markup.match(/<input[^>]*name="endTime"[^>]*>/u)?.[0] ?? "", /aria-invalid="true"/u);
  assert.match(markup, /O término deve ser posterior ao início\./u);
});
