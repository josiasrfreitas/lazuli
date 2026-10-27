import {
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { RouterInputs } from "@lazuli/api";
import { useContractFormState, useContractOffer } from "~/features/contracts/new-contract-state";
import type { LeadRegistration } from "~/features/admissions/lead-capture-dialog";
import { initialNewStudentState, newStudentReducer } from "./reducer";
import type { IntakeStep } from "./new-student-dialog";

type Format = "IN_PERSON" | "ONLINE";
type ScheduleType = "REGULAR" | "PERSONALIZED";
export type IntakeInput =
  | RouterInputs["students"]["enrollNew"]
  | RouterInputs["students"]["resumeIntake"];
type Confirmation = { input: IntakeInput; items: string[] } | null;

export type EnrollmentIdentity = {
  addressPending: boolean;
  setAddressPending: Dispatch<SetStateAction<boolean>>;
  state: ReturnType<typeof newStudentReducer>;
  dispatch: Dispatch<Parameters<typeof newStudentReducer>[1]>;
  candidateId: string | null;
  setCandidateId: Dispatch<SetStateAction<string | null>>;
  stageId: string | null;
  setStageId: Dispatch<SetStateAction<string | null>>;
  format: Format;
  setFormat: Dispatch<SetStateAction<Format>>;
  scheduleType: ScheduleType;
  setScheduleType: Dispatch<SetStateAction<ScheduleType>>;
  selectedId: string;
  setSelectedId: Dispatch<SetStateAction<string>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  draftLead: LeadRegistration | null;
  setDraftLead: Dispatch<SetStateAction<LeadRegistration | null>>;
  prefilled: RefObject<string | null>;
  popup: RefObject<HTMLDivElement | null>;
};

export function useEnrollmentIdentity(initialCandidateId: string | undefined): EnrollmentIdentity {
  const [addressPending, setAddressPending] = useState(false);
  const [state, dispatch] = useReducer(newStudentReducer, initialNewStudentState);
  const [candidateId, setCandidateId] = useState<string | null>(initialCandidateId ?? null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("IN_PERSON");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("REGULAR");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [draftLead, setDraftLead] = useState<LeadRegistration | null>(null);
  const prefilled = useRef<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  return {
    addressPending,
    setAddressPending,
    state,
    dispatch,
    candidateId,
    setCandidateId,
    stageId,
    setStageId,
    format,
    setFormat,
    scheduleType,
    setScheduleType,
    selectedId,
    setSelectedId,
    search,
    setSearch,
    draftLead,
    setDraftLead,
    prefilled,
    popup,
  };
}

export type EnrollmentFlow = {
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  capturingLead: boolean;
  setCapturingLead: Dispatch<SetStateAction<boolean>>;
  step: IntakeStep;
  setStep: Dispatch<SetStateAction<IntakeStep>>;
  visitedContract: boolean;
  setVisitedContract: Dispatch<SetStateAction<boolean>>;
  confirmation: Confirmation;
  setConfirmation: Dispatch<SetStateAction<Confirmation>>;
  dirty: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
  discarding: boolean;
  setDiscarding: Dispatch<SetStateAction<boolean>>;
  commandId: string;
  busy: RefObject<boolean>;
};

export function useEnrollmentFlow(): EnrollmentFlow {
  const [error, setError] = useState("");
  const [capturingLead, setCapturingLead] = useState(false);
  const [step, setStep] = useState<IntakeStep>("student");
  const [visitedContract, setVisitedContract] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [commandId] = useState(() => crypto.randomUUID());
  const busy = useRef(false);
  return {
    error,
    setError,
    capturingLead,
    setCapturingLead,
    step,
    setStep,
    visitedContract,
    setVisitedContract,
    confirmation,
    setConfirmation,
    dirty,
    setDirty,
    discarding,
    setDiscarding,
    commandId,
    busy,
  };
}

export type EnrollmentContract = {
  contract: ReturnType<typeof useContractFormState>;
  offer: ReturnType<typeof useContractOffer>;
};

export function useEnrollmentContract(flow: EnrollmentFlow): EnrollmentContract {
  const contractState = useContractFormState(flow.step === "contract");
  const contract = {
    ...contractState,
    change: (...args: Parameters<typeof contractState.change>): void => {
      flow.setDirty(true);
      contractState.change(...args);
    },
  };
  const offer = useContractOffer(flow.step === "contract", contract.setSuggestedMonthlyAmount);
  return { contract, offer };
}
