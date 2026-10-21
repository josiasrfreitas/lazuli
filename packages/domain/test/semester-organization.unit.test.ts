import assert from "node:assert/strict";
import { it } from "node:test";
import {
  semesterPlacementBlockers,
  type SemesterEligibility,
} from "../src/semester-organization.js";
const eligible: SemesterEligibility = {
  semesterId: "next-semester",
  entryOn: "2027-01-04",
  studentActive: true,
  mode: "ADVANCE",
  stage: { id: "C2", trackId: "connect", sequence: 2 },
  source: {
    semesterId: "current-semester",
    active: true,
    stageId: "C1",
    trackId: "connect",
    sequence: 1,
    scheduleType: "REGULAR",
    decision: "APPROVED",
    confirmed: true,
  },
  plan: {
    scheduleType: "REGULAR",
    sharedStageId: "C2",
    format: "ONLINE",
    teacherReady: true,
    active: true,
    slots: [{ weekday: "MONDAY", startTime: "18:00", endTime: "19:00" }],
  },
  availability: {
    confirmed: true,
    validUntil: "2027-01-04",
    formats: ["ONLINE"],
    slots: [{ weekday: "MONDAY", startTime: "18:00", endTime: "19:00" }],
  },
};
void it("accepts exact availability boundaries and a pedagogically confirmed next stage", () => {
  assert.deepEqual(semesterPlacementBlockers(eligible), []);
});
void it("blocks expired availability, missing teacher, and unconfirmed academic progression independently", () => {
  assert.deepEqual(
    semesterPlacementBlockers({
      ...eligible,
      availability: { ...eligible.availability!, validUntil: "2027-01-03" },
    }),
    ["Disponibilidade vence antes da entrada"],
  );
  assert.deepEqual(
    semesterPlacementBlockers({ ...eligible, plan: { ...eligible.plan!, teacherReady: false } }),
    ["Professor pendente na data de entrada"],
  );
  assert.deepEqual(
    semesterPlacementBlockers({ ...eligible, source: { ...eligible.source!, confirmed: false } }),
    ["Aprovação pedagógica pendente"],
  );
});
void it("rejects an invented terminal successor or a skip even when the source was approved", () => {
  assert.deepEqual(
    semesterPlacementBlockers({
      ...eligible,
      stage: { id: "C2", trackId: "another-track", sequence: 2 },
    }),
    ["Avanço exige o próximo estágio da mesma trilha"],
  );
  assert.deepEqual(
    semesterPlacementBlockers({
      ...eligible,
      stage: { id: "C2", trackId: "connect", sequence: 3 },
    }),
    ["Avanço exige o próximo estágio da mesma trilha"],
  );
});
void it("requires PPT on both sides for continuing an unfinished attempt", () => {
  assert.deepEqual(
    semesterPlacementBlockers({
      ...eligible,
      mode: "CONTINUE",
      stage: { id: "C1", trackId: "connect", sequence: 1 },
      plan: { ...eligible.plan!, sharedStageId: "C1" },
    }),
    ["Continuidade no mesmo estágio exige origem e destino PPT"],
  );
});

void it("permits a current-semester transfer and only PPT continuity across semesters", () => {
  const continuation: SemesterEligibility = {
    ...eligible,
    mode: "CONTINUE",
    stage: { id: "C1", trackId: "connect", sequence: 1 },
    plan: { ...eligible.plan!, sharedStageId: "C1" },
  };
  assert.deepEqual(
    semesterPlacementBlockers({ ...continuation, semesterId: "current-semester" }),
    [],
  );
  assert.deepEqual(
    semesterPlacementBlockers({
      ...continuation,
      source: { ...continuation.source!, scheduleType: "PERSONALIZED" },
      plan: { ...continuation.plan!, scheduleType: "PERSONALIZED" },
    }),
    [],
  );
  assert.deepEqual(semesterPlacementBlockers({ ...continuation, mode: "REPEAT" }), [
    "Confirmação de repetência pendente",
  ]);
  assert.deepEqual(
    semesterPlacementBlockers({
      ...continuation,
      mode: "REPEAT",
      source: { ...continuation.source!, decision: "REPEAT" },
    }),
    [],
  );
});
