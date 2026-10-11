import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppointmentWorkFields,
  ContactFields,
  MeetingDateField,
  MeetingTimeFields,
  PurposeField,
} from "../../src/features/appointments/form-fields.js";
import { CoverageFields } from "../../src/features/appointments/coverage-fields.js";
import { NarrativeField } from "../../src/features/shared/task-form.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("offers appointment purposes directly and identifies each invalid masked meeting control", () => {
  const markup = renderToStaticMarkup(
    createElement(
      React.Fragment,
      {},
      createElement(PurposeField, { value: "MAKEUP", onChange: () => {} }),
      createElement(MeetingDateField, {
        value: "",
        onChange: () => {},
        error: "Informe uma data válida.",
      }),
      createElement(MeetingTimeFields, {
        start: "14:00",
        end: "",
        onStart: () => {},
        onEnd: () => {},
        errors: { "meeting.endTime": "Informe o fim do atendimento." },
      }),
    ),
  );
  for (const label of ["Reposição de falta", "Complemento PPT", "Reforço", "Avaliação"])
    assert.match(markup, new RegExp(`>${label}</button>`, "u"));
  assert.doesNotMatch(markup, /role="combobox"|type="date"/u);
  for (const name of ["appointment-date", "appointment-start", "appointment-end"]) {
    const input = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "u"))?.[0] ?? "";
    assert.match(markup, new RegExp(`for="${name}"`, "u"));
    assert.match(input, /inputMode="numeric"/u);
    assert.match(input, /autoComplete="off"/iu);
    assert.match(input, /placeholder="[^"]+"/u);
  }
  assert.match(markup, /Informe o fim do atendimento\./u);
  assert.match(
    markup.match(/<input[^>]*name="appointment-end"[^>]*>/u)?.[0] ?? "",
    /aria-invalid="true"/u,
  );
});

void it("requires actual teaching evidence separately from planned work and exposes missing absence origins", () => {
  const markup = renderToStaticMarkup(
    createElement(
      React.Fragment,
      {},
      createElement(AppointmentWorkFields, {
        minutes: "0",
        content: "",
        onMinutes: () => {},
        onContent: () => {},
        errors: {
          performedContent: "Descreva o conteúdo realizado.",
          performedMinutes: "Informe pelo menos 1 minuto.",
        },
      }),
      createElement(CoverageFields, {
        sources: [],
        value: [],
        onChange: () => {},
        error: "Selecione pelo menos uma falta de origem.",
      }),
    ),
  );
  const account = markup.match(/<textarea[^>]*name="performedContent"[^>]*>/u)?.[0] ?? "";
  assert.match(account, /aria-invalid="true"/u);
  assert.match(account, /autoComplete="off"/iu);
  assert.match(markup, /Descreva o conteúdo realizado\./u);
  assert.match(markup, /Informe pelo menos 1 minuto\./u);
  assert.match(markup, /<fieldset[^>]*aria-invalid="true"[^>]*aria-describedby="coverage-error"/u);
  assert.match(markup, /Selecione pelo menos uma falta de origem\./u);
  assert.match(markup, /Nenhuma falta com saldo disponível\./u);
});

void it("records contact time, channel and outcome with visible choices and labelled errors", () => {
  const markup = renderToStaticMarkup(
    createElement(ContactFields, {
      values: { date: "", time: "", channel: "WHATSAPP", outcome: "REPLIED", notes: "", next: "" },
      change: () => {},
      errors: {
        contactedAt: "Informe uma data e um horário válidos.",
        notes: "Registre o resultado do contato.",
      },
    }),
  );
  for (const name of ["contact-date", "contact-time", "contact-next", "contact-notes"]) {
    const control =
      markup.match(new RegExp(`<(?:input|textarea)[^>]*name="${name}"[^>]*>`, "u"))?.[0] ?? "";
    assert.match(control, /placeholder="[^"]+"/u);
    assert.match(control, /autoComplete="off"/iu);
    assert.match(markup, new RegExp(`for="${name}"`, "u"));
  }
  assert.doesNotMatch(markup, /role="combobox"|type="date"/u);
  for (const label of [
    "Telefone",
    "WhatsApp",
    "E-mail",
    "Presencial",
    "Sem resposta",
    "Respondeu",
    "Atendimento combinado",
    "Outro retorno",
  ])
    assert.match(markup, new RegExp(`>${label}</button>`, "u"));
  assert.match(markup, /Registre o resultado do contato\./u);
});

void it("keeps cancellation and rescheduling reasons labelled and invalid until explained", () => {
  for (const name of ["cancel-reason", "reschedule-reason", "record-reason"]) {
    const markup = renderToStaticMarkup(
      createElement(NarrativeField, {
        name,
        label: "Motivo",
        value: "",
        onChange: () => {},
        placeholder: "Explique a alteração",
        error: "Informe o motivo.",
      }),
    );
    assert.match(markup, new RegExp(`for="${name}"`, "u"));
    assert.match(markup, /aria-invalid="true"/u);
    assert.match(markup, /Informe o motivo\./u);
  }
});
