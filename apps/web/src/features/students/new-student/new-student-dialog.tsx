"use client";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { RouterInputs } from "@lazuli/api";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { contractInputFromFields, previewContractInput } from "~/features/contracts/contract-form-model";
import { PendingRegistrationDialog } from "~/features/shared/pending-registration-dialog";
import { fieldErrors, useContractFormState, useContractOffer } from "~/features/contracts/new-contract-state";
import { Alert, Button, Dialog, DialogBackdrop, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPortal, DialogTitle, Field, FieldError, Input, Label, PencilLoader, SearchSelect, Stepper, getScheduleCalendarRange } from "@lazuli/ui";
import { studentIntakeEnrollSchema, studentIntakeResumeSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { InterestChoice } from "~/features/admissions/candidate-fields";
import { IntakeStageSelect } from "~/features/admissions/intake-fields";
import { LeadCaptureDialog } from "~/features/admissions/lead-capture-dialog";
import { dateLabel } from "~/features/admissions/labels";
import { IntakeStudentFields } from "./dados-step";
import { IntakeClasses } from "./intake-classes";
import { IntakeContract } from "./intake-contract";
import { studentContractInput, toContactUpdate, toCreateInput } from "./finance-model";
import { initialNewStudentState, isGuardianSectionOpen, isMinorFromFields, newStudentReducer, validateDados, type NewStudentFields, type NewStudentFieldName } from "./reducer";

export type NewStudentDialogProps = {
  open: boolean;
  initialSemesterId?: string;
  initialCandidateId?: string;
  existingStudentId?: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
};

export function NewStudentDialog(props: NewStudentDialogProps) {
  return props.open ? <EnrollmentDialog {...props} /> : null;
}

function EnrollmentDialog({ initialCandidateId, existingStudentId, onOpenChange, onCreated }: NewStudentDialogProps) {
  const today = toDateOnlySaoPaulo(new Date());
  const [state, dispatch] = useReducer(newStudentReducer, initialNewStudentState);
  const [candidateId, setCandidateId] = useState<string | null>(initialCandidateId ?? null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [format, setFormat] = useState<"IN_PERSON" | "ONLINE">("IN_PERSON");
  const [scheduleType, setScheduleType] = useState<"REGULAR" | "PERSONALIZED">("REGULAR");
  const [selectedId, setSelectedId] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [capturingLead, setCapturingLead] = useState(false);
  const [step, setStep] = useState<"student" | "pedagogy" | "contract">("student");
  const [visitedContract, setVisitedContract] = useState(false);
  const [confirmation, setConfirmation] = useState<{ input: RouterInputs["students"]["enrollNew"] | RouterInputs["students"]["resumeIntake"]; items: string[] } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const contractState = useContractFormState(step === "contract");
  const contract = { ...contractState, change: (...args: Parameters<typeof contractState.change>) => { setDirty(true); contractState.change(...args); } };
  const offer = useContractOffer(step === "contract", contract.setSuggestedMonthlyAmount);
  const [commandId] = useState(() => crypto.randomUUID());
  const busy = useRef(false);
  const prefilled = useRef<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const enroll = trpc.students.enrollNew.useMutation();
  const resume = trpc.students.resumeIntake.useMutation();
  const pending = enroll.isPending || resume.isPending;
  const existing = trpc.students.byId.useQuery({ id: existingStudentId ?? "" }, { enabled: Boolean(existingStudentId), retry: false });
  const existingPending = trpc.students.pendingActions.useQuery({ id: existingStudentId ?? "" }, { enabled: Boolean(existingStudentId), retry: false });
  const existingEnrollment = existingPending.data?.enrollment;
  const existingContract = existingPending.data?.contract;
  useEffect(() => {
    if (!existingStudentId || !existing.data || !existingPending.data || prefilled.current === existingStudentId) return;
    prefilled.current = existingStudentId;
    const { contact, guardian } = existing.data;
    const fields: NewStudentFields = {
      fullName: contact.fullName, phone: contact.phone ?? "", email: contact.email ?? "",
      documentType: contact.documentType ?? "", documentNumber: contact.documentNumber ?? "", birthDate: formatDateOnlyBR(contact.birthDate ?? undefined),
      guardianName: guardian?.fullName ?? "", guardianPhone: guardian?.phone ?? "", guardianEmail: guardian?.email ?? "",
    };
    for (const [field, value] of Object.entries(fields)) dispatch({ type: "fieldChanged", field: field as NewStudentFieldName, value });
    const linked = existingPending.data.lead;
    setCandidateId(linked?.id ?? null); setStageId(linked?.stageId ?? existingPending.data.enrollment?.class.sharedStage?.id ?? null);
    setFormat(existingPending.data.enrollment?.class.format ?? linked?.format ?? "IN_PERSON");
    setScheduleType(existingPending.data.enrollment?.class.scheduleType ?? linked?.scheduleType ?? "REGULAR");
  }, [existingStudentId, existing.data, existingPending.data]);
  const candidate = trpc.admissions.byId.useQuery({ id: candidateId ?? "" }, { enabled: Boolean(candidateId), retry: false });
  const lead = candidate.data?.id === candidateId ? candidate.data : undefined;
  useEffect(() => {
    const timer = setTimeout(() => setSearch(state.fields.fullName.trim()), 250);
    return () => clearTimeout(timer);
  }, [state.fields.fullName]);
  const leads = trpc.admissions.list.useQuery({ search, statuses: ["WAITING"], unlinkedOnly: true, pageSize: 8 }, {
    enabled: !existingStudentId && !candidateId && search.length >= 2, retry: false,
  });
  useEffect(() => {
    if (existingStudentId || !lead || prefilled.current === lead.id) return;
    prefilled.current = lead.id;
    const guardian = lead.contactRole === "GUARDIAN";
    const guardianContact = lead.contactOwner === "GUARDIAN";
    const fields: NewStudentFields = {
      ...initialNewStudentState.fields,
      fullName: lead.fullName,
      birthDate: lead.birthDate ? dateLabel(lead.birthDate) : "",
      phone: guardianContact ? "" : lead.phone ?? "",
      email: guardianContact ? "" : lead.email ?? "",
      guardianName: guardian || guardianContact ? lead.contactName ?? "" : "",
      guardianPhone: guardianContact ? lead.phone ?? "" : "",
      guardianEmail: guardianContact ? lead.email ?? "" : "",
    };
    dispatch({ type: "reset" });
    for (const [field, value] of Object.entries(fields)) dispatch({ type: "fieldChanged", field: field as NewStudentFieldName, value });
    setStageId(lead.stageId);
    setFormat(lead.format ?? "IN_PERSON");
    setScheduleType(lead.scheduleType ?? "REGULAR");
    setSelectedId("");
  }, [lead, existingStudentId]);
  const range = getScheduleCalendarRange({ date, view: "week" });
  const options = trpc.students.intakeOptions.useQuery({
    stageId, format, scheduleType, from: range.from, through: range.through,
  }, { enabled: step !== "student", retry: false });
  const selected = options.data?.classes.find(row => row.id === selectedId);
  const minor = isMinorFromFields(state.fields, today) || lead?.contactRole === "GUARDIAN";
  const blockedLead = !existingStudentId && Boolean(candidateId && (!lead || lead.studentId || lead.status !== "WAITING"));
  const waitingPlacement = lead?.englishExperience === "SOME" && !lead.stageId;
  function clearLead() {
    setDirty(true); setCandidateId(null); prefilled.current = null; setStageId(null); setSelectedId("");
    dispatch({ type: "reset" }); setError("");
  }
  function close() {
    if (busy.current || confirmation || discarding || capturingLead) return;
    if (dirty) setDiscarding(true);
    else onOpenChange(false);
  }
  function validateStudent() {
    const errors = validateDados(state.fields, today);
    if (minor) {
      if (!state.fields.guardianName.trim()) errors.guardianName = "Informe o nome do responsável.";
      if (!state.fields.guardianPhone.trim() && !state.fields.guardianEmail.trim()) errors.guardianPhone = "Informe telefone ou e-mail do responsável.";
    }
    if (Object.keys(errors).length) {
      dispatch({ type: "serverRejected", errors, formError: null });
      requestAnimationFrame(() => popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return false;
    }
    return true;
  }
  function advance(event: FormEvent) {
    event.preventDefault();
    if (!validateStudent() || blockedLead) return;
    setError("");
    if (step === "student") setStep("pedagogy");
    else { setStep("contract"); setVisitedContract(true); }
  }
  async function persist(input: RouterInputs["students"]["enrollNew"] | RouterInputs["students"]["resumeIntake"]) {
    if (busy.current) return;
    busy.current = true; setError("");
    try {
      const result = "studentId" in input ? await resume.mutateAsync(input) : await enroll.mutateAsync(input);
      void Promise.all([utils.students.invalidate(), utils.admissions.invalidate(), utils.enrollment.invalidate(), utils.finance.invalidate()]);
      onCreated(result.studentId);
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível concluir o cadastro. Os dados continuam em rascunho.");
    } finally { busy.current = false; }
  }
  function requestSave(withContract: boolean) {
    if (busy.current || step !== "contract") return;
    if (!validateStudent()) { setStep("student"); return; }
    if (blockedLead) return setError("Confira o vínculo do lead antes de salvar o aluno.");
    if (selectedId && (options.isFetching || !selected)) return setError("Confira a turma na etapa pedagógica antes de salvar.");
    if (selected && (!stageId || waitingPlacement)) return setError("Conclua o nivelamento antes de confirmar a turma.");
    const parsedContract = withContract && !existingContract ? (existingStudentId
      ? contractInputFromFields({ ...contract.fields, studentMode: "existing", studentId: existingStudentId }, contract.commandId.current)
      : studentContractInput({ fields: contract.fields, student: state.fields, commandId: contract.commandId.current })) : null;
    const preview = parsedContract ? previewContractInput(parsedContract, offer.data) : null;
    if (parsedContract && (!parsedContract.success || !preview)) {
      contract.setErrors(fieldErrors(parsedContract, Boolean(preview)));
      requestAnimationFrame(() => contract.popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const items = [
      ...(!selected && !existingEnrollment ? [waitingPlacement ? "Concluir o nivelamento e escolher a turma." : "Definir a turma na etapa pedagógica."] : []),
      ...(!withContract && !existingContract ? ["Concluir o contrato. Os dados do contrato em rascunho não serão salvos."] : []),
    ];
    const shared = { stageId, classId: selected?.id ?? null, contract: parsedContract?.success ? parsedContract.data : null, allowPending: items.length > 0 };
    const parsed = existingStudentId ? studentIntakeResumeSchema.safeParse({
      studentId: existingStudentId, contact: toContactUpdate(state.fields, Boolean(existing.data?.guardian)), ...shared,
    }) : studentIntakeEnrollSchema.safeParse({ commandId, candidateId, student: toCreateInput(state.fields), ...shared });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira os dados do aluno.");
    setError("");
    if (items.length) setConfirmation({ input: parsed.data, items });
    else void persist(parsed.data);
  }
  const nameField = <Field>
    <Label>Nome do aluno</Label>
    {lead || existingStudentId ? <Input name="fullName" value={state.fields.fullName} invalid={Boolean(state.errors.fullName)}
      onChange={event => { setDirty(true); dispatch({ type: "fieldChanged", field: "fullName", value: event.target.value }); }} /> :
    <SearchSelect name="fullName" showSearchIcon openOnFocus placeholder="Digite para buscar leads ou cadastrar um aluno"
      query={state.fields.fullName} value={null}
      options={!candidateId && search.length >= 2 ? (leads.data?.rows ?? []).map(row => ({ id: row.id, label: row.fullName, description: [row.contactName, row.phone, row.email].filter(Boolean).join(" · ") })) : []}
      loading={Boolean(candidateId ? candidate.isFetching : search.length >= 2 && leads.isFetching)}
      failed={candidateId ? candidate.isError : search.length >= 2 && leads.isError}
      onQueryChange={value => { setDirty(true); dispatch({ type: "fieldChanged", field: "fullName", value }); setError(""); }}
      onSelect={row => { setDirty(true); setCandidateId(row.id); setSelectedId(""); setError(""); }} onClear={clearLead}
      invalid={Boolean(state.errors.fullName)} emptyMessage={search.length < 2 ? "Digite o nome do aluno." : "Nenhum lead encontrado. Continue com este nome."} />}
    {state.errors.fullName && <FieldError match>{state.errors.fullName}</FieldError>}
    {lead && !existingStudentId && <div className="flex items-center justify-between gap-2"><p className="text-caption text-muted-foreground">Dados preenchidos a partir do lead.</p>
      <Button variant="ghost" size="sm" onClick={clearLead}>Trocar lead</Button></div>}
  </Field>;
  if (existingStudentId && (!existing.data || !existingPending.data)) return <Dialog open onOpenChange={open => { if (!open) onOpenChange(false); }}><DialogPortal><DialogBackdrop /><DialogContent className="md:max-w-2xl">
    <DialogHeader><DialogTitle>Continuar cadastro</DialogTitle></DialogHeader><DialogBody>
      {existing.error || existingPending.error ? <Alert variant="destructive">{existing.error?.message ?? existingPending.error?.message}<Button variant="secondary" onClick={() => { void existing.refetch(); void existingPending.refetch(); }}>Tentar novamente</Button></Alert> : <PencilLoader label="Carregando cadastro do aluno" />}
    </DialogBody></DialogContent></DialogPortal></Dialog>;
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogPortal><DialogBackdrop />
    <DialogContent className={`w-[calc(100%-2rem)] md:w-[calc(100%-2rem)] ${step === "student" ? "md:max-w-2xl" : "max-w-7xl md:max-w-7xl"} ${step === "pedagogy" ? "h-[min(52rem,calc(100dvh-4rem))]" : ""}`} ref={popup}>
      <DialogHeader><DialogTitle>{existingStudentId ? "Continuar cadastro" : "Novo aluno"}</DialogTitle>
        <DialogDescription>{step === "student" ? existingStudentId ? "Confira os dados do aluno e continue pelas etapas pendentes." : "Busque um lead ou preencha os dados do aluno." : step === "pedagogy" ? existingEnrollment ? "Confira a turma definida para este aluno e continue para o contrato." : `Escolha a turma para ${state.fields.fullName} ou deixe essa definição pendente.` : "Defina o contrato e confirme o cadastro. As alterações serão salvas ao confirmar."}</DialogDescription>
      </DialogHeader>
      <Stepper steps={[{ label: "Aluno" }, { label: "Pedagógico", completed: Boolean(selected || existingEnrollment) }, { label: "Contrato" }]} activeIndex={step === "contract" ? 2 : step === "pedagogy" ? 1 : 0} label="Entrada do aluno" className="my-4" />
        <DialogBody className={step === "pedagogy" ? "flex flex-col overflow-hidden" : undefined}>
          <form id="intake-enroll" className={step === "pedagogy" ? "flex min-h-0 flex-1 flex-col" : undefined} onSubmit={event => { if (step === "contract") { event.preventDefault(); requestSave(true); } else advance(event); }} noValidate>
            {step === "contract" ? existingContract ? <Alert variant="success">O contrato deste aluno já está cadastrado. Confirme para salvar as alterações das outras etapas.</Alert> : <IntakeContract state={contract} student={state.fields} offer={offer} pending={pending} /> :
            <fieldset disabled={pending} className={`min-w-0 ${step === "pedagogy" ? "flex min-h-0 flex-1 flex-col gap-5" : "grid gap-6"}`}>
              {step === "student" ?
              <div className="grid min-w-0 content-start gap-5">
                <IntakeStudentFields fields={state.fields} errors={state.errors} minor={minor}
                  guardianOpen={minor || isGuardianSectionOpen(state, today)} nameField={nameField}
                  onFieldChange={(field, value) => { setDirty(true); dispatch({ type: "fieldChanged", field, value }); setError(""); }}
                  onGuardianToggle={open => { setDirty(true); dispatch({ type: "guardianToggled", open }); }} />
                {lead?.studentId && !existingStudentId && <Alert variant="warning">Este lead já está ligado a um aluno. <Link className="underline" href={`/alunos/${lead.studentId}`}>Abrir cadastro</Link></Alert>}
                {candidate.isError && candidateId && <Alert variant="destructive">{candidate.error.message}<Button variant="ghost" onClick={() => void candidate.refetch()}>Tentar novamente</Button></Alert>}
              </div> : existingEnrollment ? <section className="grid gap-2 rounded-lg border border-border p-5"><h2 className="font-display text-xl font-medium">{existingEnrollment.class.portalClassName}</h2><p className="text-sm">{existingEnrollment.class.format === "ONLINE" ? "Online" : "Presencial"} · {existingEnrollment.class.sharedStage?.name ?? "PPT"}</p><p className="text-caption text-muted-foreground">A turma deste aluno já está definida.</p></section> : <>
              <div className="grid shrink-0 gap-3 border-b border-border pb-4">
                <div className="grid items-start gap-4 sm:grid-cols-[auto_auto_minmax(12rem,1fr)]">
                  <InterestChoice label="Modalidade" value={scheduleType} options={{ REGULAR: "Regular", PERSONALIZED: "PPT" }}
                    onChange={value => { setDirty(true); setScheduleType(value as typeof scheduleType); setSelectedId(""); }} />
                  <InterestChoice label="Formato" value={format} options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
                    onChange={value => { setDirty(true); setFormat(value as typeof format); setSelectedId(""); }} />
                <IntakeStageSelect value={stageId} onChange={value => { setDirty(true); setStageId(value); setSelectedId(""); }}
                  initialOnly={!lead || lead.englishExperience === "NONE"} disabled={lead?.englishExperience === "SOME"} />
                </div>
                <p className="text-caption text-muted-foreground">Regular para o início do semestre; PPT para entrada durante o período.</p>
                {!candidateId && !existingStudentId && <Button variant="ghost" size="sm" onClick={() => setCapturingLead(true)}>Já estudou inglês? Cadastrar lead para nivelamento</Button>}
                {waitingPlacement && <Alert variant="warning">O estágio depende da prova. Você pode seguir para o contrato e resolver o nivelamento depois. <Link className="underline" href={`/interessados/${lead.id}`} target="_blank" rel="noreferrer">Abrir nivelamento em outra aba</Link></Alert>}
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {waitingPlacement ? <p className="rounded-lg border border-dashed border-border p-6 text-caption text-muted-foreground">As turmas ficam disponíveis após a definição do estágio no nivelamento.</p> :
                  stageId ? <IntakeClasses data={options.data} pending={options.isFetching} error={options.error?.message}
                    onRetry={() => void options.refetch()} selectedId={selectedId} onSelect={id => { setDirty(true); setSelectedId(id); }} date={date} onDateChange={setDate} /> :
                    <p className="rounded-lg border border-dashed border-border p-6 text-caption text-muted-foreground">Escolha o estágio para ver as turmas e os horários.</p>}
              </div></>}
            </fieldset>}
            {error && <Alert variant="destructive" className="mt-4">{error}</Alert>}
          </form>
        </DialogBody>
        <DialogFooter className="mt-4 items-center border-t border-border pt-4">
          <Button variant="ghost" disabled={pending} onClick={() => step === "student" ? close() : setStep(step === "contract" ? "pedagogy" : "student")}>
            {step === "student" ? <X /> : <ArrowLeft />}{step === "student" ? "Cancelar" : "Voltar"}
          </Button>
          <p className="mr-auto text-caption text-muted-foreground">{selected ? `Turma: ${selected.name}` : existingEnrollment ? `Turma: ${existingEnrollment.class.portalClassName}` : step !== "student" ? "Turma pendente" : ""}</p>
          {step === "student" && visitedContract && <Button variant="secondary" onClick={() => { if (validateStudent() && !blockedLead) setStep("contract"); }}>Ir para contrato<ArrowRight /></Button>}
          {step === "contract" && !existingContract && <Button variant="secondary" disabled={pending} onClick={() => requestSave(false)}>Salvar sem contrato</Button>}
          <Button type="submit" form="intake-enroll" loading={pending} disabled={blockedLead || (step === "contract" && !existingContract && !offer.data)}>
            {step === "contract" ? <Check /> : <ArrowRight />}{step === "student" ? "Ir para pedagógico" : step === "pedagogy" ? "Ir para contrato" : "Concluir cadastro"}
          </Button>
        </DialogFooter>
    </DialogContent>
    {capturingLead && <LeadCaptureDialog initialName={state.fields.fullName} initialEnglishExperience="SOME" onClose={() => setCapturingLead(false)} onCreated={setCandidateId} />}
    {confirmation && <PendingRegistrationDialog entity="aluno" pendingItems={confirmation.items} pending={pending} error={error || undefined}
      onBack={() => { setConfirmation(null); setError(""); }} onConfirm={() => void persist(confirmation.input)} />}
    {discarding && <DiscardRegistrationDialog onKeep={() => setDiscarding(false)} onDiscard={() => onOpenChange(false)} />}
  </DialogPortal></Dialog>;
}
