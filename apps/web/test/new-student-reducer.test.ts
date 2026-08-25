import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  initialNewStudentState,
  isMinorOn,
  newStudentReducer,
  type NewStudentState,
} from "../src/features/students/new-student/reducer.js";
import { toCreateInput } from "../src/features/students/new-student/to-create-input.js";

const TODAY = "2026-08-25";
const MINOR_BIRTH = "2010-05-01";
const ADULT_BIRTH = "1990-05-01";
const ADULT_NAME = "Maria Silva";
const MINOR_NAME = "Davi Lucca";
const GUARDIAN_NAME = "Ana Lucca";
const GUARDIAN_EMAIL = "ana@example.com";

function stateWith(fields: Partial<NewStudentState["fields"]>): NewStudentState {
  return { ...initialNewStudentState, fields: { ...initialNewStudentState.fields, ...fields } };
}

function advanced(state: NewStudentState): NewStudentState {
  return newStudentReducer(state, { type: "nextRequested", today: TODAY });
}

void describe("isMinorOn", () => {
  void it("derives minority from the São Paulo calendar dates alone", () => {
    assert.equal(isMinorOn({ birthDate: MINOR_BIRTH, today: TODAY }), true);
    assert.equal(isMinorOn({ birthDate: ADULT_BIRTH, today: TODAY }), false);
    assert.equal(isMinorOn({ birthDate: "", today: TODAY }), false);
  });

  void it("flips exactly on the 18th birthday", () => {
    assert.equal(isMinorOn({ birthDate: "2008-08-25", today: TODAY }), false);
    assert.equal(isMinorOn({ birthDate: "2008-08-26", today: TODAY }), true);
  });
});

void describe("new-student wizard: step Dados", () => {
  void it("requires only the name for an adult", () => {
    const blocked = advanced(initialNewStudentState);
    assert.equal(blocked.step, 0);
    assert.equal(blocked.errors.fullName, "Campo obrigatório.");

    const passed = advanced(stateWith({ fullName: ADULT_NAME }));
    assert.equal(passed.step, 1);
    assert.deepEqual(passed.errors, {});
  });

  void it("requires the document type once a number is typed", () => {
    const blocked = advanced(stateWith({ fullName: ADULT_NAME, documentNumber: "123" }));
    assert.equal(blocked.step, 0);
    assert.ok(blocked.errors.documentType);
  });

  void it("requires a guardian with contact for minors, mirroring the backend", () => {
    const missingAll = advanced(stateWith({ fullName: MINOR_NAME, birthDate: MINOR_BIRTH }));
    assert.equal(missingAll.step, 0);
    assert.ok(missingAll.errors.guardianName);
    assert.ok(missingAll.errors.guardianPhone);

    const missingContact = advanced(
      stateWith({ fullName: MINOR_NAME, birthDate: MINOR_BIRTH, guardianName: GUARDIAN_NAME }),
    );
    assert.ok(missingContact.errors.guardianPhone);

    const passed = advanced(
      stateWith({
        fullName: MINOR_NAME,
        birthDate: MINOR_BIRTH,
        guardianName: GUARDIAN_NAME,
        guardianEmail: GUARDIAN_EMAIL,
      }),
    );
    assert.equal(passed.step, 1);
  });
});

void describe("new-student wizard: transitions", () => {
  void it("clears a field's error when it is edited", () => {
    const blocked = advanced(initialNewStudentState);
    const edited = newStudentReducer(blocked, {
      type: "fieldChanged",
      field: "fullName",
      value: "M",
    });

    assert.equal(edited.errors.fullName, undefined);
    assert.equal(edited.fields.fullName, "M");
  });

  void it("skips through Turma and Financeiro and walks back", () => {
    const onTurma = advanced(stateWith({ fullName: ADULT_NAME }));
    const onFinanceiro = advanced(onTurma);
    assert.equal(onFinanceiro.step, 2);
    assert.equal(advanced(onFinanceiro).step, 2);

    const back = newStudentReducer(onFinanceiro, { type: "backRequested" });
    assert.equal(back.step, 1);
  });

  void it("returns to Dados with the server's field errors on rejection", () => {
    const onFinanceiro = advanced(advanced(stateWith({ fullName: ADULT_NAME })));
    const rejected = newStudentReducer(onFinanceiro, {
      type: "serverRejected",
      errors: { guardianName: "Responsavel obrigatorio para alunos menores de idade." },
      formError: null,
    });

    assert.equal(rejected.step, 0);
    assert.ok(rejected.errors.guardianName);
  });

  void it("resets to the initial state", () => {
    const dirty = advanced(stateWith({ fullName: ADULT_NAME }));
    assert.deepEqual(newStudentReducer(dirty, { type: "reset" }), initialNewStudentState);
  });
});

void describe("toCreateInput", () => {
  void it("drops empty fields and keeps the typed calendar day", () => {
    const input = toCreateInput({
      ...initialNewStudentState.fields,
      fullName: "  Maria Silva  ",
      birthDate: MINOR_BIRTH,
      guardianName: GUARDIAN_NAME,
      guardianEmail: GUARDIAN_EMAIL,
    });

    assert.equal(input.fullName, ADULT_NAME);
    assert.equal(input.phone, undefined);
    assert.equal(input.birthDate?.toISOString(), "2010-05-01T00:00:00.000Z");
    assert.deepEqual(input.guardian, {
      mode: "create",
      input: { fullName: GUARDIAN_NAME, phone: undefined, email: GUARDIAN_EMAIL },
    });
    assert.equal(input.documentType, undefined);
  });
});
