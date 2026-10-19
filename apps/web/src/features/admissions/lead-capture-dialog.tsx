"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Save, UserRoundPlus } from "lucide-react";
import { FormRow, FormSection, Stepper } from "@lazuli/ui";
import { leadCaptureSchema, type placementScheduleSchema, type z } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { maskDateBR, maskPhoneBR, parseDateBR } from "~/lib/masks";
import { TextControl } from "~/features/classes/form-controls";
import { LeadFormDialog, useLeadErrors } from "./lead-form";
import { InterestChoice } from "./candidate-fields";
import { IntakeStageSelect } from "./intake-fields";
import { dateLabel, leadInterestLabels, type Candidate } from "./labels";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { PendingRegistrationDialog } from "~/features/shared/pending-registration-dialog";
import { PlacementSchedule, type PlacementScheduleDraft } from "./placement-schedule";

type Draft = Omit<z.infer<typeof leadCaptureSchema>, "id" | "birthDate"> & { birthDate: string };

export function LeadCaptureDialog({
  candidate,
  onClose,
  initialName = "",
  initialEnglishExperience = "NONE",
  onCreated,
}: {
  candidate?: Candidate;
  onClose: () => void;
  initialName?: string;
  initialEnglishExperience?: "NONE" | "SOME";
  onCreated?: (id: string) => void;
}) {
  const [id] = useState(() => candidate?.id ?? crypto.randomUUID());
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [placementDraft, setPlacementDraft] = useState<PlacementScheduleDraft | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => ({
    fullName: candidate?.fullName ?? initialName,
    phone: candidate?.phone ?? "",
    email: candidate?.email ?? "",
    contactName: candidate?.contactName ?? "",
    source: candidate?.source ?? "",
    contactRole: candidate?.contactRole === "GUARDIAN" ? "GUARDIAN" : "STUDENT",
    contactOwner: candidate?.contactOwner === "GUARDIAN" ? "GUARDIAN" : "STUDENT",
    birthDate: candidate?.birthDate ? dateLabel(candidate.birthDate) : "",
    englishExperience:
      candidate?.englishExperience === "SOME"
        ? "SOME"
        : candidate?.englishExperience === "UNKNOWN"
          ? "UNKNOWN"
          : initialEnglishExperience,
    stageId: candidate?.stageId ?? null,
    interest: candidate?.interest ?? "UNKNOWN",
    format: candidate?.format ?? null,
    scheduleType: candidate?.scheduleType ?? null,
  }));
  const errors = useLeadErrors();
  const utils = trpc.useUtils();
  const router = useRouter();
  async function saved(result: { id: string }) {
    await utils.admissions.invalidate();
    finish(result.id);
  }
  function finish(savedId: string) {
    onClose();
    if (onCreated) onCreated(savedId);
    else if (!candidate) router.push(`/interessados/${savedId}`);
  }
  const capture = trpc.admissions.capture.useMutation({ onSuccess: saved });
  const update = trpc.admissions.details.useMutation({ onSuccess: saved });
  const save = candidate ? update : capture;
  function requestClose() {
    if (save.isPending || confirmPending || discarding) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
    errors.clear(key);
    save.reset();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const birthDate = draft.birthDate ? parseDateBR(draft.birthDate) : null;
    if (draft.birthDate && !birthDate) {
      return errors.report([
        { path: ["birthDate"], message: "Informe uma data válida: dd/mm/aaaa." },
      ]);
    }
    const parsed = leadCaptureSchema.safeParse({ id, ...draft, birthDate });
    if (!parsed.success) return errors.report(parsed.error.issues);
    if (candidate) update.mutate(parsed.data);
    else if (draft.englishExperience === "SOME") setScheduling(true);
    else capture.mutate({ lead: parsed.data, placement: null, allowPending: false });
  }
  function complete(placement: z.infer<typeof placementScheduleSchema> | null) {
    const lead = leadCaptureSchema.parse({
      id,
      ...draft,
      birthDate: draft.birthDate ? parseDateBR(draft.birthDate) : null,
    });
    capture.mutate({ lead, placement, allowPending: !placement });
  }
  if (scheduling)
    return (
      <>
        <PlacementSchedule
          candidate={{
            id,
            fullName: draft.fullName,
            today: toDateOnlySaoPaulo(new Date()),
            format: draft.format,
          }}
          onClose={requestClose}
          registration={{
            onConfirm: complete,
            onBack: () => setScheduling(false),
            onDefer: () => setConfirmPending(true),
            draft: placementDraft,
            onDraftChange: setPlacementDraft,
            onDirty: () => setDirty(true),
            pending: capture.isPending,
            error: capture.error?.message,
          }}
        />
        {confirmPending && (
          <PendingRegistrationDialog
            entity="lead"
            pendingItems={["Agendar a prova de nivelamento e definir o estágio."]}
            pending={capture.isPending}
            error={capture.error?.message}
            onBack={() => setConfirmPending(false)}
            onConfirm={() => complete(null)}
          />
        )}
        {discarding && (
          <DiscardRegistrationDialog onKeep={() => setDiscarding(false)} onDiscard={onClose} />
        )}
      </>
    );
  return (
    <>
      <LeadFormDialog
        id="lead-capture"
        wide
        title={candidate ? "Editar lead" : "Novo lead"}
        description="Registre o contato e o ponto de partida do aluno."
        firstField="lead-name"
        body={errors.body}
        pending={save.isPending}
        error={save.error?.message}
        steps={
          !candidate && draft.englishExperience === "SOME" ? (
            <Stepper
              className="mt-4"
              steps={[{ label: "Lead" }, { label: "Nivelamento" }]}
              activeIndex={0}
              label="Cadastro do lead"
            />
          ) : undefined
        }
        submitIcon={
          candidate ? (
            <Save aria-hidden="true" />
          ) : draft.englishExperience === "SOME" ? (
            <ArrowRight aria-hidden="true" />
          ) : (
            <UserRoundPlus aria-hidden="true" />
          )
        }
        submitLabel={
          candidate
            ? "Salvar lead"
            : draft.englishExperience === "SOME"
              ? "Continuar para agendamento"
              : "Cadastrar lead"
        }
        onSubmit={submit}
        onClose={requestClose}
      >
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-6 md:grid-cols-2">
          <div className="grid content-start gap-5">
            <FormSection title="Aluno e contato">
              <InterestChoice
                label="Quem está entrando em contato?"
                value={draft.contactRole}
                options={{ STUDENT: "Próprio aluno · maior", GUARDIAN: "Responsável · menor" }}
                onChange={(value) => {
                  change("contactRole", value as Draft["contactRole"]);
                  change("contactOwner", value as Draft["contactOwner"]);
                  if (value === "STUDENT") change("contactName", "");
                }}
              />
              <TextControl
                name="lead-name"
                label="Nome do aluno"
                placeholder="Nome completo do aluno"
                value={draft.fullName}
                onChange={(value) => change("fullName", value)}
                error={errors.fields.fullName}
              />
              {draft.contactRole === "GUARDIAN" && (
                <>
                  <TextControl
                    name="contactName"
                    label="Nome do responsável"
                    placeholder="Nome completo do responsável"
                    value={draft.contactName ?? ""}
                    onChange={(value) => change("contactName", value)}
                    error={errors.fields.contactName}
                  />
                  <InterestChoice
                    label="De quem é o contato abaixo?"
                    value={draft.contactOwner}
                    options={{ GUARDIAN: "Responsável", STUDENT: "Aluno" }}
                    onChange={(value) => change("contactOwner", value as Draft["contactOwner"])}
                  />
                </>
              )}
              <FormRow columns={2}>
                <TextControl
                  name="phone"
                  label="Telefone"
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  value={draft.phone ?? ""}
                  onChange={(value) => change("phone", maskPhoneBR(value))}
                  error={errors.fields.phone}
                />
                <TextControl
                  name="email"
                  label="E-mail"
                  placeholder="nome@exemplo.com"
                  inputMode="email"
                  value={draft.email ?? ""}
                  onChange={(value) => change("email", value)}
                  error={errors.fields.email}
                />
              </FormRow>
              <div className="w-40">
                <TextControl
                  name="birthDate"
                  label="Nascimento (opcional)"
                  placeholder="dd/mm/aaaa"
                  inputMode="numeric"
                  value={draft.birthDate}
                  onChange={(value) => change("birthDate", maskDateBR(value))}
                  error={errors.fields.birthDate}
                />
              </div>
              <TextControl
                name="source"
                label="Como chegou à escola"
                value={draft.source ?? ""}
                onChange={(value) => change("source", value)}
                placeholder="Indicação, Instagram…"
              />
            </FormSection>
          </div>
          <div className="grid content-start gap-5 md:border-l md:border-border md:pl-6">
            <FormSection title="Ponto de partida">
              <InterestChoice
                label="Já estudou inglês?"
                value={draft.englishExperience}
                options={{ NONE: "Está começando", SOME: "Já tem conhecimento" }}
                onChange={(value) => {
                  change("englishExperience", value as Draft["englishExperience"]);
                  change("stageId", null);
                }}
              />
              {draft.englishExperience === "NONE" ? (
                <IntakeStageSelect
                  initialOnly
                  value={draft.stageId}
                  onChange={(value) => change("stageId", value)}
                  error={errors.fields.stageId}
                />
              ) : (
                <p className="text-caption text-muted-foreground">
                  {candidate
                    ? "O nivelamento define o estágio."
                    : "Na próxima etapa, agende a prova presencial ou online."}{" "}
                  O agendamento não exige professor.
                </p>
              )}
              <InterestChoice
                label="Interesse"
                value={draft.interest}
                options={leadInterestLabels}
                onChange={(value) => change("interest", value as Draft["interest"])}
              />
              <InterestChoice
                label="Preferência de formato (opcional)"
                value={draft.format ?? "NONE"}
                options={{ NONE: "Sem preferência", IN_PERSON: "Presencial", ONLINE: "Online" }}
                onChange={(value) =>
                  change("format", value === "NONE" ? null : (value as Draft["format"]))
                }
              />
              <p className="text-caption text-muted-foreground">
                O formato definitivo será escolhido no cadastro do aluno.
              </p>
            </FormSection>
          </div>
        </fieldset>
      </LeadFormDialog>
      {discarding && (
        <DiscardRegistrationDialog onKeep={() => setDiscarding(false)} onDiscard={onClose} />
      )}
    </>
  );
}
