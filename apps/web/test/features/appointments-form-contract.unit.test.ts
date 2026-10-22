import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppointmentWorkFields,
  MeetingDateField,
  MeetingTimeFields,
  PurposeField,
} from "../../src/features/appointments/form-fields.js";
import { CoverageFields } from "../../src/features/appointments/coverage-fields.js";
import { NarrativeField } from "../../src/features/shared/task-form.js";
import { AppointmentDialogHistory } from "../../src/features/appointments/appointment-dialog-context.js";
import { AppointmentAccount } from "../../src/features/appointments/appointment-account.js";
import { AppointmentBadge, type Appointment } from "../../src/features/appointments/shared.js";
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

void it("shows prior content, minutes, coverage and correction reasons in appointment history", () => {
  const snapshot: Appointment["snapshot"] = {
    id: "appointment",
    version: 3,
    student: { id: "student", name: "Ana" },
    teacher: { id: "teacher", name: "Camila" },
    enrollmentId: "enrollment",
    targetClassSessionId: null,
    targetClassName: null,
    legacyMakeupId: null,
    rescheduledFromId: null,
    purpose: "MAKEUP",
    status: "ATTENDED",
    format: "IN_PERSON",
    date: "2026-10-13",
    startTime: "14:00",
    endTime: "15:00",
    plannedContent: "Prática",
    performedContent: "Conteúdo corrigido",
    performedMinutes: 45,
    notes: null,
    scheduledAt: "2026-10-12T14:00:00Z",
    scheduledBy: { id: "admin", name: "Admin" },
    recordedAt: "2026-10-13T18:00:00Z",
    recordedBy: { id: "teacher", name: "Camila" },
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    coverages: [
      {
        attendanceId: "absence",
        enrollmentId: "enrollment",
        sourceSessionId: "session",
        sourceClassId: "class",
        sourceClassName: "Connect 1",
        date: "2026-10-10",
        startTime: "14:00",
        endTime: "15:00",
        sourceStatus: "ABSENT",
        applicable: true,
        minutes: 45,
      },
    ],
  };
  const data: Appointment = {
    snapshot,
    restriction: null,
    rescheduledToId: null,
    absences: [],
    history: [
      {
        id: "revision3",
        version: 3,
        kind: "CORRECTED",
        reason: "Correção após conferir o diário.",
        at: new Date("2026-10-14T18:00:00Z"),
        author: { id: "admin", name: "Admin" },
        snapshot,
      },
      {
        id: "revision2",
        version: 2,
        kind: "RECORDED",
        reason: null,
        at: new Date("2026-10-13T18:00:00Z"),
        author: { id: "teacher", name: "Camila" },
        snapshot: {
          ...snapshot,
          version: 2,
          performedContent: "Conteúdo original preservado",
          performedMinutes: 60,
          coverages: [{ ...snapshot.coverages[0]!, minutes: 60 }],
        },
      },
    ],
  };
  const markup = renderToStaticMarkup(createElement(AppointmentDialogHistory, { data }));
  assert.match(markup, /Correção após conferir o diário\./u);
  assert.match(markup, /Conteúdo corrigido/u);
  assert.match(markup, /Conteúdo original preservado/u);
  assert.match(markup, /45 minutos realizados/u);
  assert.match(markup, /60 minutos realizados/u);
  assert.match(markup, /60 min compensados/u);
  assert.match(markup, /Connect 1/u);
  assert.match(markup, /10\/10\/2026/u);
  const moved = { ...snapshot, status: "CANCELLED" as const };
  const rescheduled = renderToStaticMarkup(
    createElement(
      React.Fragment,
      {},
      createElement(AppointmentBadge, { status: "CANCELLED", rescheduled: true }),
      createElement(AppointmentAccount, { row: moved, rescheduled: true }),
    ),
  );
  assert.match(rescheduled, /Reagendado/u);
  assert.match(rescheduled, /Atendimento reagendado; consulte o novo agendamento\./u);
  assert.doesNotMatch(rescheduled, /Agendamento cancelado|>Cancelado</u);
});
