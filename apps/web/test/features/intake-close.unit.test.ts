import assert from "node:assert/strict";
import { it } from "node:test";
import { createRequestSave } from "../../src/features/students/new-student/new-student-request-save.js";
import { initialNewStudentState } from "../../src/features/students/new-student/reducer.js";

type Context = Parameters<typeof createRequestSave>[0];
// These fixtures supply only the collaborators used by the save preparation command.
type Stub<T> = { [K in keyof T]?: T[K] extends object ? Stub<T[K]> : T[K] };
type SavedInput = Parameters<Context["persistence"]["persist"]>[0];
type Scenario = {
  request: ReturnType<typeof createRequestSave>;
  confirmations: { items: string[]; input: { allowPending: boolean } }[];
  persisted: SavedInput[];
  errors: string[];
  context: Context;
};
function scenario(step: "student" | "pedagogy" | "contract", complete = false): Scenario {
  const confirmations: { items: string[]; input: { allowPending: boolean } }[] = [];
  const persisted: SavedInput[] = [];
  const errors: string[] = [];
  const context = {
    identity: {
      state: {
        ...initialNewStudentState,
        fields: { ...initialNewStudentState.fields, fullName: "Maria Silva" },
      },
      selectedId: "",
      stageId: null,
      candidateId: null,
      draftLead: null,
    },
    flow: {
      busy: { current: false },
      step,
      commandId: "09444c84-c30d-4c2f-9827-29428c489e81",
      setError: (error: string) => errors.push(error),
      setConfirmation: (value: (typeof confirmations)[number]) => confirmations.push(value),
    },
    contractData: {
      contract: { fields: {}, commandId: { current: "09444c84-c30d-4c2f-9827-29428c489e81" } },
    },
    classes: {
      blockedLead: false,
      options: { isFetching: false },
      selected: undefined,
      waitingPlacement: false,
    },
    existing: {
      existing: { data: undefined },
      existingEnrollment: complete ? {} : undefined,
      existingContract: complete ? {} : undefined,
    },
    navigation: { validateStudent: () => true },
    persistence: {
      persist: (value: SavedInput) => {
        persisted.push(value);
      },
    },
    existingStudentId: complete ? "09444c84-c30d-4c2f-9827-29428c489e81" : undefined,
  } as Stub<Context> as Context;
  return { request: createRequestSave(context), confirmations, persisted, errors, context };
}

for (const step of ["student", "pedagogy", "contract"] as const) {
  void it(`closing from ${step} offers pending save without persisting`, () => {
    const state = scenario(step);
    assert.equal(state.request(false, true), true);
    assert.deepEqual(state.confirmations[0]?.items, [
      "Definir a turma na etapa pedagógica.",
      "Concluir o contrato. Os dados do contrato em rascunho não serão salvos.",
    ]);
    assert.equal(state.confirmations[0]?.input.allowPending, true);
    assert.deepEqual(state.persisted, []);
    assert.deepEqual(state.errors, [""]);
  });
}

void it("closing a complete registration still requires confirmation", () => {
  const state = scenario("contract", true);
  assert.equal(state.request(false, true), true);
  assert.deepEqual(state.confirmations[0]?.items, []);
  assert.deepEqual(state.persisted, []);
});

void it("keeps ordinary save restricted to the contract step", () => {
  const state = scenario("student");
  assert.equal(state.request(false), false);
  assert.deepEqual(state.confirmations, []);
  assert.deepEqual(state.persisted, []);
});

void it("cannot prepare a pending save while a mutation is running", () => {
  const state = scenario("student");
  state.context.flow.busy.current = true;
  assert.equal(state.request(false, true), false);
  assert.deepEqual(state.confirmations, []);
  assert.deepEqual(state.persisted, []);
});
