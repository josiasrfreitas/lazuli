import { leadStudentFields } from "./new-student-prefill";
import { EnrollmentPhoto } from "~/features/student-documents/enrollment-photo";
import { StudentDocumentPanel, StudentDocumentButton } from "~/features/student-documents/panel";
import documentStyles from "./enrollment-documents.module.css";
import { useEffect, useState, type JSX as ReactJSX } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import {
  ToastAlert,
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
import { IntakeNameField } from "./intake-name-field";
import { AddressStep } from "./address-step";
import { IntakeStudentFields } from "./dados-step";
import { IntakePedagogy, IntakePedagogyControls, type IntakeFilters } from "./intake-pedagogy";
import { IntakeContract } from "./intake-contract";
import { IntakeDialogHeading, IntakeDialogLoading } from "./intake-dialog-chrome";
import type { EnrollmentModel, IntakeStep } from "./new-student-dialog";

const DOCUMENT_PANEL_EXIT_MS = 160;

function previousStep(model: EnrollmentModel): IntakeStep {
  const { step } = model;
  if (step === "contract") return "pedagogy";
  if (step === "pedagogy") {
    if (model.existingStudentId && model.stepCompletion.address && !model.stepCompletion.student)
      return "student";
    return "address";
  }
  return "student";
}

function submitLabel(model: EnrollmentModel): string {
  const { step } = model;
  if (step === "student")
    return model.existingStudentId && model.stepCompletion.address
      ? "Ir para pedagógico"
      : "Ir para endereço";
  if (step === "address") return "Ir para pedagógico";
  if (step === "pedagogy") return "Ir para contrato";
  return "Concluir cadastro";
}

function classSummary(model: EnrollmentModel): string {
  if (model.selected)
    return `${model.entryPeriod === "NEXT" ? "Fila: " : "Turma: "}${model.selected.scheduleType === "PERSONALIZED" ? "PPT" : model.selected.stageName} · ${model.selected.teacherName}`;
  if (model.existingEnrollment) return `Turma: ${model.existingEnrollment.class.portalClassName}`;
  return model.step === "student" || model.step === "address"
    ? ""
    : model.entryPeriod === "NEXT"
      ? "Próximo período · turma pendente"
      : "Neste período · turma pendente";
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
  const reviewing = Boolean(model.confirmation || model.discarding);
  return (
    <>
      {!reviewing && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <DialogPortal>
            <DialogBackdrop />
            <EnrollmentMainContent model={model} />
            {model.capturingLead && <EnrollmentLeadCapture model={model} />}
          </DialogPortal>
        </Dialog>
      )}
      <EnrollmentAuxDialogs model={model} />
    </>
  );
}

function EnrollmentMainContent({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, popup } = model;
  const panelOpen = step === "student" && model.documents.open;
  const [panelPresent, setPanelPresent] = useState(panelOpen);
  useEffect(() => {
    if (panelOpen) {
      setPanelPresent(true);
      return;
    }
    const timer = globalThis.setTimeout(() => setPanelPresent(false), DOCUMENT_PANEL_EXIT_MS);
    return () => globalThis.clearTimeout(timer);
  }, [panelOpen]);
  const panelVisible = step === "student" && (panelOpen || panelPresent);
  return (
    <DialogContent
      className="enrollment-dialog-motion w-[calc(100%-2rem)] md:w-[calc(100%-2rem)] max-w-7xl md:max-w-7xl data-[step=address]:md:max-w-4xl data-[step=student]:data-[documents=false]:md:max-w-4xl data-[documents=true]:md:max-w-7xl data-[step=pedagogy]:h-[min(54rem,calc(100dvh-2rem))] data-[step=pedagogy]:max-h-[calc(100dvh-2rem)] data-[step=pedagogy]:pb-3 data-[step=contract]:md:max-w-6xl data-[step=contract]:h-[min(48rem,calc(100dvh-4rem))]"
      data-step={step}
      data-documents={panelVisible}
      ref={popup}
      initialFocus={() =>
        popup.current?.querySelector<HTMLInputElement>('input[name="fullName"]') ?? true
      }
    >
      <EnrollmentDialogHeader model={model} />
      {step === "contract" && !model.existingContract ? (
        <div key={step} className={`${documentStyles.stepTransition} flex min-h-0 flex-1 flex-col`}>
          <EnrollmentContractFields model={model} />
        </div>
      ) : (
        <>
          <div className={documentStyles.documentLayout} data-open={panelVisible}>
            <EnrollmentForm model={model} />
            {panelVisible && <StudentDocumentPanel documents={model.documents} />}
          </div>
          <EnrollmentFooter model={model} />
        </>
      )}
    </DialogContent>
  );
}

function EnrollmentDialogHeader({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, existingStudentId, existingEnrollment, selected } = model;
  return (
    <div className={documentStyles.header}>
      <IntakeDialogHeading
        compact={step === "student"}
        onStepChange={(next) => {
          if (!model.pending && !(next === "contract" && model.existingContract)) {
            model.setStep(next);
            model.setError("");
            if (next === "contract") model.setVisitedContract(true);
          }
        }}
        avatar={
          step === "student" ? (
            <EnrollmentPhoto
              documents={model.documents}
              studentId={existingStudentId}
              disabled={model.pending}
            />
          ) : undefined
        }
        continuing={Boolean(existingStudentId)}
        step={step}
        hasClass={Boolean(selected || existingEnrollment)}
        hasStudent={model.stepCompletion.student}
        hasAddress={model.stepCompletion.address}
        hasContract={Boolean(model.existingContract)}
        pedagogyControls={
          step === "pedagogy" && !existingEnrollment ? (
            <fieldset disabled={model.pending} className="min-w-0">
              <IntakePedagogyControls
                filters={pedagogyFilters(model)}
                onFiltersChange={(filters) => updatePedagogyFilters(model, filters)}
                lead={model.lead}
                draftRegistration={model.draftLead}
                teacherSelection={model.teacherSelection}
                teacherChoices={model.options.data?.classes ?? []}
                onTeacherChange={(teacher) => {
                  model.setDirty(true);
                  model.setTeacherSelection(teacher);
                  model.setSelectedId("");
                }}
                onCaptureLead={
                  !model.candidateId && !existingStudentId
                    ? () => model.setCapturingLead(true)
                    : undefined
                }
              />
            </fieldset>
          ) : undefined
        }
      />
    </div>
  );
}

function EnrollmentForm({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, requestSave, advance, error } = model;
  return (
    <DialogBody
      key={step}
      data-step={step}
      data-intake-body
      className="data-[step=contract]:flex data-[step=contract]:flex-col lg:data-[step=contract]:overflow-hidden data-[step=pedagogy]:flex data-[step=pedagogy]:flex-col data-[step=pedagogy]:overflow-y-auto sm:data-[step=pedagogy]:overflow-hidden"
    >
      <form
        id="intake-enroll"
        className={
          step === "pedagogy" || step === "contract" ? "flex min-h-0 flex-1 flex-col" : undefined
        }
        onSubmit={(event) => {
          if (step === "contract" || (step === "pedagogy" && model.existingContract)) {
            event.preventDefault();
            requestSave(!model.existingContract);
          } else advance(event);
        }}
        noValidate
      >
        {step === "contract" ? (
          <EnrollmentContractFields model={model} />
        ) : (
          <EnrollmentProgressFields model={model} />
        )}
        {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
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
      existingStudentId={model.existingStudentId}
      offer={model.offer}
      pending={model.pending}
      error={model.error}
      suggestedStageId={model.stageId}
      onComplete={() => model.requestSave(true)}
      onBack={() => model.setStep("pedagogy")}
      onSaveWithout={() => model.requestSave(false)}
    />
  );
}

function EnrollmentProgressFields({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  return (
    <fieldset
      disabled={model.pending}
      className={`min-w-0 ${model.step === "pedagogy" ? "flex min-h-0 flex-1 flex-col gap-4" : "grid gap-6"}`}
    >
      {progressStepFields(model)}
    </fieldset>
  );
}

function progressStepFields(model: EnrollmentModel): ReactJSX.Element {
  if (model.step === "student") return <EnrollmentStudentFields model={model} />;
  if (model.step === "pedagogy") return <EnrollmentPedagogyFields model={model} />;
  return (
    <AddressStep
      onBusyChange={model.setAddressPending}
      value={model.state.fields.address}
      onChange={(address) => {
        model.setDirty(true);
        model.dispatch({ type: "addressChanged", address });
      }}
    />
  );
}

function EnrollmentStudentFields({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const {
    state,
    minor,
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
        selectedFields={lead && !existingStudentId ? leadStudentFields(lead) : {}}
        documents={model.documents}
        studentId={existingStudentId}
        fields={state.fields}
        errors={state.errors}
        minor={minor}
        nameField={<EnrollmentNameField model={model} />}
        onFieldChange={(field, value) => {
          setDirty(true);
          dispatch({ type: "fieldChanged", field, value });
          setError("");
        }}
      />
      {lead?.studentId && !existingStudentId && (
        <ToastAlert variant="warning">
          Este lead já está ligado a um aluno.{" "}
          <Link className="underline" href={`/alunos/${lead.studentId}`}>
            Abrir cadastro
          </Link>
        </ToastAlert>
      )}
      {candidate.isError && candidateId && (
        <ToastAlert variant="destructive">
          {candidate.error.message}
          <Button variant="ghost" onClick={() => void candidate.refetch()}>
            Tentar novamente
          </Button>
        </ToastAlert>
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
      action={<StudentDocumentButton documents={model.documents} />}
      name={state.fields.fullName}
      error={state.errors.fullName}
      linked={Boolean(lead || existingStudentId || draftLead)}
      fromLead={Boolean(lead && !existingStudentId)}
      options={leadNameOptions(model)}
      loading={lookup.loading}
      failed={lookup.failed}
      emptyMessage={search.length < 2 ? "Digite o nome do aluno." : ""}
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
      filters={pedagogyFilters(model)}
      lead={lead}
      draftRegistration={draftLead}
      enrollment={existingEnrollment}
      onCaptureLead={
        !candidateId && !existingStudentId ? () => model.setCapturingLead(true) : undefined
      }
      classes={{
        entryPeriod: model.entryPeriod,
        teacherId: model.teacherSelection?.id ?? null,
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

function pedagogyFilters(model: EnrollmentModel): IntakeFilters {
  return {
    stageId: model.stageId,
    format: model.format,
    scheduleType: model.scheduleType,
    entryPeriod: model.entryPeriod,
  };
}

function updatePedagogyFilters(model: EnrollmentModel, filters: IntakeFilters): void {
  model.setDirty(true);
  model.setTeacherSelection(null);
  model.setStageId(filters.stageId);
  model.setFormat(filters.format);
  model.setScheduleType(filters.scheduleType);
  model.setEntryPeriod(filters.entryPeriod);
  model.setSelectedId("");
}

function EnrollmentFooter({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  return (
    <DialogFooter
      className="max-sm:data-[step=address]:grid max-sm:data-[step=address]:grid-cols-[auto_1fr] max-sm:data-[step=address]:[&>button:last-child]:justify-self-end mt-4 items-center border-t border-border pt-4 data-[step=pedagogy]:mt-3 data-[step=pedagogy]:border-t-0 data-[step=pedagogy]:pt-1 max-sm:data-[step=pedagogy]:grid max-sm:data-[step=pedagogy]:grid-cols-[auto_minmax(0,1fr)] max-sm:data-[step=pedagogy]:gap-x-2 max-sm:data-[step=pedagogy]:gap-y-2 max-sm:data-[step=pedagogy]:[&>p]:col-span-2 max-sm:data-[step=pedagogy]:[&>p]:row-start-1 max-sm:data-[step=pedagogy]:[&>button]:row-start-2 max-sm:data-[step=pedagogy]:[&>button:last-child]:justify-self-end"
      data-step={model.step}
    >
      <EnrollmentBackButton model={model} />
      {footerInfo(model)}
      <EnrollmentSubmitButtons model={model} />
    </DialogFooter>
  );
}

function footerInfo(model: EnrollmentModel): ReactJSX.Element {
  if (model.step === "student")
    return (
      <div className={documentStyles.documentHelp}>
        <span role={model.documents.query.isError ? "status" : undefined}>
          {documentHelpText(model)}
        </span>
      </div>
    );
  if (model.step === "address") return <span className="mr-auto max-sm:hidden" />;
  return <p className="mr-auto text-caption text-muted-foreground">{classSummary(model)}</p>;
}

function documentHelpText(model: EnrollmentModel): string {
  if (model.documents.selection?.file)
    return "Envie ou descarte o anexo selecionado antes de continuar.";
  if (model.documents.query.isError)
    return "Não foi possível atualizar os anexos. Tentando novamente…";
  return "RG/CIN preenche os dados. Revise antes de salvar.";
}

function submitDisabled(model: EnrollmentModel): boolean {
  return Boolean(model.documents.selection?.file);
}

function EnrollmentBackButton({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, pending, close, setStep } = model;
  return (
    <Button
      variant="ghost"
      size={step === "pedagogy" ? "sm" : "md"}
      disabled={pending}
      onClick={() => {
        if (step === "student") close();
        else setStep(previousStep(model));
      }}
    >
      {step === "student" ? <X /> : <ArrowLeft />}
      {step === "student" ? "Cancelar" : "Voltar"}
    </Button>
  );
}

function EnrollmentSubmitButtons({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, existingContract, pending } = model;
  return (
    <>
      <EnrollmentSecondarySubmitButtons model={model} />
      <Button
        type="submit"
        form="intake-enroll"
        size={step === "pedagogy" ? "sm" : "md"}
        loading={pending}
        disabled={submitDisabled(model)}
      >
        {submitCompletes(step, existingContract) ? <Check /> : <ArrowRight />}
        {step === "pedagogy" && existingContract ? "Concluir cadastro" : submitLabel(model)}
      </Button>
    </>
  );
}

function submitCompletes(
  step: IntakeStep,
  existingContract: EnrollmentModel["existingContract"],
): boolean {
  return step === "contract" || (step === "pedagogy" && Boolean(existingContract));
}

function EnrollmentSecondarySubmitButtons({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  const { step, visitedContract, setStep, existingContract, pending, requestSave } = model;
  return (
    <>
      {step === "student" && visitedContract && !existingContract && (
        <Button
          variant="secondary"
          disabled={pending || Boolean(model.documents.selection?.file)}
          onClick={() => setStep("contract")}
        >
          Ir para contrato <ArrowRight />
        </Button>
      )}
      {step === "contract" && !existingContract && (
        <Button variant="secondary" disabled={pending} onClick={() => requestSave(false)}>
          Salvar sem contrato
        </Button>
      )}
    </>
  );
}

function EnrollmentAuxDialogs({ model }: { model: EnrollmentModel }): ReactJSX.Element {
  return (
    <>
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

function conciseBlockingLabel(item: { field?: string | undefined; label: string }): string {
  const labels: Record<string, string> = {
    fullName: "Nome do aluno",
    birthDate: "Data de nascimento",
    documentNumber: "CPF ou RG do aluno",
    documentType: "Tipo de documento do aluno",
    phone: "Telefone ou e-mail do aluno",
    guardianName: "Nome do responsável",
    guardianDocumentNumber: "CPF ou RG do responsável",
    guardianDocumentType: "Tipo de documento do responsável",
    guardianPhone: "Telefone ou e-mail do responsável",
  };
  if (item.field === "birthDate" && item.label.includes("inválida"))
    return "Nascimento · confira a data";
  return (item.field && labels[item.field]) || item.label;
}

function EnrollmentConfirmation({ model }: { model: EnrollmentModel }): ReactJSX.Element | null {
  const { confirmation } = model;
  if (!confirmation) return null;
  return (
    <PendingRegistrationDialog
      entity="aluno"
      pendingItems={confirmation.items.map((item) => {
        if (item.kind === "documents") return item.label;
        if (item.kind === "contract") return "Contrato · rascunho não será salvo";
        if (item.label.startsWith("Concluir o nivelamento")) return "Nivelamento e turma";
        return model.entryPeriod === "NEXT" ? "Turma do próximo período" : "Turma deste período";
      })}
      onReviewPending={(index) => {
        const kind = confirmation.items[index]?.kind;
        const step = kind === "documents" ? "student" : kind === "class" ? "pedagogy" : "contract";
        model.setConfirmation(null);
        model.setError("");
        model.setStep(step);
        if (step === "contract") model.setVisitedContract(true);
      }}
      blockingItems={confirmation.blocking.map((item) => ({
        label: conciseBlockingLabel(item),
        onResolve: () => {
          model.setConfirmation(null);
          model.setStep(item.step);
          if (item.step === "student") model.validateStudent();
          if (item.field)
            requestAnimationFrame(() =>
              model.popup.current?.querySelector<HTMLElement>(`[name="${item.field}"]`)?.focus(),
            );
        },
      }))}
      pending={model.pending}
      error={model.error || undefined}
      onBack={() => {
        model.setConfirmation(null);
        model.setError("");
      }}
      onConfirm={() => {
        if (confirmation.input) void model.persist(confirmation.input);
      }}
      onDiscard={() => model.onOpenChange(false)}
    />
  );
}
