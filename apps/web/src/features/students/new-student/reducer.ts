/**
 * Pure state machine of the "Novo aluno" wizard. No React, no dates read from
 * the environment — the component passes today's date in São Paulo with the
 * action, so every transition is unit-testable.
 *
 * Client validation mirrors the backend rules (packages/validators/student.ts
 * and students/data.ts): name required, a document number needs its type, and
 * a minor needs a guardian with phone or email. The server stays the
 * authority — its rejections come back through `serverRejected`.
 *
 * Text fields hold what the secretary sees: the birth date is `dd/mm/aaaa`
 * and phones are masked, so a single Tab crosses each of them.
 */

import { maskDateBR, maskPhoneBR, parseDateBR } from "~/lib/masks";

export const NEW_STUDENT_STEPS = ["Dados", "Turma", "Financeiro"] as const;

const FIRST_STEP = 0;
const LAST_STEP = NEW_STUDENT_STEPS.length - 1;
const ADULT_AGE_YEARS = 18;

export type NewStudentFieldName =
  | "fullName"
  | "phone"
  | "email"
  | "birthDate"
  | "documentType"
  | "documentNumber"
  | "guardianName"
  | "guardianPhone"
  | "guardianEmail";

export type NewStudentFields = Record<NewStudentFieldName, string>;

export type NewStudentErrors = Partial<Record<NewStudentFieldName, string>>;

export type NewStudentState = {
  step: number;
  fields: NewStudentFields;
  errors: NewStudentErrors;
  /** A rejection that does not belong to any single field. */
  formError: string | null;
  /** The secretary chose to add a guardian for an adult (progressive disclosure). */
  guardianOpen: boolean;
  /**
   * Bumped only when a submit fails (client validation or server rejection),
   * never while typing — the dialog scrolls the first invalid field into view
   * once per bump, so mid-typing error clearing cannot re-trigger it.
   */
  errorsRevision: number;
};

export type NewStudentAction =
  | { type: "fieldChanged"; field: NewStudentFieldName; value: string }
  | { type: "guardianToggled"; open: boolean }
  | { type: "nextRequested"; today: string }
  | { type: "backRequested" }
  | { type: "serverRejected"; errors: NewStudentErrors; formError: string | null }
  | { type: "reset" };

const EMPTY_FIELDS: NewStudentFields = {
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

const GUARDIAN_FIELDS = ["guardianName", "guardianPhone", "guardianEmail"] as const;

export const initialNewStudentState: NewStudentState = {
  step: FIRST_STEP,
  fields: EMPTY_FIELDS,
  errors: {},
  formError: null,
  guardianOpen: false,
  errorsRevision: 0,
};

/** Both dates are `yyyy-mm-dd`; ISO strings order lexicographically. */
export function isMinorOn(input: { birthDate: string; today: string }): boolean {
  if (input.birthDate === "") {
    return false;
  }

  const [year, ...monthDay] = input.birthDate.split("-");
  const adultFrom = [Number(year) + ADULT_AGE_YEARS, ...monthDay].join("-");

  return adultFrom > input.today;
}

/** Whether the typed `dd/mm/aaaa` birth date makes the student a minor today. */
export function isMinorFromFields(fields: NewStudentFields, today: string): boolean {
  return isMinorOn({ birthDate: parseDateBR(fields.birthDate) ?? "", today });
}

/** The guardian section shows for minors, on request, or once it has content. */
export function isGuardianSectionOpen(state: NewStudentState, today: string): boolean {
  return (
    state.guardianOpen ||
    isMinorFromFields(state.fields, today) ||
    GUARDIAN_FIELDS.some((field) => state.fields[field] !== "")
  );
}

const REQUIRED_MESSAGE = "Campo obrigatório.";
const INVALID_DATE_MESSAGE = "Data inválida. Use dd/mm/aaaa.";
const DOCUMENT_TYPE_MESSAGE = "Informe o tipo do documento.";
const GUARDIAN_REQUIRED_MESSAGE = "Responsável obrigatório para alunos menores de idade.";
const GUARDIAN_CONTACT_MESSAGE = "Informe telefone ou email do responsável.";

function validateDados(fields: NewStudentFields, today: string): NewStudentErrors {
  const errors: NewStudentErrors = {};

  if (fields.fullName.trim() === "") {
    errors.fullName = REQUIRED_MESSAGE;
  }

  if (fields.birthDate !== "" && parseDateBR(fields.birthDate) === null) {
    errors.birthDate = INVALID_DATE_MESSAGE;
  }

  if (fields.documentNumber.trim() !== "" && fields.documentType === "") {
    errors.documentType = DOCUMENT_TYPE_MESSAGE;
  }

  if (isMinorFromFields(fields, today)) {
    if (fields.guardianName.trim() === "") {
      errors.guardianName = GUARDIAN_REQUIRED_MESSAGE;
    }

    if (fields.guardianPhone.trim() === "" && fields.guardianEmail.trim() === "") {
      errors.guardianPhone = GUARDIAN_CONTACT_MESSAGE;
    }
  }

  return errors;
}

function nextFrom(state: NewStudentState, today: string): NewStudentState {
  if (state.step === FIRST_STEP) {
    const errors = validateDados(state.fields, today);

    if (Object.keys(errors).length > 0) {
      return { ...state, errors, errorsRevision: state.errorsRevision + 1 };
    }
  }

  return { ...state, errors: {}, step: Math.min(state.step + 1, LAST_STEP) };
}

function normalizeField(field: NewStudentFieldName, value: string): string {
  switch (field) {
    case "birthDate": {
      return maskDateBR(value);
    }
    case "phone":
    case "guardianPhone": {
      return maskPhoneBR(value);
    }
    default: {
      return value;
    }
  }
}

function guardianToggled(state: NewStudentState, open: boolean): NewStudentState {
  if (open) {
    return { ...state, guardianOpen: true };
  }

  // Closing discards the guardian so the hidden fields cannot fail validation.
  const fields = { ...state.fields };
  const errors = { ...state.errors };

  for (const field of GUARDIAN_FIELDS) {
    fields[field] = "";
    delete errors[field];
  }

  return { ...state, errors, fields, guardianOpen: false };
}

export function newStudentReducer(
  state: NewStudentState,
  action: NewStudentAction,
): NewStudentState {
  switch (action.type) {
    case "fieldChanged": {
      const errors = { ...state.errors };
      delete errors[action.field];

      return {
        ...state,
        errors,
        fields: { ...state.fields, [action.field]: normalizeField(action.field, action.value) },
        formError: null,
      };
    }
    case "guardianToggled": {
      return guardianToggled(state, action.open);
    }
    case "nextRequested": {
      return nextFrom(state, action.today);
    }
    case "backRequested": {
      return { ...state, step: Math.max(state.step - 1, FIRST_STEP) };
    }
    case "serverRejected": {
      // The wizard returns to Dados so the rejected fields are in view (IA).
      return {
        ...state,
        errors: action.errors,
        formError: action.formError,
        step: FIRST_STEP,
        errorsRevision: state.errorsRevision + 1,
      };
    }
    case "reset": {
      return initialNewStudentState;
    }
  }
}
