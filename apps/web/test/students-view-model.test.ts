import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attendanceCellVm,
  financeCellVm,
  headerSummaryVm,
  statusTabsVm,
  tableStateVm,
  whatsAppVm,
} from "../src/features/students/view-model.js";

const OVERDUE_CENTS = 38_000;
const TAB_COUNTS = { all: 16, active: 13, inactive: 3 };

void describe("students row cells", () => {
  void it("renders attendance as a flagged percent or an em dash", () => {
    assert.deepEqual(attendanceCellVm({ percent: 0.875, flagged: false }), {
      label: "88%",
      tone: "default",
      numeric: true,
    });
    assert.equal(attendanceCellVm({ percent: 0.5, flagged: true }).tone, "destructive");
    assert.deepEqual(attendanceCellVm({ percent: null, flagged: false }), {
      label: "—",
      tone: "muted",
      numeric: false,
    });
  });

  void it("renders finance as em dia, overdue BRL, or an em dash", () => {
    assert.deepEqual(financeCellVm({ kind: "upToDate" }), {
      label: "Em dia",
      tone: "success",
      numeric: false,
    });

    const overdue = financeCellVm({ kind: "overdue", overdueCents: OVERDUE_CENTS });
    assert.equal(overdue.tone, "destructive");
    assert.match(overdue.label, /R\$\s?380,00/u);

    assert.equal(financeCellVm({ kind: "none" }).label, "—");
  });

  void it("links WhatsApp only when the student has a phone", () => {
    const linked = whatsAppVm({ fullName: "Ana Beatriz Rocha", phone: "(11) 98801-2233" });
    assert.equal(linked?.url, "https://wa.me/5511988012233");
    assert.equal(whatsAppVm({ fullName: "Sem Telefone", phone: null }), null);
  });
});

void describe("students page furniture", () => {
  void it("summarises the header and pluralises 1 aluno / 1 turma", () => {
    assert.deepEqual(headerSummaryVm({ totalStudents: TAB_COUNTS.all, activeClasses: 6 }), {
      totalStudents: 16,
      activeClasses: 6,
    });
    assert.deepEqual(headerSummaryVm({ totalStudents: 1, activeClasses: 1 }), {
      totalStudents: 1,
      activeClasses: 1,
    });
    assert.equal(headerSummaryVm(), undefined);
  });

  void it("builds the three status tabs with their counts", () => {
    const tabs = statusTabsVm(TAB_COUNTS);
    assert.deepEqual(
      tabs.map((tab) => [tab.value, tab.count]),
      [
        ["todos", TAB_COUNTS.all],
        ["ativos", TAB_COUNTS.active],
        ["inativos", TAB_COUNTS.inactive],
      ],
    );
  });

  void it("keeps the tabs, without numbers, while counts are unknown", () => {
    const tabs = statusTabsVm();
    assert.deepEqual(
      tabs.map((tab) => [tab.value, tab.count]),
      [
        ["todos", undefined],
        ["ativos", undefined],
        ["inativos", undefined],
      ],
    );
  });

  void it("tells an empty school apart from filters that match nothing", () => {
    assert.deepEqual(tableStateVm({ rows: undefined, isError: false, filtered: false }), {
      kind: "loading",
    });
    assert.deepEqual(tableStateVm({ rows: undefined, isError: true, filtered: false }), {
      kind: "error",
    });
    assert.deepEqual(tableStateVm({ rows: [], isError: false, filtered: true }), {
      kind: "noResults",
    });
    assert.deepEqual(tableStateVm({ rows: [], isError: false, filtered: false }), {
      kind: "empty",
    });
  });
});
