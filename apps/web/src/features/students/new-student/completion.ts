import { useEffect, useRef, useState, type RefObject } from "react";
import type { RouterOutputs } from "@lazuli/api";
import type { CreateMonthlyContractInput } from "@lazuli/validators";
import { trpc, type ClientError, type QueryResult } from "~/lib/trpc";
import { serverRejectionFor, type ServerRejection } from "../logic";
import { emptyContractFields } from "../../contracts/contract-form-model";
import {
  fieldErrors,
  useContractFormState,
  type ContractFormState,
} from "../../contracts/new-contract-state";
import { studentContractInput, studentContractPreview } from "./finance-model";
import { completionErrorMessage } from "./completion-errors";
import { toCreateInput, type StudentCreateInput } from "./to-create-input";
import type { NewStudentFields } from "./reducer";

const EMPTY_FINANCE_FIELDS = emptyContractFields;
type OfferQuery = QueryResult<RouterOutputs["finance"]["readContractOffer"]>;
type CompletionInput = {
  open: boolean;
  financeActive: boolean;
  student: NewStudentFields;
  onCreated: (id: string) => void;
  onRejected: (rejection: ServerRejection) => void;
};
export type StudentCompletion = {
  state: ContractFormState;
  offer: OfferQuery;
  preview: ReturnType<typeof studentContractPreview>;
  errorsRevision: number;
  finish: (withContract: boolean) => void;
  reset: () => void;
  pending: boolean;
  isSubmitting: () => boolean;
};
type CompletionMutations = {
  pending: boolean;
  createStudent: (input: StudentCreateInput) => void;
  createContract: (input: CreateMonthlyContractInput) => void;
};

function useCompletionOffer(open: boolean, state: ContractFormState): OfferQuery {
  const offer = trpc.finance.readContractOffer.useQuery(undefined, { enabled: open });
  const ceiling = offer.data?.tuitionCeilingCents;
  const suggest = state.setSuggestedMonthlyAmount;
  useEffect(() => {
    if (open && ceiling !== undefined) suggest(ceiling);
  }, [open, ceiling, suggest]);
  return offer;
}

type CompletionHandlers = {
  created: (id: string) => void;
  rejected: (error: ClientError, finance: boolean) => void;
};

function useCompletionMutations(
  input: CompletionHandlers & { commandId: string },
): CompletionMutations {
  const mutation = trpc.students.completeCreation.useMutation({
    onSuccess: (result) => input.created(result.id),
    onError: (error, values) => input.rejected(error, "contract" in values),
  });
  return {
    pending: mutation.isPending,
    createStudent: (student) => mutation.mutate({ commandId: input.commandId, student }),
    createContract: (contract) => mutation.mutate({ contract }),
  };
}

function submitCompletion(input: {
  state: ContractFormState;
  student: NewStudentFields;
  offer: OfferQuery["data"];
  preview: StudentCompletion["preview"];
  submitting: RefObject<boolean>;
  mutations: CompletionMutations;
  invalid: () => void;
}): (withContract: boolean) => void {
  return (withContract): void => {
    if (input.submitting.current) return;
    if (!withContract) {
      input.submitting.current = true;
      input.mutations.createStudent(toCreateInput(input.student));
      return;
    }
    if (!input.offer) {
      input.state.setSubmissionError(
        "Aguarde as condições financeiras ou crie o aluno sem contrato.",
      );
      return;
    }
    const parsed = studentContractInput({
      fields: input.state.fields,
      student: input.student,
      commandId: input.state.commandId.current,
    });
    if (!parsed.success || !input.preview) {
      input.state.setErrors(fieldErrors(parsed, Boolean(input.preview)));
      input.invalid();
      return;
    }
    input.state.setSubmissionError("");
    input.submitting.current = true;
    input.mutations.createContract(parsed.data);
  };
}

function useCompletionHandlers(
  input: Pick<CompletionInput, "onCreated" | "onRejected"> & {
    state: ContractFormState;
    submitting: RefObject<boolean>;
    reset: () => void;
  },
): CompletionHandlers {
  const utils = trpc.useUtils();
  const created = (id: string): void => {
    void utils.students.list.invalidate();
    void utils.finance.listContracts.invalidate();
    void utils.finance.searchContractParties.invalidate();
    input.submitting.current = false;
    input.reset();
    input.onCreated(id);
  };
  const rejected = (error: ClientError, finance: boolean): void => {
    input.submitting.current = false;
    const rejection = serverRejectionFor(error);
    if (!finance || Object.keys(rejection.errors).length > 0) input.onRejected(rejection);
    else input.state.setSubmissionError(completionErrorMessage(error));
  };
  return { created, rejected };
}

export function useStudentCompletion(input: CompletionInput): StudentCompletion {
  const state = useContractFormState(input.open, EMPTY_FINANCE_FIELDS);
  const submitting = useRef(false);
  const [errorsRevision, setErrorsRevision] = useState(0);
  const offer = useCompletionOffer(input.open && input.financeActive, state);
  const preview = studentContractPreview({
    fields: state.fields,
    student: input.student,
    offer: offer.data,
  });
  const reset = (): void => {
    state.reset();
    setErrorsRevision(0);
  };
  const handlers = useCompletionHandlers({
    state,
    submitting,
    reset,
    onCreated: input.onCreated,
    onRejected: input.onRejected,
  });
  const mutations = useCompletionMutations({ ...handlers, commandId: state.commandId.current });
  const finish = submitCompletion({
    state,
    student: input.student,
    offer: offer.data,
    preview,
    submitting,
    mutations,
    invalid: () => setErrorsRevision((current) => current + 1),
  });
  return {
    state,
    offer,
    preview,
    errorsRevision,
    finish,
    reset,
    pending: mutations.pending,
    isSubmitting: () => submitting.current,
  };
}
