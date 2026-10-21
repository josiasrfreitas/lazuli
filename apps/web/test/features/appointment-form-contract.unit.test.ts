import assert from "node:assert/strict";
import { it } from "node:test";
import { registerHooks } from "node:module";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { Dialog } from "@lazuli/ui";
import { trpc, createTRPCClient } from "../../src/lib/trpc.js";
import {
  appointment,
  absence,
  appointmentId,
  studentId,
  studentOptions,
} from "../support/appointment-ui.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
registerHooks({
  load(...args) {
    const [url, context, nextLoad] = args;
    if (url.endsWith(".module.css"))
      return { format: "module", source: "export default {};", shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { AppointmentRecordForm } = await import("../../src/features/appointments/record-form.js");
const { ScheduleForm } = await import("../../src/features/appointments/schedule-dialog.js");
const { useScheduleModel } = await import("../../src/features/appointments/schedule-model.js");
const { CancellationFields, useCancellation } =
  await import("../../src/features/appointments/cancel-dialog.js");
const { AppointmentContent } = await import("../../src/features/appointments/detail.js");
const { AppointmentDialogHeader, AppointmentDialogHistory } =
  await import("../../src/features/appointments/appointment-dialog-context.js");
function render(children: ReactElement): string {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(
    getQueryKey(trpc.appointments.student, { studentId }, "query"),
    studentOptions,
  );
  queryClient.setQueryData(
    getQueryKey(
      trpc.appointments.student,
      { studentId, excludeAppointmentId: appointmentId },
      "query",
    ),
    studentOptions,
  );
  try {
    return renderToStaticMarkup(
      createElement(trpc.Provider, {
        client: createTRPCClient(),
        queryClient,
        children: createElement(QueryClientProvider, { client: queryClient, children }),
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
function checkForm(markup: string): string[] {
  assert.equal((markup.match(/<form\b/gu) ?? []).length, 1);
  assert.doesNotMatch(markup, /<select\b|type="date"/gu);
  const controls = (markup.match(/<(?:input|textarea)\b[^>]*>/gu) ?? []).filter(
    // Base UI emits a hidden checkbox for its controlled selection; this contract covers text controls.
    (tag) => !["hidden", "checkbox", "radio", "file"].includes(attribute(tag, "type") ?? "text"),
  );
  for (const tag of controls) {
    assert.notEqual(attribute(tag, "name") ?? "", "", tag);
    assert.match(attribute(tag, "placeholder") ?? "", /\S/u, tag);
    assert.equal(attribute(tag, "autocomplete"), "off", tag);
  }
  return controls.map((tag) => attribute(tag, "name") ?? "");
}
function ScheduleHarness({
  phase,
  previous,
}: {
  phase: "details" | "schedule";
  previous: boolean;
}): ReactElement {
  const model = useScheduleModel({
    student: { id: studentId, name: "Aluno de prova" },
    source: absence,
    ...(previous ? { previous: appointment.snapshot } : {}),
    onClose: () => {},
  });
  return createElement(ScheduleForm, {
    model: { ...model, draft: { ...model.draft, step: phase } },
    actions: createElement("button", { type: "submit" }, "Salvar"),
  });
}
function CancelHarness(): ReactElement {
  const model = useCancellation(() => {});
  return createElement(CancellationFields, { row: appointment.snapshot, model });
}
void it("keeps appointment outcome and correction controls named and protected from autofill", () => {
  for (const status of ["SCHEDULED", "ATTENDED", "NO_SHOW"] as const) {
    const markup = render(
      createElement(AppointmentRecordForm, {
        data: { ...appointment, snapshot: { ...appointment.snapshot, status } },
        context: createElement("p", null, "Contexto do encontro"),
        onClose: () => {},
      }),
    );
    const names = checkForm(markup);
    assert.equal(names.includes("record-reason"), status !== "SCHEDULED");
    assert.equal(names.includes("performedMinutes"), status !== "NO_SHOW");
    assert.equal(names.includes(`coverage-${absence.id}`), status !== "NO_SHOW");
    assert.match(markup, /form="appointment-record"/u);
  }
});
void it("preserves real forms through scheduling and rescheduling phases with masked civil date/time", () => {
  for (const previous of [false, true]) {
    const details = render(createElement(ScheduleHarness, { phase: "details", previous }));
    const detailNames = checkForm(details);
    assert.equal(detailNames.includes("reschedule-reason"), previous);
    assert.equal(detailNames.includes(`coverage-${absence.id}`), true);
    assert.doesNotMatch(details, /role="combobox"/u);
    const schedule = render(createElement(ScheduleHarness, { phase: "schedule", previous }));
    const scheduleNames = checkForm(schedule);
    assert.deepEqual(scheduleNames, ["appointment-date", "appointment-start", "appointment-end"]);
    assert.match(schedule, /placeholder="dd\/mm\/aaaa"/u);
    assert.equal((schedule.match(/placeholder="hh:mm"/gu) ?? []).length, 2);
  }
});
void it("requires a named cancellation explanation in a real form", () => {
  const markup = render(createElement(CancelHarness));
  assert.deepEqual(checkForm(markup), ["cancel-reason"]);
  assert.match(markup, /id="appointment-cancel"/u);
});
void it("identifies a rescheduled appointment and its historical transition without presenting it as a cancellation", () => {
  const replacementId = "00000000-0000-4000-8000-000000000191";
  const rescheduled = {
    ...appointment,
    restriction: "Este atendimento foi cancelado.",
    rescheduledToId: replacementId,
    snapshot: {
      ...appointment.snapshot,
      status: "CANCELLED" as const,
      cancelledAt: "2091-03-12T12:00:00Z",
      cancellationReason: "Novo combinado familiar.",
    },
    history: [
      {
        id: "rescheduled-event",
        version: 2,
        author: null,
        at: new Date("2091-03-12T12:00:00Z"),
        kind: "RESCHEDULED",
        reason: "Novo combinado familiar.",
        snapshot: { ...appointment.snapshot, status: "CANCELLED" as const },
      },
      {
        id: "scheduled-event",
        version: 1,
        author: null,
        at: new Date("2091-03-11T12:00:00Z"),
        kind: "SCHEDULED",
        reason: null,
        snapshot: appointment.snapshot,
      },
    ],
  };
  const page = render(createElement(AppointmentContent, { data: rescheduled, admin: true }));
  assert.match(page, /Este atendimento foi reagendado\./u);
  assert.match(page, new RegExp(`href="/atendimentos/${replacementId}"`, "u"));
  assert.doesNotMatch(page, /Este atendimento foi cancelado|Agendamento cancelado|Cancelado por/u);
  const modal = render(
    createElement(Dialog, {
      open: true,
      children: createElement(AppointmentDialogHeader, { data: rescheduled, admin: true }),
    }),
  );
  assert.match(modal, />Reagendado</u);
  const history = render(createElement(AppointmentDialogHistory, { data: rescheduled }));
  assert.match(history, /Agendado → Reagendado/u);
  assert.doesNotMatch(history, /Agendado → Cancelado/u);
});
