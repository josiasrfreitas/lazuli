import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClassSchedule } from "../../src/features/classes/class-schedule.js";
import { RosterStudent } from "../../src/features/classes/roster-list.js";
import type { RosterRow } from "../../src/features/classes/roster-status.js";
import { studentAgeLabel } from "../../src/features/classes/student-age.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const row: RosterRow = {
  id: "enrollment",
  studentId: "student",
  student: {
    fullName: "Ana Beatriz",
    phone: "(11) 98801-2233",
    birthDate: new Date("2012-10-08T00:00:00Z"),
  },
  entryDate: new Date("2026-08-01T00:00:00Z"),
  exitDate: null,
  exitReason: null,
  progressRecords: [{ stage: { name: "A2", track: { name: "Adultos / English Main" } } }],
  actions: [],
};

void it("renders weekday meetings in calendar order and keeps exact wall-clock times", () => {
  const markup = renderToStaticMarkup(
    createElement(ClassSchedule, {
      slots: [
        {
          weekday: "THURSDAY",
          startTime: new Date("1970-01-01T19:30:00Z"),
          endTime: new Date("1970-01-01T21:00:00Z"),
        },
        {
          weekday: "TUESDAY",
          startTime: new Date("1970-01-01T17:15:00Z"),
          endTime: new Date("1970-01-01T18:45:00Z"),
        },
      ],
    }),
  );
  assert.match(markup, /Terça[\s\S]*17:15–18:45[\s\S]*Quinta[\s\S]*19:30–21:00/u);
  assert.doesNotMatch(markup, /Segunda|Sexta/u);
});

void it("explains the missing schedule instead of showing a blank agenda", () => {
  const markup = renderToStaticMarkup(createElement(ClassSchedule, { slots: [] }));
  assert.match(markup, /Nenhum horário cadastrado\./u);
});

void it("shows identity, age, phone and placement without a redundant current status", () => {
  const markup = renderToStaticMarkup(
    createElement(RosterStudent, { row, today: "2026-10-07", close: () => {} }),
  );
  assert.match(markup, /Ana Beatriz/u);
  assert.match(markup, /13 anos/u);
  assert.match(markup, /\(11\) 98801-2233/u);
  assert.match(markup, />A2</u);
  assert.match(markup, />Adultos \/ English</u);
  assert.doesNotMatch(markup, />Vigente</u);
  assert.match(markup, /aria-label="Detalhes de Ana Beatriz"/u);
});

void it("shows overdue scheduled closure on the student card", () => {
  const markup = renderToStaticMarkup(
    createElement(RosterStudent, {
      row: {
        ...row,
        actions: [{ kind: "PAUSE", effectiveDate: new Date("2026-10-06T00:00:00Z") }],
      },
      today: "2026-10-07",
      close: () => {},
    }),
  );
  assert.match(markup, /Aguardando execução/u);
  assert.match(markup, /aria-label="Detalhes de Ana Beatriz"/u);
});

void it("updates age on the birthday using the school's civil date", () => {
  const birthDate = new Date("2012-10-08T00:00:00Z");
  assert.equal(studentAgeLabel(birthDate, "2026-10-07"), "13 anos");
  assert.equal(studentAgeLabel(birthDate, "2026-10-08"), "14 anos");
  assert.equal(studentAgeLabel(birthDate, "2026-10-09"), "14 anos");
});

void it("keeps missing student information explicit and omits shared stage on regular cards", () => {
  const markup = renderToStaticMarkup(
    createElement(RosterStudent, {
      row: { ...row, student: { fullName: "Ana Beatriz", phone: null, birthDate: null } },
      today: "2026-10-08",
      close: () => {},
      showStage: false,
    }),
  );
  assert.match(markup, /Idade não informada/u);
  assert.match(markup, /Sem telefone/u);
  assert.doesNotMatch(markup, />A2</u);
  assert.doesNotMatch(markup, /Adultos \/ English/u);
});
