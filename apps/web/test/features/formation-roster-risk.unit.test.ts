import assert from "node:assert/strict";
import { it } from "node:test";
import { reviewPlacement } from "../support/formation-review.js";
import { formationBlocker } from "@lazuli/domain";
import type { Placement } from "../../src/features/class-organization/model.js";
import {
  rosterAttentionReasons,
  rosterRiskOptions,
} from "../../src/features/class-organization/attention-reasons.js";

const baseline: Placement = {
  ...reviewPlacement,
  planId: "destination",
  sourceProgressId: "progress",
  continuity: "STAY",
  attentionNote: null,
  blockers: [],
  attention: {
    ...reviewPlacement.attention,
    gradesIncomplete: false,
    contractStatus: "COVERED",
    grades: "SUFFICIENT",
    attendance: 100,
    attendanceFlagged: false,
    lowHealth: false,
    materialMissing: true,
  },
};

void it("keeps individual risks on the same placement and deduplicates matching publication blockers", () => {
  const row = {
    ...baseline,
    continuity: "CHANGE" as const,
    attention: {
      ...baseline.attention,
      contractStatus: "MISSING" as const,
      lowHealth: true,
      healthScore: 35,
      attendance: null,
      grades: "INCOMPLETE" as const,
    },
    blockers: [
      formationBlocker.missingContract,
      "Escolha a nova turma para continuar.",
      formationBlocker.material,
      "Professor pendente na data de entrada",
      "Professor pendente na data de entrada",
    ],
  };
  const reasons = rosterAttentionReasons(row);
  assert.deepEqual(
    reasons.flatMap((item) => item.risk ?? []),
    [
      "change",
      "missingContract",
      "incomplete",
      "missingAttendance",
      "lowHealth",
      "material",
      "blocker:Professor pendente na data de entrada",
    ],
  );
  assert.deepEqual(
    reasons.filter((reason) => reason.blocker).map((reason) => reason.label),
    [
      "Mudança de turma",
      "Sem contrato vigente",
      formationBlocker.material,
      "Professor pendente na data de entrada",
    ],
  );
  assert.deepEqual(
    reasons.filter((reason) => !reason.blocker).map((reason) => reason.risk),
    ["incomplete", "missingAttendance", "lowHealth"],
  );
  const options = rosterRiskOptions([{ reasons }, { reasons }]);
  assert.equal(
    options.filter((item) => item.label === "Professor pendente na data de entrada").length,
    1,
  );
  assert.ok(!options.some((item) => item.value === "other"));
});

void it("offers a team observation only for nonblank notes, separately from possible departure and without exposing the note", () => {
  const row = {
    ...baseline,
    continuity: "LEAVING" as const,
    blockers: [formationBlocker.leaving],
  };
  const noted = rosterAttentionReasons({ ...row, notes: "Pedido particular" });
  assert.deepEqual(
    noted.flatMap((item) => item.risk ?? []),
    ["leaving", "other", "material"],
  );
  const options = rosterRiskOptions([{ reasons: noted }]);
  assert.equal(options.find((option) => option.value === "other")?.label, "Observação da equipe");
  assert.ok(!JSON.stringify(options).includes("Pedido particular"));
  const blank = rosterAttentionReasons({ ...row, attentionNote: "  " });
  assert.ok(!rosterRiskOptions([{ reasons: blank }]).some((option) => option.value === "other"));
  assert.deepEqual(
    rosterAttentionReasons(baseline).map((reason) => reason.kind),
    ["material"],
  );
});
