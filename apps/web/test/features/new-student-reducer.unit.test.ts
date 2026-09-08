import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  initialNewStudentState,
  isGuardianSectionOpen,
  isMinorOn,
  newStudentReducer,
  type NewStudentState,
} from "../../src/features/students/new-student/reducer.js";
import { toCreateInput } from "../../src/features/students/new-student/to-create-input.js";

const TODAY = "2026-08-25";
// `isMinorOn` compares ISO dates; the wizard fields hold what the secretary types.
const MINOR_BIRTH = "2010-05-01";
const ADULT_BIRTH = "1990-05-01";
const MINOR_BIRTH_TYPED = "01/05/2010";
const ADULT_BIRTH_TYPED = "01/05/1990";
const ADULT_NAME = "Maria Silva";
const MINOR_NAME = "Davi Lucca";
const GUARDIAN_NAME = "Ana Lucca";
const GUARDIAN_EMAIL = "ana@example.com";
const GUARDIAN_PHONE = "(11) 99999-8888";
const PHONE_DIGITS = "11999998888";
const DOCUMENT_TYPE = "CPF";
const DOCUMENT_NUMBER = "12345678900";
const BLANK_TEXT = "   ";
const REQUIRED_MESSAGE = "Campo obrigatório.";
const INVALID_DATE_MESSAGE = "Data inválida. Use dd/mm/aaaa.";
const DOCUMENT_TYPE_MESSAGE = "Informe o tipo do documento.";
const GUARDIAN_REQUIRED_MESSAGE = "Responsável obrigatório para alunos menores de idade.";
const GUARDIAN_CONTACT_MESSAGE = "Informe telefone ou email do responsável.";
const SERVER_GUARDIAN_REQUIRED_MESSAGE = "Responsavel obrigatorio para alunos menores de idade.";

const BLANK_FIELDS: NewStudentState["fields"] = {
  fullName: "",
  phone: "",
  email: "",
  birthDate: "",
  documentType: "",
  documentNumber: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
};

const BLANK_STATE: NewStudentState = {
  step: 0,
  fields: BLANK_FIELDS,
  errors: {},
  formError: null,
  guardianOpen: false,
  errorsRevision: 0,
};

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

void describe("new-student wizard: initial state", () => {
  void it("starts on Dados with every editable field blank", () => {
    assert.deepEqual(initialNewStudentState, BLANK_STATE);
  });
});

void describe("new-student wizard: required identity fields", () => {
  void it("requires only the name for an adult", () => {
    const blocked = advanced(initialNewStudentState);
    assert.equal(blocked.step, 0);
    assert.equal(blocked.errors.fullName, REQUIRED_MESSAGE);

    const blankName = advanced(stateWith({ fullName: BLANK_TEXT }));
    assert.equal(blankName.step, 0);
    assert.equal(blankName.errors.fullName, REQUIRED_MESSAGE);

    const passed = advanced(stateWith({ fullName: ADULT_NAME }));
    assert.equal(passed.step, 1);
    assert.deepEqual(passed.errors, {});
  });
});

void describe("new-student wizard: document validation", () => {
  void it("requires the document type once a number is typed", () => {
    const blankNumber = advanced(stateWith({ fullName: ADULT_NAME, documentNumber: BLANK_TEXT }));
    assert.equal(blankNumber.step, 1);
    assert.deepEqual(blankNumber.errors, {});

    const blocked = advanced(stateWith({ fullName: ADULT_NAME, documentNumber: DOCUMENT_NUMBER }));
    assert.equal(blocked.step, 0);
    assert.equal(blocked.errors.documentType, DOCUMENT_TYPE_MESSAGE);

    const passed = advanced(
      stateWith({
        fullName: ADULT_NAME,
        documentNumber: DOCUMENT_NUMBER,
        documentType: DOCUMENT_TYPE,
      }),
    );
    assert.equal(passed.step, 1);
    assert.deepEqual(passed.errors, {});
  });
});

void describe("new-student wizard: guardian validation", () => {
  void it("requires guardian name and contact for minors, mirroring the backend", () => {
    const missingAll = advanced(stateWith({ fullName: MINOR_NAME, birthDate: MINOR_BIRTH_TYPED }));
    assert.equal(missingAll.step, 0);
    assert.equal(missingAll.errors.guardianName, GUARDIAN_REQUIRED_MESSAGE);
    assert.equal(missingAll.errors.guardianPhone, GUARDIAN_CONTACT_MESSAGE);

    const missingContact = advanced(
      stateWith({
        fullName: MINOR_NAME,
        birthDate: MINOR_BIRTH_TYPED,
        guardianName: GUARDIAN_NAME,
      }),
    );
    assert.equal(missingContact.errors.guardianPhone, GUARDIAN_CONTACT_MESSAGE);
  });

  void it("treats whitespace guardian names and emails as blank", () => {
    const blankGuardianName = advanced(
      stateWith({
        fullName: MINOR_NAME,
        birthDate: MINOR_BIRTH_TYPED,
        guardianName: BLANK_TEXT,
        guardianPhone: GUARDIAN_PHONE,
      }),
    );
    assert.equal(blankGuardianName.step, 0);
    assert.equal(blankGuardianName.errors.guardianName, GUARDIAN_REQUIRED_MESSAGE);

    const blankEmail = advanced(
      stateWith({
        fullName: MINOR_NAME,
        birthDate: MINOR_BIRTH_TYPED,
        guardianName: GUARDIAN_NAME,
        guardianEmail: BLANK_TEXT,
      }),
    );
    assert.equal(blankEmail.step, 0);
    assert.equal(blankEmail.errors.guardianPhone, GUARDIAN_CONTACT_MESSAGE);
  });
});

void describe("new-student wizard: guardian contact alternatives", () => {
  void it("accepts a minor guardian contact by phone or email", () => {
    const passedWithPhone = advanced(
      stateWith({
        fullName: MINOR_NAME,
        birthDate: "01/01/2015",
        guardianName: GUARDIAN_NAME,
        guardianPhone: GUARDIAN_PHONE,
      }),
    );
    assert.equal(passedWithPhone.step, 1);
    assert.deepEqual(passedWithPhone.errors, {});

    const passed = advanced(
      stateWith({
        fullName: MINOR_NAME,
        birthDate: MINOR_BIRTH_TYPED,
        guardianName: GUARDIAN_NAME,
        guardianEmail: GUARDIAN_EMAIL,
      }),
    );
    assert.equal(passed.step, 1);
    assert.deepEqual(passed.errors, {});
  });
});

void describe("new-student wizard: birth date validation", () => {
  void it("rejects a birth date that is not a real dd/mm/aaaa day", () => {
    const partial = advanced(stateWith({ fullName: ADULT_NAME, birthDate: "01/05" }));
    assert.equal(partial.step, 0);
    assert.equal(partial.errors.birthDate, INVALID_DATE_MESSAGE);

    const impossible = advanced(stateWith({ fullName: ADULT_NAME, birthDate: "31/02/2010" }));
    assert.equal(impossible.step, 0);
    assert.equal(impossible.errors.birthDate, INVALID_DATE_MESSAGE);

    assert.equal(
      advanced(stateWith({ fullName: ADULT_NAME, birthDate: ADULT_BIRTH_TYPED })).step,
      1,
    );
  });
});

function typed(field: "birthDate" | "phone" | "guardianPhone", value: string): string {
  const state = newStudentReducer(initialNewStudentState, { type: "fieldChanged", field, value });

  switch (field) {
    case "birthDate": {
      return state.fields.birthDate;
    }
    case "phone": {
      return state.fields.phone;
    }
    case "guardianPhone": {
      return state.fields.guardianPhone;
    }
  }
}

void describe("new-student wizard: masks and guardian disclosure", () => {
  void it("masks the birth date and phones as the secretary types", () => {
    assert.equal(typed("birthDate", "01052010"), MINOR_BIRTH_TYPED);
    assert.equal(typed("birthDate", "0105"), "01/05");
    assert.equal(typed("phone", PHONE_DIGITS), GUARDIAN_PHONE);
    assert.equal(typed("guardianPhone", PHONE_DIGITS), GUARDIAN_PHONE);
  });

  void it("shows the guardian section for minors, on request, or once it has content", () => {
    assert.equal(isGuardianSectionOpen(initialNewStudentState, TODAY), false);
    assert.equal(isGuardianSectionOpen(stateWith({ birthDate: MINOR_BIRTH_TYPED }), TODAY), true);
    assert.equal(isGuardianSectionOpen(stateWith({ guardianName: GUARDIAN_NAME }), TODAY), true);

    const opened = newStudentReducer(initialNewStudentState, {
      type: "guardianToggled",
      open: true,
    });
    assert.equal(isGuardianSectionOpen(opened, TODAY), true);
  });

  void it("closing the guardian section discards its fields and errors", () => {
    const withGuardian = newStudentReducer(
      {
        ...stateWith({ guardianName: GUARDIAN_NAME }),
        errors: { fullName: REQUIRED_MESSAGE, guardianPhone: "x" },
      },
      { type: "guardianToggled", open: false },
    );

    assert.equal(withGuardian.fields.guardianName, "");
    assert.equal(withGuardian.errors.fullName, REQUIRED_MESSAGE);
    assert.equal(withGuardian.errors.guardianPhone, undefined);
    assert.equal(isGuardianSectionOpen(withGuardian, TODAY), false);
  });
});

void describe("new-student wizard: error transitions", () => {
  void it("clears a field's error when it is edited", () => {
    const blocked = advanced(stateWith({ birthDate: "01/05", documentNumber: DOCUMENT_NUMBER }));
    const edited = newStudentReducer(blocked, {
      type: "fieldChanged",
      field: "fullName",
      value: "M",
    });

    assert.equal(edited.errors.fullName, undefined);
    assert.equal(edited.errors.birthDate, INVALID_DATE_MESSAGE);
    assert.equal(edited.errors.documentType, DOCUMENT_TYPE_MESSAGE);
    assert.equal(edited.fields.fullName, "M");
  });

  void it("bumps errorsRevision on failed submits only, never while typing", () => {
    const blocked = advanced(initialNewStudentState);
    assert.equal(blocked.errorsRevision, 1);
    assert.equal(advanced(blocked).errorsRevision, 2);

    const edited = newStudentReducer(blocked, {
      type: "fieldChanged",
      field: "fullName",
      value: "M",
    });
    assert.equal(edited.errorsRevision, blocked.errorsRevision);

    const passed = advanced(stateWith({ fullName: ADULT_NAME }));
    assert.equal(passed.errorsRevision, 0);
  });

  void it("returns to Dados with the server's field errors on rejection", () => {
    const onFinanceiro = advanced(advanced(stateWith({ fullName: ADULT_NAME })));
    const rejected = newStudentReducer(onFinanceiro, {
      type: "serverRejected",
      errors: { guardianName: SERVER_GUARDIAN_REQUIRED_MESSAGE },
      formError: null,
    });

    assert.equal(rejected.step, 0);
    assert.equal(rejected.errors.guardianName, SERVER_GUARDIAN_REQUIRED_MESSAGE);
    assert.equal(rejected.errorsRevision, onFinanceiro.errorsRevision + 1);
  });
});

void describe("new-student wizard: step transitions", () => {
  void it("skips through Turma and Financeiro and walks back", () => {
    const onTurma = advanced(stateWith({ fullName: ADULT_NAME }));
    const onFinanceiro = advanced(onTurma);
    assert.equal(onFinanceiro.step, 2);
    assert.equal(advanced(onFinanceiro).step, 2);

    const back = newStudentReducer(onFinanceiro, { type: "backRequested" });
    assert.equal(back.step, 1);
  });

  void it("resets to the initial state", () => {
    const dirty = advanced(stateWith({ fullName: ADULT_NAME }));
    assert.deepEqual(newStudentReducer(dirty, { type: "reset" }), BLANK_STATE);
  });
});

void describe("toCreateInput", () => {
  void it("drops empty fields and keeps the typed calendar day", () => {
    const input = toCreateInput({
      ...initialNewStudentState.fields,
      fullName: "  Maria Silva  ",
      birthDate: MINOR_BIRTH_TYPED,
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
