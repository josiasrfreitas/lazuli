import assert from "node:assert/strict";
import { it } from "node:test";
import { createEnrollmentNavigation } from "../../src/features/students/new-student/new-student-navigation.js";
import { initialNewStudentState } from "../../src/features/students/new-student/reducer.js";

type Context = Parameters<typeof createEnrollmentNavigation>[0];
type Scenario = {
  navigation: ReturnType<typeof createEnrollmentNavigation>;
  documents: { captureBusy: boolean; selection: Context["documents"]["selection"] };
  steps: string[];
  closed: boolean[];
  errors: string[];
};
function scenario(): Scenario {
  const steps: string[] = [];
  const closed: boolean[] = [];
  const errors: string[] = [];
  const documents = { captureBusy: false, selection: null as Context["documents"]["selection"] };
  const flow: Partial<Context["flow"]> = {
    busy: { current: false },
    step: "student",
    dirty: false,
    confirmation: null,
    discarding: false,
    capturingLead: false,
    setStep: (value) => {
      steps.push(typeof value === "function" ? value("student") : value);
    },
    setError: (value) => {
      errors.push(typeof value === "function" ? value("") : value);
    },
  };
  const context: Context = {
    documents: documents as Context["documents"],
    flow: flow as Context["flow"],
    identity: {
      addressPending: false,
      state: {
        ...initialNewStudentState,
        fields: { ...initialNewStudentState.fields, fullName: "Maria Silva" },
      },
    } as Context["identity"],
    classes: { minor: false, blockedLead: false } as Context["classes"],
    today: "2026-10-27",
    onOpenChange: (open: boolean) => closed.push(open),
    saveBeforeClose: () => {
      throw new Error("Capture must be settled before save");
    },
  };
  return { navigation: createEnrollmentNavigation(context), documents, steps, closed, errors };
}

void it("keeps navigation and closure blocked during image preparation or upload", () => {
  const state = scenario();
  state.documents.captureBusy = true;
  state.navigation.advance({ preventDefault() {} } as Parameters<
    typeof state.navigation.advance
  >[0]);
  state.navigation.close();
  assert.deepEqual(state.steps, []);
  assert.deepEqual(state.closed, []);
});

void it("requires an unsent selection to be sent or discarded, then permits navigation", () => {
  const state = scenario();
  state.documents.selection = {
    document: { id: "student" } as NonNullable<typeof state.documents.selection>["document"],
    file: new File(["x"], "test.jpg"),
  };
  state.navigation.advance({ preventDefault() {} } as Parameters<
    typeof state.navigation.advance
  >[0]);
  state.navigation.close();
  assert.deepEqual(state.steps, []);
  assert.deepEqual(state.closed, []);
  assert.deepEqual(state.errors, [
    "Envie ou descarte o anexo selecionado antes de continuar.",
    "Envie ou descarte o anexo selecionado antes de fechar.",
  ]);
  state.documents.selection = null;
  state.navigation.advance({ preventDefault() {} } as Parameters<
    typeof state.navigation.advance
  >[0]);
  assert.deepEqual(state.steps, ["address"]);
  state.navigation.close();
  assert.deepEqual(state.closed, [false]);
});
