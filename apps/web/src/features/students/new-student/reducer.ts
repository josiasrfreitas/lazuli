/**
 * Pure state machine of the "Novo aluno" wizard. No React, no dates read from
 * the environment — the component passes today's date in São Paulo with the
 * action, so every transition is unit-testable.
 *
 * Client validation mirrors the backend rules (packages/validators/student.ts
 * and students/data.ts): name, document, birth date and contact required, and
 * a minor needs a guardian with phone or email. The server stays the
 * authority — its rejections come back through `serverRejected`.
 *
 * Text fields hold what the secretary sees: the birth date is `dd/mm/aaaa`
 * and phones are masked, so a single Tab crosses each of them.
 */

import { maskDateBR, maskPhoneBR, parseDateBR } from "~/lib/masks";

export const NEW_STUDENT_STEPS = ["Dados", "Endereço", "Pedagógico", "Financeiro"] as const;

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
  | "guardianEmail"
  | "guardianDocumentType"
  | "guardianDocumentNumber";

export type AddressFields = Record<
  "street" | "number" | "complement" | "neighborhood" | "city" | "state" | "postalCode",
  string
>;
export type NewStudentFields = Record<NewStudentFieldName, string> & { address?: AddressFields };

export type NewStudentErrors = Partial<Record<NewStudentFieldName, string>>;

export type NewStudentState = {
  step: number;
  fields: NewStudentFields;
  errors: NewStudentErrors;
  /** A rejection that does not belong to any single field. */
  formError: string | null;
  /**
   * Bumped only when a submit fails (client validation or server rejection),
   * never while typing — the dialog scrolls the first invalid field into view
   * once per bump, so mid-typing error clearing cannot re-trigger it.
   */
  errorsRevision: number;
};

export type NewStudentAction =
  | { type: "addressChanged"; address: AddressFields }
  | { type: "fieldChanged"; field: NewStudentFieldName; value: string }
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
  guardianDocumentType: "",
  guardianDocumentNumber: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
};

export const initialNewStudentState: NewStudentState = {
  step: FIRST_STEP,
  fields: EMPTY_FIELDS,
  errors: {},
  formError: null,
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

const INVALID_DATE_MESSAGE = "Data inválida. Use dd/mm/aaaa.";
const DOCUMENT_TYPE_MESSAGE = "Informe o tipo do documento.";
const GUARDIAN_REQUIRED_MESSAGE = "Responsável obrigatório para alunos menores de idade.";
const GUARDIAN_CONTACT_MESSAGE = "Informe telefone ou email do responsável.";

export function validateDados(fields: NewStudentFields, today: string): NewStudentErrors {
  const errors: NewStudentErrors = {};

  if (fields.fullName.trim() === "") {
    errors.fullName = "Informe o nome do aluno.";
  }

  if (!fields.birthDate.trim()) errors.birthDate = "Informe a data de nascimento do aluno.";
  if (!fields.documentNumber.trim()) errors.documentNumber = "Informe o CPF ou RG do aluno.";
  if (!fields.phone.trim() && !fields.email.trim())
    errors.phone = "Informe telefone ou e-mail do aluno.";

  if (fields.birthDate !== "" && parseDateBR(fields.birthDate) === null) {
    errors.birthDate = INVALID_DATE_MESSAGE;
  }

  if (fields.documentNumber.trim() && !fields.documentType)
    errors.documentType = DOCUMENT_TYPE_MESSAGE;
  Object.assign(errors, validateGuardian(fields, today));
  return errors;
}

function validateGuardian(fields: NewStudentFields, today: string): NewStudentErrors {
  const errors: NewStudentErrors = {};
  const minor = isMinorFromFields(fields, today);
  const hasGuardian = [
    fields.guardianName,
    fields.guardianDocumentNumber,
    fields.guardianPhone,
    fields.guardianEmail,
  ].some((value) => value.trim());
  if (minor || hasGuardian) {
    if (!fields.guardianDocumentNumber.trim())
      errors.guardianDocumentNumber = "Informe o CPF ou RG do responsável.";
    if (fields.guardianDocumentNumber.trim() && !fields.guardianDocumentType)
      errors.guardianDocumentType = DOCUMENT_TYPE_MESSAGE;
    if (fields.guardianName.trim() === "") {
      errors.guardianName = minor ? GUARDIAN_REQUIRED_MESSAGE : "Informe o nome do responsável.";
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

export function newStudentReducer(
  state: NewStudentState,
  action: NewStudentAction,
): NewStudentState {
  switch (action.type) {
    case "addressChanged": {
      return { ...state, fields: { ...state.fields, address: action.address } };
    }
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
    case "nextRequested": {
      return nextFrom(state, action.today);
    }
    case "backRequested": {
      return { ...state, step: Math.max(state.step - 1, FIRST_STEP) };
    }
    case "serverRejected": {
      // Field errors return to Dados; a general failure preserves the active step and draft.
      return {
        ...state,
        errors: action.errors,
        formError: action.formError,
        step: Object.keys(action.errors).length > 0 ? FIRST_STEP : state.step,
        errorsRevision: state.errorsRevision + 1,
      };
    }
    case "reset": {
      return initialNewStudentState;
    }
  }
}
