import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogPortal,
} from "@lazuli/ui";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { PendingRegistrationDialog } from "~/features/shared/pending-registration-dialog";
import { LeadCaptureDialog } from "~/features/admissions/lead-capture-dialog";
import { isGuardianSectionOpen } from "./reducer";
import { IntakeNameField } from "./intake-name-field";
import { IntakeStudentFields } from "./dados-step";
import { IntakePedagogy } from "./intake-pedagogy";
import { IntakeContract } from "./intake-contract";
import { IntakeDialogHeading, IntakeDialogLoading } from "./intake-dialog-chrome";
import type { EnrollmentModel, IntakeStep } from "./new-student-dialog";

function submitLabel(step: IntakeStep): string {
  if (step === "student") return "Ir para pedagógico";
  if (step === "pedagogy") return "Ir para contrato";
  return "Concluir cadastro";
}

function classSummary(model: EnrollmentModel): string {
  if (model.selected) return `Turma: ${model.selected.name}`;
  if (model.existingEnrollment) return `Turma: ${model.existingEnrollment.class.portalClassName}`;
  return model.step === "student" ? "" : "Turma pendente";
}

export function EnrollmentDialogView({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { existingStudentId, existing, existingPending, onOpenChange, close } = model;
  if (existingStudentId && (!existing.data || !existingPending.data))
    return (
      <IntakeDialogLoading
        error={existing.error?.message ?? existingPending.error?.message}
        onClose={() => onOpenChange(false)}
        onRetry={() => {
          void existing.refetch();
          void existingPending.refetch();
        }}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <EnrollmentMainContent model={model} />
        <EnrollmentAuxDialogs model={model} />
      </DialogPortal>
    </Dialog>
  );
}

function EnrollmentMainContent({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, popup, existingStudentId, state, existingEnrollment, selected } = model;
  return (
    <DialogContent
      className="w-[calc(100%-2rem)] md:w-[calc(100%-2rem)] max-w-7xl md:max-w-7xl data-[step=student]:h-[min(44rem,calc(100dvh-4rem))] data-[step=student]:md:max-w-2xl data-[step=pedagogy]:h-[min(52rem,calc(100dvh-4rem))]"
      data-step={step}
      ref={popup}
      initialFocus={() =>
        popup.current?.querySelector<HTMLInputElement>('input[name="fullName"]') ?? true
      }
    >
      <IntakeDialogHeading
        continuing={Boolean(existingStudentId)}
        step={step}
        name={state.fields.fullName}
        hasEnrollment={Boolean(existingEnrollment)}
        hasClass={Boolean(selected || existingEnrollment)}
      />
      <EnrollmentForm model={model} />
      <EnrollmentFooter model={model} />
    </DialogContent>
  );
}

function EnrollmentForm({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, requestSave, advance, error } = model;
  return (
    <DialogBody
      className={
        step === "pedagogy" ? "flex flex-col overflow-y-auto sm:overflow-hidden" : undefined
      }
    >
      <form
        id="intake-enroll"
        className={step === "pedagogy" ? "flex min-h-0 flex-1 flex-col" : undefined}
        onSubmit={(event) => {
          if (step === "contract") {
            event.preventDefault();
            requestSave(true);
          } else advance(event);
        }}
        noValidate
      >
        {step === "contract" ? (
          <EnrollmentContractFields model={model} />
        ) : (
          <EnrollmentProgressFields model={model} />
        )}
        {error && (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        )}
      </form>
    </DialogBody>
  );
}

function EnrollmentContractFields({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  if (model.existingContract)
    return (
      <Alert variant="success">
        O contrato deste aluno já está cadastrado. Confirme para salvar as alterações das outras
        etapas.
      </Alert>
    );
  return (
    <IntakeContract
      state={model.contract}
      student={model.state.fields}
      offer={model.offer}
      pending={model.pending}
    />
  );
}

function EnrollmentProgressFields({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  return (
    <fieldset
      disabled={model.pending}
      className={`min-w-0 ${model.step === "pedagogy" ? "flex min-h-0 flex-1 flex-col gap-4" : "grid gap-6"}`}
    >
      {model.step === "student" ? (
        <EnrollmentStudentFields model={model} />
      ) : (
        <EnrollmentPedagogyFields model={model} />
      )}
    </fieldset>
  );
}

function EnrollmentStudentFields({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const {
    state,
    minor,
    today,
    setDirty,
    dispatch,
    setError,
    lead,
    existingStudentId,
    candidate,
    candidateId,
  } = model;
  return (
    <div className="grid min-w-0 content-start gap-5">
      <IntakeStudentFields
        fields={state.fields}
        errors={state.errors}
        minor={minor}
        guardianOpen={minor || isGuardianSectionOpen(state, today)}
        nameField={<EnrollmentNameField model={model} />}
        onFieldChange={(field, value) => {
          setDirty(true);
          dispatch({ type: "fieldChanged", field, value });
          setError("");
        }}
        onGuardianToggle={(open) => {
          setDirty(true);
          dispatch({ type: "guardianToggled", open });
        }}
      />
      {lead?.studentId && !existingStudentId && (
        <Alert variant="warning">
          Este lead já está ligado a um aluno.{" "}
          <Link className="underline" href={`/alunos/${lead.studentId}`}>
            Abrir cadastro
          </Link>
        </Alert>
      )}
      {candidate.isError && candidateId && (
        <Alert variant="destructive">
          {candidate.error.message}
          <Button variant="ghost" onClick={() => void candidate.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      )}
    </div>
  );
}

function leadNameOptions(
  model: EnrollmentModel,
): { id: string; label: string; description: string }[] {
  if (model.candidateId || model.draftLead || model.search.length < 2) return [];
  return (model.leads.data?.rows ?? []).map((row) => ({
    id: row.id,
    label: row.fullName,
    description: [row.contactName, row.phone, row.email].filter(Boolean).join(" · "),
  }));
}

function leadLookupStatus(model: EnrollmentModel): { loading: boolean; failed: boolean } {
  if (model.candidateId)
    return { loading: model.candidate.isFetching, failed: model.candidate.isError };
  const enabled = !model.draftLead && model.search.length >= 2;
  return { loading: enabled && model.leads.isFetching, failed: enabled && model.leads.isError };
}

function EnrollmentNameField({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { state, lead, existingStudentId, draftLead, search } = model;
  const lookup = leadLookupStatus(model);
  return (
    <IntakeNameField
      name={state.fields.fullName}
      error={state.errors.fullName}
      linked={Boolean(lead || existingStudentId || draftLead)}
      fromLead={Boolean(lead && !existingStudentId)}
      options={leadNameOptions(model)}
      loading={lookup.loading}
      failed={lookup.failed}
      emptyMessage={
        search.length < 2
          ? "Digite o nome do aluno."
          : "Nenhum lead encontrado. Continue com este nome."
      }
      onChange={(value) => {
        model.setDirty(true);
        model.dispatch({ type: "fieldChanged", field: "fullName", value });
        model.setError("");
      }}
      onSelect={(id) => {
        model.setDirty(true);
        model.setDraftLead(null);
        model.setCandidateId(id);
        model.setSelectedId("");
        model.setError("");
      }}
      onClear={model.clearLead}
    />
  );
}

function EnrollmentPedagogyFields({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const {
    stageId,
    format,
    scheduleType,
    lead,
    draftLead,
    existingEnrollment,
    candidateId,
    existingStudentId,
    options,
    selectedId,
  } = model;
  return (
    <IntakePedagogy
      filters={{ stageId, format, scheduleType }}
      onFiltersChange={(filters) => {
        model.setDirty(true);
        model.setStageId(filters.stageId);
        model.setFormat(filters.format);
        model.setScheduleType(filters.scheduleType);
        model.setSelectedId("");
      }}
      lead={lead}
      draftRegistration={draftLead}
      enrollment={existingEnrollment}
      onCaptureLead={
        !candidateId && !existingStudentId ? () => model.setCapturingLead(true) : undefined
      }
      classes={{
        data: options.data,
        pending: options.isFetching,
        error: options.error?.message,
        onRetry: () => void options.refetch(),
        selectedId,
        onSelect: (id) => {
          model.setDirty(true);
          model.setSelectedId(id);
        },
      }}
    />
  );
}

function EnrollmentFooter({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  return (
    <DialogFooter
      className="mt-4 items-center border-t border-border pt-4 max-sm:data-[step=pedagogy]:grid max-sm:data-[step=pedagogy]:grid-cols-[auto_minmax(0,1fr)] max-sm:data-[step=pedagogy]:gap-x-2 max-sm:data-[step=pedagogy]:gap-y-2 max-sm:data-[step=pedagogy]:[&>p]:col-span-2 max-sm:data-[step=pedagogy]:[&>p]:row-start-1 max-sm:data-[step=pedagogy]:[&>button]:row-start-2 max-sm:data-[step=pedagogy]:[&>button:last-child]:justify-self-end"
      data-step={model.step}
    >
      <EnrollmentBackButton model={model} />
      <p className="mr-auto text-caption text-muted-foreground">{classSummary(model)}</p>
      <EnrollmentSubmitButtons model={model} />
    </DialogFooter>
  );
}

function EnrollmentBackButton({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, pending, close, setStep } = model;
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        step === "student" ? close() : setStep(step === "contract" ? "pedagogy" : "student")
      }
    >
      {step === "student" ? <X /> : <ArrowLeft />}
      {step === "student" ? "Cancelar" : "Voltar"}
    </Button>
  );
}

function EnrollmentSubmitButtons({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const {
    step,
    visitedContract,
    validateStudent,
    blockedLead,
    setStep,
    existingContract,
    pending,
    requestSave,
    offer,
  } = model;
  return (
    <>
      {step === "student" && visitedContract && (
        <Button
          variant="secondary"
          onClick={() => {
            if (validateStudent() && !blockedLead) setStep("contract");
          }}
        >
          Ir para contrato <ArrowRight />
        </Button>
      )}
      {step === "contract" && !existingContract && (
        <Button variant="secondary" disabled={pending} onClick={() => requestSave(false)}>
          Salvar sem contrato
        </Button>
      )}
      <Button
        type="submit"
        form="intake-enroll"
        loading={pending}
        disabled={blockedLead || (step === "contract" && !existingContract && !offer.data)}
      >
        {step === "contract" ? <Check /> : <ArrowRight />}
        {submitLabel(step)}
      </Button>
    </>
  );
}

function EnrollmentAuxDialogs({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  return (
    <>
      {model.capturingLead && <EnrollmentLeadCapture model={model} />}
      {model.confirmation && <EnrollmentConfirmation model={model} />}
      {model.discarding && (
        <DiscardRegistrationDialog
          onKeep={() => model.setDiscarding(false)}
          onDiscard={() => model.onOpenChange(false)}
        />
      )}
    </>
  );
}

function EnrollmentLeadCapture({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { state, minor, draftLead } = model;
  return (
    <LeadCaptureDialog
      initialName={state.fields.fullName}
      initialEnglishExperience="SOME"
      onClose={() => model.setCapturingLead(false)}
      destination={{
        initial: draftLead,
        identity: {
          fullName: state.fields.fullName,
          birthDate: state.fields.birthDate,
          phone: minor ? state.fields.guardianPhone : state.fields.phone,
          email: minor ? state.fields.guardianEmail : state.fields.email,
          contactName: minor ? state.fields.guardianName : "",
          contactRole: minor ? "GUARDIAN" : "STUDENT",
          contactOwner: minor ? "GUARDIAN" : "STUDENT",
        },
        onConfirm: (registration) => {
          model.setDraftLead(registration);
          model.setDirty(true);
          model.setStageId(
            registration.lead.englishExperience === "SOME" ? null : registration.lead.stageId,
          );
          model.setSelectedId("");
          model.setError("");
        },
      }}
    />
  );
}

function EnrollmentConfirmation({ model }: { model: EnrollmentModel }): ReactJSX.Element | null {
  const { confirmation } = model;
  if (!confirmation) return null;
  return (
    <PendingRegistrationDialog
      entity="aluno"
      pendingItems={confirmation.items}
      pending={model.pending}
      error={model.error || undefined}
      onBack={() => {
        model.setConfirmation(null);
        model.setError("");
      }}
      onConfirm={() => void model.persist(confirmation.input)}
    />
  );
}
