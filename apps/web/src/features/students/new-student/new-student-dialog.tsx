"use client";
import type { JSX as ReactJSX } from "react";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { RouterInputs } from "@lazuli/api";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import {
  contractInputFromFields,
  previewContractInput,
} from "~/features/contracts/contract-form-model";
import { PendingRegistrationDialog } from "~/features/shared/pending-registration-dialog";
import {
  fieldErrors,
  useContractFormState,
  useContractOffer,
} from "~/features/contracts/new-contract-state";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogPortal,
  getScheduleCalendarRange,
} from "@lazuli/ui";
import { studentIntakeEnrollSchema, studentIntakeResumeSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import {
  LeadCaptureDialog,
  type LeadRegistration,
} from "~/features/admissions/lead-capture-dialog";
import { dateLabel } from "~/features/admissions/labels";
import { IntakeNameField } from "./intake-name-field";
import { IntakeStudentFields } from "./dados-step";
import { IntakePedagogy } from "./intake-pedagogy";
import { IntakeContract } from "./intake-contract";
import { studentContractInput, toContactUpdate, toCreateInput } from "./finance-model";
import {
  initialNewStudentState,
  isGuardianSectionOpen,
  isMinorFromFields,
  newStudentReducer,
  validateDados,
  type NewStudentFields,
  type NewStudentFieldName,
} from "./reducer";
import styles from "./intake-schedule.module.css";
import {
  IntakeDialogHeading,
  IntakeDialogLoading,
  studentDialogClassName,
} from "./intake-dialog-chrome";

const DUPLICATE_SEARCH_DEBOUNCE_MS = 250;

export type NewStudentDialogProps = {
  open: boolean;
  initialSemesterId?: string;
  initialCandidateId?: string;
  existingStudentId?: string | undefined;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
};

export function NewStudentDialog(props: NewStudentDialogProps): ReactJSX.Element | null {
  return props.open ? <EnrollmentDialog {...props} /> : null;
}

function EnrollmentDialog({
  initialCandidateId,
  existingStudentId,
  onOpenChange,
  onCreated,
}: NewStudentDialogProps): ReactJSX.Element {
  const today = toDateOnlySaoPaulo(new Date());
  const [state, dispatch] = useReducer(newStudentReducer, initialNewStudentState);
  const [candidateId, setCandidateId] = useState<string | null>(initialCandidateId ?? null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [format, setFormat] = useState<"IN_PERSON" | "ONLINE">("IN_PERSON");
  const [scheduleType, setScheduleType] = useState<"REGULAR" | "PERSONALIZED">("REGULAR");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [draftLead, setDraftLead] = useState<LeadRegistration | null>(null);
  const [capturingLead, setCapturingLead] = useState(false);
  const [step, setStep] = useState<"student" | "pedagogy" | "contract">("student");
  const [visitedContract, setVisitedContract] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    input: RouterInputs["students"]["enrollNew"] | RouterInputs["students"]["resumeIntake"];
    items: string[];
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const contractState = useContractFormState(step === "contract");
  const contract = {
    ...contractState,
    change: (...args: Parameters<typeof contractState.change>) => {
      setDirty(true);
      contractState.change(...args);
    },
  };
  const offer = useContractOffer(step === "contract", contract.setSuggestedMonthlyAmount);
  const [commandId] = useState(() => crypto.randomUUID());
  const busy = useRef(false);
  const prefilled = useRef<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const enroll = trpc.students.enrollNew.useMutation();
  const resume = trpc.students.resumeIntake.useMutation();
  const pending = enroll.isPending || resume.isPending;
  const existing = trpc.students.byId.useQuery(
    { id: existingStudentId ?? "" },
    { enabled: Boolean(existingStudentId), retry: false },
  );
  const existingPending = trpc.students.pendingActions.useQuery(
    { id: existingStudentId ?? "" },
    { enabled: Boolean(existingStudentId), retry: false },
  );
  const existingEnrollment = existingPending.data?.enrollment;
  const existingContract = existingPending.data?.contract;
  useEffect(() => {
    if (
      !existingStudentId ||
      !existing.data ||
      !existingPending.data ||
      prefilled.current === existingStudentId
    )
      return;
    prefilled.current = existingStudentId;
    const { contact, guardian } = existing.data;
    const fields: NewStudentFields = {
      fullName: contact.fullName,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      documentType: contact.documentType ?? "",
      documentNumber: contact.documentNumber ?? "",
      birthDate: formatDateOnlyBR(contact.birthDate ?? undefined),
      guardianName: guardian?.fullName ?? "",
      guardianPhone: guardian?.phone ?? "",
      guardianEmail: guardian?.email ?? "",
    };
    for (const [field, value] of Object.entries(fields))
      dispatch({ type: "fieldChanged", field: field as NewStudentFieldName, value });
    const linked = existingPending.data.lead;
    setCandidateId(linked?.id ?? null);
    setStageId(linked?.stageId ?? existingPending.data.enrollment?.class.sharedStage?.id ?? null);
    setFormat(existingPending.data.enrollment?.class.format ?? linked?.format ?? "IN_PERSON");
    setScheduleType(
      existingPending.data.enrollment?.class.scheduleType ?? linked?.scheduleType ?? "REGULAR",
    );
  }, [existingStudentId, existing.data, existingPending.data]);
  const candidate = trpc.admissions.byId.useQuery(
    { id: candidateId ?? "" },
    { enabled: Boolean(candidateId), retry: false },
  );
  const lead = candidate.data?.id === candidateId ? candidate.data : undefined;
  useEffect(() => {
    const timer = setTimeout(
      () => setSearch(state.fields.fullName.trim()),
      DUPLICATE_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [state.fields.fullName]);
  const leads = trpc.admissions.list.useQuery(
    { search, statuses: ["WAITING"], unlinkedOnly: true, pageSize: 8 },
    {
      enabled: !existingStudentId && !candidateId && !draftLead && search.length >= 2,
      retry: false,
    },
  );
  useEffect(() => {
    if (existingStudentId || !lead || prefilled.current === lead.id) return;
    prefilled.current = lead.id;
    const guardian = lead.contactRole === "GUARDIAN";
    const guardianContact = lead.contactOwner === "GUARDIAN";
    const fields: NewStudentFields = {
      ...initialNewStudentState.fields,
      fullName: lead.fullName,
      birthDate: lead.birthDate ? dateLabel(lead.birthDate) : "",
      phone: guardianContact ? "" : (lead.phone ?? ""),
      email: guardianContact ? "" : (lead.email ?? ""),
      guardianName: guardian || guardianContact ? (lead.contactName ?? "") : "",
      guardianPhone: guardianContact ? (lead.phone ?? "") : "",
      guardianEmail: guardianContact ? (lead.email ?? "") : "",
    };
    dispatch({ type: "reset" });
    for (const [field, value] of Object.entries(fields))
      dispatch({ type: "fieldChanged", field: field as NewStudentFieldName, value });
    setStageId(lead.stageId);
    setFormat(lead.format ?? "IN_PERSON");
    setScheduleType(lead.scheduleType ?? "REGULAR");
    setSelectedId(lead.allocationPlan?.classId ?? "");
  }, [lead, existingStudentId]);
  const range = getScheduleCalendarRange({ date: today, view: "week" });
  const options = trpc.students.intakeOptions.useQuery(
    {
      stageId,
      format,
      scheduleType,
      from: range.from,
      through: range.through,
    },
    { enabled: step !== "student", retry: false },
  );
  const selected = options.data?.classes.find((row) => row.id === selectedId);
  const minor =
    isMinorFromFields(state.fields, today) ||
    lead?.contactRole === "GUARDIAN" ||
    draftLead?.lead.contactRole === "GUARDIAN";
  const blockedLead =
    !existingStudentId &&
    Boolean(candidateId && (!lead || lead.studentId || lead.status !== "WAITING"));
  const waitingPlacement =
    draftLead?.lead.englishExperience === "SOME" ||
    (lead?.englishExperience === "SOME" && !lead.stageId);
  function clearLead(): void {
    setDirty(true);
    setCandidateId(null);
    setDraftLead(null);
    prefilled.current = null;
    setStageId(null);
    setSelectedId("");
    dispatch({ type: "reset" });
    setError("");
  }
  function close(): void {
    if (busy.current || confirmation || discarding || capturingLead) return;
    if (dirty) setDiscarding(true);
    else onOpenChange(false);
  }
  function validateStudent(): boolean {
    const errors = validateDados(state.fields, today);
    if (minor) {
      if (!state.fields.guardianName.trim()) errors.guardianName = "Informe o nome do responsável.";
      if (!state.fields.guardianPhone.trim() && !state.fields.guardianEmail.trim())
        errors.guardianPhone = "Informe telefone ou e-mail do responsável.";
    }
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "serverRejected", errors, formError: null });
      requestAnimationFrame(() =>
        popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return false;
    }
    return true;
  }
  function advance(event: FormEvent): void {
    event.preventDefault();
    if (!validateStudent() || blockedLead) return;
    setError("");
    if (step === "student") setStep("pedagogy");
    else {
      setStep("contract");
      setVisitedContract(true);
    }
  }
  async function persist(
    input: RouterInputs["students"]["enrollNew"] | RouterInputs["students"]["resumeIntake"],
  ): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setError("");
    try {
      const result =
        "studentId" in input ? await resume.mutateAsync(input) : await enroll.mutateAsync(input);
      void Promise.all([
        utils.students.invalidate(),
        utils.admissions.invalidate(),
        utils.enrollment.invalidate(),
        utils.finance.invalidate(),
        utils.semesterOrganization.invalidate(),
      ]);
      onCreated(result.studentId);
      onOpenChange(false);
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "Não foi possível concluir o cadastro. Os dados continuam em rascunho.",
      );
    } finally {
      busy.current = false;
    }
  }
  function requestSave(withContract: boolean): void {
    if (busy.current || step !== "contract") return;
    if (!validateStudent()) {
      setStep("student");
      return;
    }
    if (blockedLead) return setError("Confira o vínculo do lead antes de salvar o aluno.");
    if (selectedId && (options.isFetching || !selected))
      return setError("Confira a turma na etapa pedagógica antes de salvar.");
    if (selected && (!stageId || waitingPlacement))
      return setError("Conclua o nivelamento antes de confirmar a turma.");
    const parsedContract =
      withContract && !existingContract
        ? existingStudentId
          ? contractInputFromFields(
              { ...contract.fields, studentMode: "existing", studentId: existingStudentId },
              contract.commandId.current,
            )
          : studentContractInput({
              fields: contract.fields,
              student: state.fields,
              commandId: contract.commandId.current,
            })
        : null;
    const preview = parsedContract ? previewContractInput(parsedContract, offer.data) : null;
    if (parsedContract && (!parsedContract.success || !preview)) {
      contract.setErrors(fieldErrors(parsedContract, Boolean(preview)));
      requestAnimationFrame(() =>
        contract.popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    const items = [
      ...(!selected && !existingEnrollment
        ? [
            waitingPlacement
              ? "Concluir o nivelamento e escolher a turma."
              : "Definir a turma na etapa pedagógica.",
          ]
        : []),
      ...(!withContract && !existingContract
        ? ["Concluir o contrato. Os dados do contrato em rascunho não serão salvos."]
        : []),
    ];
    const shared = {
      stageId,
      classId: selected?.id ?? null,
      contract: parsedContract?.success ? parsedContract.data : null,
      allowPending: items.length > 0,
    };
    const parsed = existingStudentId
      ? studentIntakeResumeSchema.safeParse({
          studentId: existingStudentId,
          contact: toContactUpdate(state.fields, Boolean(existing.data?.guardian)),
          ...shared,
        })
      : studentIntakeEnrollSchema.safeParse({
          commandId,
          candidateId,
          leadRegistration: draftLead,
          student: toCreateInput(state.fields),
          ...shared,
        });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? "Confira os dados do aluno.");
    setError("");
    if (items.length > 0) setConfirmation({ input: parsed.data, items });
    else void persist(parsed.data);
  }
  const nameField = (
    <IntakeNameField
      name={state.fields.fullName}
      error={state.errors.fullName}
      linked={Boolean(lead || existingStudentId || draftLead)}
      fromLead={Boolean(lead && !existingStudentId)}
      options={
        !candidateId && !draftLead && search.length >= 2
          ? (leads.data?.rows ?? []).map((row) => ({
              id: row.id,
              label: row.fullName,
              description: [row.contactName, row.phone, row.email].filter(Boolean).join(" · "),
            }))
          : []
      }
      loading={Boolean(
        candidateId ? candidate.isFetching : !draftLead && search.length >= 2 && leads.isFetching,
      )}
      failed={candidateId ? candidate.isError : !draftLead && search.length >= 2 && leads.isError}
      emptyMessage={
        search.length < 2
          ? "Digite o nome do aluno."
          : "Nenhum lead encontrado. Continue com este nome."
      }
      onChange={(value) => {
        setDirty(true);
        dispatch({ type: "fieldChanged", field: "fullName", value });
        setError("");
      }}
      onSelect={(id) => {
        setDirty(true);
        setDraftLead(null);
        setCandidateId(id);
        setSelectedId("");
        setError("");
      }}
      onClear={clearLead}
    />
  );
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
        <DialogContent
          className={
            step === "student"
              ? studentDialogClassName
              : `w-[calc(100%-2rem)] md:w-[calc(100%-2rem)] max-w-7xl md:max-w-7xl ${step === "pedagogy" ? styles.wideDialog : ""}`
          }
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
                existingContract ? (
                  <Alert variant="success">
                    O contrato deste aluno já está cadastrado. Confirme para salvar as alterações
                    das outras etapas.
                  </Alert>
                ) : (
                  <IntakeContract
                    state={contract}
                    student={state.fields}
                    offer={offer}
                    pending={pending}
                  />
                )
              ) : (
                <fieldset
                  disabled={pending}
                  className={`min-w-0 ${step === "pedagogy" ? "flex min-h-0 flex-1 flex-col gap-4" : "grid gap-6"}`}
                >
                  {step === "student" ? (
                    <div className="grid min-w-0 content-start gap-5">
                      <IntakeStudentFields
                        fields={state.fields}
                        errors={state.errors}
                        minor={minor}
                        guardianOpen={minor || isGuardianSectionOpen(state, today)}
                        nameField={nameField}
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
                  ) : (
                    <IntakePedagogy
                      filters={{ stageId, format, scheduleType }}
                      onFiltersChange={(filters) => {
                        setDirty(true);
                        setStageId(filters.stageId);
                        setFormat(filters.format);
                        setScheduleType(filters.scheduleType);
                        setSelectedId("");
                      }}
                      lead={lead}
                      draftRegistration={draftLead}
                      enrollment={existingEnrollment}
                      onCaptureLead={
                        !candidateId && !existingStudentId
                          ? () => setCapturingLead(true)
                          : undefined
                      }
                      classes={{
                        data: options.data,
                        pending: options.isFetching,
                        error: options.error?.message,
                        onRetry: () => void options.refetch(),
                        selectedId,
                        onSelect: (id) => {
                          setDirty(true);
                          setSelectedId(id);
                        },
                      }}
                    />
                  )}
                </fieldset>
              )}
              {error && (
                <Alert variant="destructive" className="mt-4">
                  {error}
                </Alert>
              )}
            </form>
          </DialogBody>
          <DialogFooter
            className={`mt-4 items-center border-t border-border pt-4 ${step === "pedagogy" ? styles.pedagogyFooter : ""}`}
          >
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
            <p className="mr-auto text-caption text-muted-foreground">
              {selected
                ? `Turma: ${selected.name}`
                : existingEnrollment
                  ? `Turma: ${existingEnrollment.class.portalClassName}`
                  : step === "student"
                    ? ""
                    : "Turma pendente"}
            </p>
            {step === "student" && visitedContract && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (validateStudent() && !blockedLead) setStep("contract");
                }}
              >
                Ir para contrato
                <ArrowRight />
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
              {step === "student"
                ? "Ir para pedagógico"
                : step === "pedagogy"
                  ? "Ir para contrato"
                  : "Concluir cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
        {capturingLead && (
          <LeadCaptureDialog
            initialName={state.fields.fullName}
            initialEnglishExperience="SOME"
            onClose={() => setCapturingLead(false)}
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
                setDraftLead(registration);
                setDirty(true);
                setStageId(
                  registration.lead.englishExperience === "SOME" ? null : registration.lead.stageId,
                );
                setSelectedId("");
                setError("");
              },
            }}
          />
        )}
        {confirmation && (
          <PendingRegistrationDialog
            entity="aluno"
            pendingItems={confirmation.items}
            pending={pending}
            error={error || undefined}
            onBack={() => {
              setConfirmation(null);
              setError("");
            }}
            onConfirm={() => void persist(confirmation.input)}
          />
        )}
        {discarding && (
          <DiscardRegistrationDialog
            onKeep={() => setDiscarding(false)}
            onDiscard={() => onOpenChange(false)}
          />
        )}
      </DialogPortal>
    </Dialog>
  );
}
