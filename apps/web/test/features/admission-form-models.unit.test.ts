import assert from "node:assert/strict";
import { it } from "node:test";
import {
  initialCandidateDraft,
  parseCandidateDraft,
} from "../../src/features/admissions/candidate-model.js";
import {
  enrollmentErrors,
  enrollmentStudent,
  type EnrollmentDraft,
} from "../../src/features/admissions/enrollment-model.js";
import { trialVisitInput } from "../../src/features/admissions/trial-visit-input.js";

void it("saves lead details without time preferences", () => {
  const result = parseCandidateDraft({
    ...initialCandidateDraft(),
    fullName: "Ana Silva",
    phone: "82999991234",
  });
  assert.equal(result.success, true);
});
const enrollment: EnrollmentDraft = {
  mode: "create",
  name: "Ana Silva",
  birthDate: "12/10/2008",
  guardianName: "",
  guardianPhone: "",
  search: "",
  student: null,
};
void it("requires a guardian until the student's eighteenth birthday and rejects future birth dates", () => {
  assert.deepEqual(enrollmentErrors(enrollment, "2026-10-11"), {
    guardianName: "Informe o responsável.",
    guardianPhone: "Informe o contato do responsável.",
  });
  assert.deepEqual(enrollmentErrors(enrollment, "2026-10-12"), {});
  assert.deepEqual(enrollmentErrors({ ...enrollment, birthDate: "12/10/2026" }, "2026-10-11"), {
    birthDate: "A data não pode ser futura.",
  });
});
void it("links an existing student without carrying unfinished new-student or guardian data", () => {
  const id = "00000000-0000-0000-0000-000000001573";
  const draft: EnrollmentDraft = {
    ...enrollment,
    mode: "existing",
    student: { id, label: "Ana Silva" },
    guardianName: "Unsubmitted guardian",
  };
  assert.deepEqual(enrollmentErrors(draft, "2026-10-11"), {});
  assert.deepEqual(enrollmentStudent(draft, { today: "2026-10-11", phone: null, email: null }), {
    mode: "existing",
    id,
  });
  assert.deepEqual(enrollmentErrors({ ...draft, student: null }, "2026-10-11"), {
    student: "Escolha o cadastro do aluno.",
  });
});
void it("binds a trial to an explicitly selected real encounter and never guesses", () => {
  const meetings = [
    {
      id: "first-event",
      date: "2026-10-12",
      classId: "class",
      scheduleSlotId: "first-slot",
      classSessionId: null,
    },
    {
      id: "second-event",
      date: "2026-10-13",
      classId: "class",
      scheduleSlotId: null,
      classSessionId: "second-session",
    },
  ];
  assert.deepEqual(trialVisitInput(meetings, "second-event"), {
    date: "2026-10-13",
    meeting: {
      kind: "TRIAL",
      classId: "class",
      scheduleSlotId: null,
      classSessionId: "second-session",
    },
  });
  assert.equal(trialVisitInput(meetings, "removed-event"), null);
  assert.equal(trialVisitInput([meetings[0]!], null), null);
  assert.equal(trialVisitInput([], "first-event"), null);
});
