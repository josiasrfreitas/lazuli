"use client";
import type { JSX as ReactJSX } from "react";
import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Save, UserRoundPlus } from "lucide-react";
import { FormSection, Stepper } from "@lazuli/ui";
import {
  leadCaptureSchema,
  leadRegistrationSchema,
  type placementScheduleSchema,
  type z,
} from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { LeadFormDialog, useLeadErrors } from "./lead-form";
import { InterestChoice } from "./candidate-fields";
import { IntakeStageSelect } from "./intake-fields";
import { dateLabel, leadInterestLabels, type Candidate } from "./labels";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { PendingRegistrationDialog } from "~/features/shared/pending-registration-dialog";
import { PlacementSchedule, type PlacementScheduleDraft } from "./placement-schedule";

import { LeadCaptureContactFields, LeadCaptureNotesField, type Draft } from "./lead-capture-fields";
export type LeadRegistration = z.infer<typeof leadRegistrationSchema>;
type DraftDestination = {
  initial: LeadRegistration | null;
  identity: Partial<Draft>;
  onConfirm: (registration: LeadRegistration) => void;
};
type CaptureProps = {
  onClose: () => void;
  initialName?: string;
  initialEnglishExperience?: "NONE" | "SOME";
} & (
  | { candidate?: Candidate; onCreated?: (id: string) => void; destination?: never }
  | { candidate?: never; onCreated?: never; destination: DraftDestination }
);

function contactDetails(
  candidate: Candidate | undefined,
  initialName: string,
): Pick<Draft, "fullName" | "phone" | "email" | "contactName"> {
  return {
    fullName: candidate?.fullName ?? initialName,
    phone: candidate?.phone ?? "",
    email: candidate?.email ?? "",
    contactName: candidate?.contactName ?? "",
  };
}

function contactMetadata(candidate: Candidate | undefined): Pick<Draft, "source" | "notes"> {
  return {
    source: candidate?.source ?? "",
    notes: candidate?.notes ?? "",
  };
}

function contactOwnership(
  candidate: Candidate | undefined,
): Pick<Draft, "contactRole" | "contactOwner" | "birthDate"> {
  return {
    contactRole:
      candidate?.contactRole === "GUARDIAN" ? ("GUARDIAN" as const) : ("STUDENT" as const),
    contactOwner:
      candidate?.contactOwner === "GUARDIAN" ? ("GUARDIAN" as const) : ("STUDENT" as const),
    birthDate: candidate?.birthDate ? dateLabel(candidate.birthDate) : "",
  };
}

function englishExperience(
  candidate: Candidate | undefined,
  initial: "NONE" | "SOME",
): Draft["englishExperience"] {
  if (candidate?.englishExperience === "SOME") return "SOME";
  if (candidate?.englishExperience === "UNKNOWN") return "UNKNOWN";
  return initial;
}

function learningDraft(
  candidate: Candidate | undefined,
  initial: "NONE" | "SOME",
): Pick<Draft, "englishExperience" | "stageId" | "interest" | "format" | "scheduleType"> {
  return {
    englishExperience: englishExperience(candidate, initial),
    stageId: candidate?.stageId ?? null,
    interest: candidate?.interest ?? ("UNKNOWN" as const),
    format: candidate?.format ?? null,
    scheduleType: candidate?.scheduleType ?? null,
  };
}

function initialDraft(props: {
  candidate: Candidate | undefined;
  destination: DraftDestination | undefined;
  initialName: string;
  initialEnglishExperience: "NONE" | "SOME";
}): Draft {
  const { candidate, destination } = props;
  const initial = destination?.initial?.lead;
  return {
    ...contactDetails(candidate, props.initialName ?? ""),
    ...contactMetadata(candidate),
    ...contactOwnership(candidate),
    ...learningDraft(candidate, props.initialEnglishExperience ?? "NONE"),
    ...destination?.identity,
    ...(initial
      ? { ...initial, birthDate: initial.birthDate ? dateLabel(initial.birthDate) : "" }
      : {}),
  };
}

type CaptureState = {
  id: string;
  placementId: string;
  dirty: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
  discarding: boolean;
  setDiscarding: Dispatch<SetStateAction<boolean>>;
  scheduling: boolean;
  setScheduling: Dispatch<SetStateAction<boolean>>;
  placementDraft: PlacementScheduleDraft | null;
  setPlacementDraft: Dispatch<SetStateAction<PlacementScheduleDraft | null>>;
  confirmPending: boolean;
  setConfirmPending: Dispatch<SetStateAction<boolean>>;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
};

function leadId(props: CaptureProps): string {
  return props.destination?.initial?.lead.id ?? props.candidate?.id ?? crypto.randomUUID();
}

function initialPlacementDraft(
  destination: DraftDestination | undefined,
): PlacementScheduleDraft | null {
  const placement = destination?.initial?.placement;
  return placement ? { ...placement, date: dateLabel(placement.date) } : null;
}

function useCaptureState(props: CaptureProps): CaptureState {
  const [id] = useState(() => leadId(props));
  const [placementId] = useState(
    () => props.destination?.initial?.placement?.id ?? crypto.randomUUID(),
  );
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [placementDraft, setPlacementDraft] = useState<PlacementScheduleDraft | null>(() =>
    initialPlacementDraft(props.destination),
  );
  const [confirmPending, setConfirmPending] = useState(false);
  const [draft, setDraft] = useState<Draft>(() =>
    initialDraft({
      candidate: props.candidate,
      initialName: props.initialName ?? "",
      initialEnglishExperience: props.initialEnglishExperience ?? "NONE",
      destination: props.destination,
    }),
  );
  return {
    id,
    placementId,
    dirty,
    setDirty,
    discarding,
    setDiscarding,
    scheduling,
    setScheduling,
    placementDraft,
    setPlacementDraft,
    confirmPending,
    setConfirmPending,
    draft,
    setDraft,
  };
}

type CaptureMutation = ReturnType<typeof trpc.admissions.capture.useMutation>;
type UpdateMutation = ReturnType<typeof trpc.admissions.details.useMutation>;
type SaveModel = {
  capture: CaptureMutation;
  update: UpdateMutation;
  save: CaptureMutation | UpdateMutation;
};

function useCaptureSave(props: CaptureProps): SaveModel {
  const utils = trpc.useUtils();
  const router = useRouter();
  async function saved(result: { id: string }): Promise<void> {
    await utils.admissions.invalidate();
    props.onClose();
    if (props.onCreated) props.onCreated(result.id);
    else if (!props.candidate) router.push(`/interessados/${result.id}`);
  }
  const capture = trpc.admissions.capture.useMutation({ onSuccess: saved });
  const update = trpc.admissions.details.useMutation({ onSuccess: saved });
  return { capture, update, save: props.candidate ? update : capture };
}

type Placement = z.infer<typeof placementScheduleSchema>;
type CaptureActions = {
  errors: ReturnType<typeof useLeadErrors>;
  capture: CaptureMutation;
  save: CaptureMutation | UpdateMutation;
  requestClose: () => void;
  change: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  submit: (event: FormEvent) => void;
  complete: (placement: Placement | null) => void;
};

function registrationCompletion(input: {
  props: CaptureProps;
  state: CaptureState;
  capture: CaptureMutation;
}): (placement: Placement | null) => void {
  const { props, state, capture } = input;
  return (placement) => {
    const lead = leadCaptureSchema.parse({
      id: state.id,
      ...state.draft,
      birthDate: state.draft.birthDate ? parseDateBR(state.draft.birthDate) : null,
    });
    const registration = leadRegistrationSchema.parse({
      lead,
      placement,
      allowPending: lead.englishExperience === "SOME" && !placement,
    });
    if (props.destination) {
      props.destination.onConfirm(registration);
      props.onClose();
    } else capture.mutate(registration);
  };
}

function useCaptureActions(input: {
  props: CaptureProps;
  state: CaptureState;
  saveModel: SaveModel;
}): CaptureActions {
  const { props, state, saveModel } = input;
  const errors = useLeadErrors();
  const complete = registrationCompletion({ props, state, capture: saveModel.capture });
  function requestClose(): void {
    if (saveModel.save.isPending || state.confirmPending || state.discarding) return;
    if (state.dirty) state.setDiscarding(true);
    else props.onClose();
  }
  function change<K extends keyof Draft>(key: K, value: Draft[K]): void {
    state.setDirty(true);
    state.setDraft((current) => ({ ...current, [key]: value }));
    errors.clear(key);
    saveModel.save.reset();
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (saveModel.save.isPending) return;
    const birthDate = state.draft.birthDate ? parseDateBR(state.draft.birthDate) : null;
    if (state.draft.birthDate && !birthDate) {
      errors.report([{ path: ["birthDate"], message: "Informe uma data válida: dd/mm/aaaa." }]);
      return;
    }
    const parsed = leadCaptureSchema.safeParse({ id: state.id, ...state.draft, birthDate });
    if (!parsed.success) return errors.report(parsed.error.issues);
    if (props.candidate) saveModel.update.mutate(parsed.data);
    else if (state.draft.englishExperience === "SOME") state.setScheduling(true);
    else complete(null);
  }
  return {
    errors,
    capture: saveModel.capture,
    save: saveModel.save,
    requestClose,
    change,
    submit,
    complete,
  };
}

export function LeadCaptureDialog(props: CaptureProps): ReactJSX.Element {
  const state = useCaptureState(props);
  const saveModel = useCaptureSave(props);
  const actions = useCaptureActions({ props, state, saveModel });
  if (state.scheduling)
    return <CaptureScheduleStep props={props} state={state} actions={actions} />;
  return <CaptureDetailsStep props={props} state={state} actions={actions} />;
}

type CaptureViewProps = { props: CaptureProps; state: CaptureState; actions: CaptureActions };

function CaptureScheduleStep({ props, state, actions }: CaptureViewProps): ReactJSX.Element {
  return (
    <>
      <PlacementSchedule
        candidate={{
          id: state.id,
          fullName: state.draft.fullName,
          today: toDateOnlySaoPaulo(new Date()),
          format: state.draft.format,
        }}
        onClose={actions.requestClose}
        registration={{
          id: state.placementId,
          onConfirm: actions.complete,
          onBack: () => state.setScheduling(false),
          onDefer: () => state.setConfirmPending(true),
          draft: state.placementDraft,
          onDraftChange: state.setPlacementDraft,
          onDirty: () => state.setDirty(true),
          pending: actions.capture.isPending,
          error: actions.capture.error?.message,
        }}
      />
      <PendingPlacementDialog state={state} actions={actions} />
      <CaptureDiscard state={state} onClose={props.onClose} />
    </>
  );
}

function PendingPlacementDialog({
  state,
  actions,
}: Pick<CaptureViewProps, "state" | "actions">): ReactJSX.Element | null {
  if (!state.confirmPending) return null;
  return (
    <PendingRegistrationDialog
      entity="lead"
      pendingItems={["Agendar a prova de nivelamento e definir o estágio."]}
      pending={actions.capture.isPending}
      error={actions.capture.error?.message}
      onBack={() => state.setConfirmPending(false)}
      onConfirm={() => actions.complete(null)}
    />
  );
}

function CaptureDiscard({
  state,
  onClose,
}: {
  state: CaptureState;
  onClose: () => void;
}): ReactJSX.Element | null {
  if (!state.discarding) return null;
  return (
    <DiscardRegistrationDialog onKeep={() => state.setDiscarding(false)} onDiscard={onClose} />
  );
}

function submitIcon(props: CaptureProps, draft: Draft): ReactJSX.Element {
  if (props.candidate) return <Save aria-hidden="true" />;
  return draft.englishExperience === "SOME" ? (
    <ArrowRight aria-hidden="true" />
  ) : (
    <UserRoundPlus aria-hidden="true" />
  );
}

function submitLabel(props: CaptureProps, draft: Draft): string {
  if (props.candidate) return "Salvar lead";
  return draft.englishExperience === "SOME" ? "Continuar para agendamento" : "Cadastrar lead";
}

function CaptureSteps({
  props,
  state,
}: Pick<CaptureViewProps, "props" | "state">): ReactJSX.Element | null {
  if (props.candidate || state.draft.englishExperience !== "SOME") return null;
  return (
    <Stepper
      className="mt-4"
      steps={[{ label: "Lead" }, { label: "Nivelamento" }]}
      activeIndex={0}
      label="Cadastro do lead"
    />
  );
}

function CaptureDetailsStep({ props, state, actions }: CaptureViewProps): ReactJSX.Element {
  return (
    <>
      <LeadFormDialog
        id="lead-capture"
        wide
        title={props.candidate ? "Editar lead" : "Novo lead"}
        description={
          props.destination
            ? "O lead e o nivelamento serão salvos ao concluir o cadastro do aluno."
            : "Registre o contato e o ponto de partida do aluno."
        }
        firstField="lead-name"
        body={actions.errors.body}
        pending={actions.save.isPending}
        error={actions.save.error?.message}
        steps={<CaptureSteps props={props} state={state} />}
        submitIcon={submitIcon(props, state.draft)}
        submitLabel={submitLabel(props, state.draft)}
        onSubmit={actions.submit}
        onClose={actions.requestClose}
      >
        <CaptureFields props={props} state={state} actions={actions} />
      </LeadFormDialog>
      <CaptureDiscard state={state} onClose={props.onClose} />
    </>
  );
}

function CaptureFields({ props, state, actions }: CaptureViewProps): ReactJSX.Element {
  return (
    <fieldset disabled={actions.save.isPending} className="grid min-w-0 gap-6 md:grid-cols-2">
      <div className="grid content-start gap-5">
        <LeadCaptureContactFields
          draft={state.draft}
          errors={actions.errors.fields}
          change={actions.change}
        />
      </div>
      <div className="grid content-start gap-5 md:border-l md:border-border md:pl-6">
        <CaptureLearningFields props={props} state={state} actions={actions} />
        <LeadCaptureNotesField
          value={state.draft.notes ?? ""}
          onChange={(value) => actions.change("notes", value)}
          error={actions.errors.fields.notes}
        />
      </div>
    </fieldset>
  );
}

function CaptureLearningFields({ props, state, actions }: CaptureViewProps): ReactJSX.Element {
  return (
    <FormSection title="Ponto de partida">
      <ExperienceFields props={props} state={state} actions={actions} />
      <InterestChoice
        label="Interesse"
        value={state.draft.interest}
        options={leadInterestLabels}
        onChange={(value) => actions.change("interest", value as Draft["interest"])}
      />
      <InterestChoice
        label="Preferência de formato (opcional)"
        value={state.draft.format ?? "NONE"}
        options={{ NONE: "Sem preferência", IN_PERSON: "Presencial", ONLINE: "Online" }}
        onChange={(value) =>
          actions.change("format", value === "NONE" ? null : (value as Draft["format"]))
        }
      />
      <p className="text-caption text-muted-foreground">
        O formato definitivo será escolhido no cadastro do aluno.
      </p>
    </FormSection>
  );
}

function ExperienceFields({ props, state, actions }: CaptureViewProps): ReactJSX.Element {
  return (
    <>
      <InterestChoice
        label="Já estudou inglês?"
        value={state.draft.englishExperience}
        options={{ NONE: "Está começando", SOME: "Já tem conhecimento" }}
        onChange={(value) => {
          actions.change("englishExperience", value as Draft["englishExperience"]);
          actions.change("stageId", null);
        }}
      />
      {state.draft.englishExperience === "NONE" ? (
        <IntakeStageSelect
          initialOnly
          value={state.draft.stageId}
          onChange={(value) => actions.change("stageId", value)}
          error={actions.errors.fields.stageId}
        />
      ) : (
        <p className="text-caption text-muted-foreground">
          {props.candidate
            ? "O nivelamento define o estágio."
            : "Na próxima etapa, agende a prova presencial ou online."}{" "}
          O agendamento não exige professor.
        </p>
      )}
    </>
  );
}
