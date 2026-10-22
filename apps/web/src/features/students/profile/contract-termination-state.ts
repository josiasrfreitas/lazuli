import { useState, type Dispatch, type SetStateAction } from "react";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import { terminationFeeCents } from "@lazuli/domain";
import { contractTerminationConfirmSchema } from "@lazuli/validators";

export type TerminationPreview = RouterOutputs["finance"]["previewTermination"];
type Enrollment = TerminationPreview["enrollments"][number];
export type TerminationInput = RouterInputs["finance"]["confirmTermination"];
const MAX_TERMINATION_FEE_PERCENT = 100;

export type TerminationState = {
  commandId: string;
  fee: string;
  setFee: Dispatch<SetStateAction<string>>;
  charges: number | null;
  setCharges: Dispatch<SetStateAction<number | null>>;
  dueDate: string;
  setDueDate: Dispatch<SetStateAction<string>>;
  enrollmentIds: string[];
  setEnrollmentIds: Dispatch<SetStateAction<string[]>>;
  reason: string;
  setReason: Dispatch<SetStateAction<string>>;
  review: boolean;
  setReview: Dispatch<SetStateAction<boolean>>;
  acknowledged: boolean;
  setAcknowledged: Dispatch<SetStateAction<boolean>>;
  confirmationName: string;
  setConfirmationName: Dispatch<SetStateAction<string>>;
  error: string | undefined;
  setError: Dispatch<SetStateAction<string | undefined>>;
  enrollmentError: string | undefined;
  setEnrollmentError: Dispatch<SetStateAction<string | undefined>>;
};

export function useTerminationState(preview: TerminationPreview): TerminationState {
  const [commandId] = useState(() => crypto.randomUUID());
  const [fee, setFee] = useState(String(preview.defaultFeePct));
  const [charges, setCharges] = useState<number | null>(preview.chargesCents);
  const [dueDate, setDueDate] = useState(preview.today);
  const [enrollmentIds, setEnrollmentIds] = useState(
    preview.enrollments.filter((row) => !row.scheduledChanges).map((row) => row.id),
  );
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const [error, setError] = useState<string>();
  const [enrollmentError, setEnrollmentError] = useState<string>();
  return {
    commandId,
    fee,
    setFee,
    charges,
    setCharges,
    dueDate,
    setDueDate,
    enrollmentIds,
    setEnrollmentIds,
    reason,
    setReason,
    review,
    setReview,
    acknowledged,
    setAcknowledged,
    confirmationName,
    setConfirmationName,
    error,
    setError,
    enrollmentError,
    setEnrollmentError,
  };
}

export type TerminationAmounts = {
  feePct: number;
  retainedChargesCents: number;
  validFee: boolean;
  feeCents: number;
  total: number;
  selected: Enrollment[];
  nameConfirmed: boolean;
};

export function terminationAmounts(
  preview: TerminationPreview,
  state: TerminationState,
): TerminationAmounts {
  const feePct = Number(state.fee.replace(",", "."));
  const retainedChargesCents = state.charges ?? 0;
  const validFee =
    state.fee.trim() !== "" &&
    Number.isFinite(feePct) &&
    feePct >= 0 &&
    feePct <= MAX_TERMINATION_FEE_PERCENT;
  const feeCents = validFee ? terminationFeeCents(preview.openPrincipalCents, feePct) : 0;
  const total =
    preview.overduePrincipalCents +
    (Number.isFinite(retainedChargesCents) ? retainedChargesCents : 0) +
    feeCents;
  const selected = preview.enrollments.filter((row) => state.enrollmentIds.includes(row.id));
  const nameConfirmed = state.confirmationName.trim() === preview.studentName.trim();
  return { feePct, retainedChargesCents, validFee, feeCents, total, selected, nameConfirmed };
}

export type TerminationValidation =
  | { input: TerminationInput; error?: never; field?: never }
  | { input?: never; error: string; field: "form" | "enrollment" };

type ValidationContext = { state: TerminationState; amounts: TerminationAmounts };

export function validateTermination(
  preview: TerminationPreview,
  context: ValidationContext,
): TerminationValidation {
  const { state, amounts } = context;
  if (state.review && !amounts.nameConfirmed)
    return { error: "Digite o nome completo do aluno para confirmar a rescisão.", field: "form" };
  const terms = validateTerminationTerms(preview, context);
  if (!terms.input) return terms;
  if (preview.enrollments.length > 0 && amounts.selected.length === 0)
    return { error: "Selecione a matrícula que será encerrada.", field: "enrollment" };
  if (amounts.selected.some((row) => row.scheduledChanges))
    return {
      error: "Resolva a programação desta matrícula antes de continuar.",
      field: "enrollment",
    };
  return terms;
}

function validateTerminationTerms(
  preview: TerminationPreview,
  { state, amounts }: ValidationContext,
): TerminationValidation {
  const parsed = contractTerminationConfirmSchema.safeParse({
    contractId: preview.contractId,
    commandId: state.commandId,
    version: preview.version,
    feePct: amounts.feePct,
    retainedChargesCents: amounts.retainedChargesCents,
    dueDate: state.dueDate,
    enrollmentIds: state.enrollmentIds,
    reason: state.reason,
    acknowledged: state.review ? state.acknowledged : true,
  });
  if (!amounts.validFee || state.charges === null || !parsed.success)
    return {
      error: parsed.success
        ? "Informe a multa e os encargos negociados."
        : (parsed.error.issues[0]?.message ?? "Confira os dados da rescisão."),
      field: "form",
    };
  if (amounts.retainedChargesCents > preview.chargesCents)
    return {
      error: "Os encargos negociados não podem superar os encargos apurados.",
      field: "form",
    };
  if (state.dueDate < preview.today)
    return { error: "O vencimento deve ser hoje ou uma data futura.", field: "form" };
  return { input: parsed.data };
}
