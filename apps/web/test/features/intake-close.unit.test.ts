import assert from "node:assert/strict";
import { it } from "node:test";
import { createRequestSave } from "../../src/features/students/new-student/new-student-request-save.js";
import type { IntakePendingItem } from "../../src/features/students/new-student/new-student-save.js";
import { initialNewStudentState } from "../../src/features/students/new-student/reducer.js";

type Context = Parameters<typeof createRequestSave>[0];
// Only the collaborators used by save preparation are supplied here.
type SavedInput = Parameters<Context["persistence"]["persist"]>[0];
type Scenario = {
  request: ReturnType<typeof createRequestSave>;
  confirmations: {
    items: IntakePendingItem[];
    blocking: { label: string; step: string; field?: string }[];
    input?: { allowPending: boolean };
  }[];
  persisted: SavedInput[];
  errors: string[];
  context: Context;
};
function scenario(step: "student" | "pedagogy" | "contract", complete = false): Scenario {
  const confirmations: Scenario["confirmations"] = [];
  const persisted: SavedInput[] = [];
  const errors: string[] = [];
  const context = {
    identity: {
      state: {
        ...initialNewStudentState,
        fields: {
          ...initialNewStudentState.fields,
          fullName: "Maria Silva",
          birthDate: "01/05/1990",
          documentType: "RG",
          documentNumber: "1234567",
          phone: "82999990000",
        },
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
    documents: {
      query: {
        data: {
          files: [{ kind: "student" }, { kind: "residence" }, { kind: "photo" }],
        },
      },
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
    today: "2026-10-29",
    existingStudentId: complete ? "09444c84-c30d-4c2f-9827-29428c489e81" : undefined,
  } as object as Context;
  return { request: createRequestSave(context), confirmations, persisted, errors, context };
}

for (const step of ["student", "pedagogy", "contract"] as const) {
  void it(`closing from ${step} offers pending save without persisting`, () => {
    const state = scenario(step);
    assert.equal(state.request(false, true), true);
    assert.deepEqual(state.confirmations[0]?.items, [
      { kind: "class", label: "Definir a turma na página do aluno." },
      {
        kind: "contract",
        label: "Concluir o contrato. Os dados do contrato em rascunho não serão salvos.",
      },
    ]);
    assert.equal(state.confirmations[0]?.input?.allowPending, true);
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

void it("offers review from any step", () => {
  const state = scenario("student");
  assert.equal(state.request(false), true);
  assert.equal(state.confirmations.length, 1);
  assert.deepEqual(state.persisted, []);
});

void it("cannot prepare a pending save while a mutation is running", () => {
  const state = scenario("student");
  state.context.flow.busy.current = true;
  assert.equal(state.request(false, true), false);
  assert.deepEqual(state.confirmations, []);
  assert.deepEqual(state.persisted, []);
});

void it("lists incomplete identity as blocking while allowing deferred items", () => {
  const state = scenario("pedagogy");
  state.context.identity.state.fields.fullName = "";
  assert.equal(state.request(false, true), true);
  assert.equal(state.confirmations[0]?.blocking[0]?.field, "fullName");
  assert.equal(state.confirmations[0]?.blocking[0]?.step, "student");
  assert.equal(state.confirmations[0]?.items.length, 2);
  assert.equal(state.confirmations[0]?.input, undefined);
  assert.deepEqual(state.persisted, []);
});

void it("closing a partial address permits optional empty fields", () => {
  const state = scenario("student");
  state.context.identity.state.fields.address = {
    street: "Rua das Flores",
    number: "",
    complement: "",
    neighborhood: "",
    city: "Maceió",
    state: "AL",
    postalCode: "",
  };
  assert.equal(state.request(false, true), true);
  assert.equal(state.confirmations.length, 1);
  assert.deepEqual(state.errors, [""]);
});
