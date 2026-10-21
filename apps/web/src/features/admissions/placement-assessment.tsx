"use client";

import type { JSX as ReactJSX } from "react";
import { useId, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Download,
  FileCheck2,
  FileText,
  FileUp,
  GraduationCap,
  MessageSquare,
  Pencil,
  UserRound,
  X,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Field,
  Label,
  PencilLoader,
  Textarea,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { schoolToday } from "~/features/class-records/calendar-model";
import { PlacementAttachmentDialog } from "~/features/assessment-files/placement-attachment-dialog";
import { downloadFileBase64 } from "~/features/assessment-files/file-transfer";
import { IntakeStageSelect } from "./intake-fields";
import { PlacementSchedule } from "./placement-schedule";
import { dateLabel, formatLabel, type Candidate } from "./labels";
import { placementHasStarted, placementStatus } from "./placement-state";
import styles from "./placement-review.module.css";

type Visit = Candidate["visits"][number];

export function PlacementAssessment({ candidate }: { candidate: Candidate }): ReactJSX.Element {
  const [scheduling, setScheduling] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const visits = candidate.visits.filter((row) => row.kind === "PLACEMENT");
  return (
    <section className={styles.section}>
      <h2>Nivelamento</h2>
      {visits.map((visit) => (
        <Button key={visit.id} variant="secondary" onClick={() => setSelected(visit.id)}>
          {dateLabel(visit.date)} · {placementStatus(visit).label}
        </Button>
      ))}
      {candidate.status === "WAITING" && !visits.some((row) => row.status === "SCHEDULED") && (
        <Button variant="secondary" onClick={() => setScheduling(true)}>
          <CalendarDays />
          Agendar nivelamento
        </Button>
      )}
      {selected && (
        <PlacementVisitDialog
          candidateId={candidate.id}
          visitId={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {scheduling && (
        <PlacementSchedule candidate={candidate} onClose={() => setScheduling(false)} />
      )}
    </section>
  );
}

export function PlacementVisitDialog({
  candidateId,
  visitId,
  onClose,
  initialUpload = false,
}: {
  candidateId: string;
  visitId: string;
  onClose: () => void;
  initialUpload?: boolean;
}): ReactJSX.Element {
  const query = trpc.admissions.byId.useQuery({ id: candidateId });
  const visit = query.data?.visits.find((row) => row.id === visitId);
  if (visit && query.data)
    return (
      <PlacementVisit
        key={visit.id}
        visit={visit}
        person={query.data.fullName}
        editable={query.data.status === "WAITING"}
        initialUpload={initialUpload}
        onClose={onClose}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className={`${styles.dialog} md:max-w-xl`}>
          <DialogHeader>
            <DialogTitle>Nivelamento</DialogTitle>
            <DialogDescription>{query.data?.fullName ?? "Atendimento do lead"}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {query.error ? (
              <Alert variant="destructive">
                {query.error.message}
                <Button variant="ghost" onClick={() => void query.refetch()}>
                  Tentar novamente
                </Button>
              </Alert>
            ) : (
              <div className={styles.body}>
                <PencilLoader size="sm" label="Carregando atendimento" />
              </div>
            )}
          </DialogBody>
          <DialogFooter className={styles.footer}>
            <Button variant="secondary" onClick={onClose}>
              <X />
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function PlacementVisit({
  visit,
  editable,
  person,
  initialUpload,
  onClose,
}: {
  visit: Visit;
  editable: boolean;
  person: string;
  initialUpload: boolean;
  onClose: () => void;
}): ReactJSX.Element {
  const utils = trpc.useUtils();
  const refresh = () =>
    Promise.all([
      utils.admissions.invalidate(),
      utils.classRecords.invalidate(),
      utils.students.pendingActions.invalidate(),
      utils.teacherWorkspace.invalidate(),
    ]);
  const download = trpc.admissions.placementDownload.useMutation();
  const result = trpc.admissions.placementResult.useMutation({ onSuccess: refresh });
  const upload = trpc.admissions.placementUpload.useMutation({ onSuccess: refresh });
  const cancel = trpc.admissions.outcome.useMutation({ onSuccess: refresh });
  const teachers = trpc.teachers.options.useQuery({ date: schoolToday(), search: "" });
  const assign = trpc.admissions.assignPlacement.useMutation({ onSuccess: refresh });
  const [stageId, setStageId] = useState<string | null>(visit.assessment?.stageId ?? null);
  const [notes, setNotes] = useState(visit.assessment?.notes ?? "");
  const [editing, setEditing] = useState(!visit.assessment?.stageId);
  const [cancellation, setCancellation] = useState<string | null>(null);
  const [attaching, setAttaching] = useState<"ORIGINAL" | "CORRECTED" | null>(
    initialUpload ? "ORIGINAL" : null,
  );
  const title = useRef<HTMLHeadingElement>(null);
  const formId = useId();
  const inactive = visit.status === "CANCELLED" || visit.status === "ABSENT";
  const canEdit = editable && !inactive;
  const started = placementHasStarted(visit);
  const pending = result.isPending || cancel.isPending || assign.isPending || upload.isPending;
  const status = placementStatus(visit);
  if (attaching)
    return (
      <PlacementAttachmentDialog
        visit={visit}
        person={person}
        kind={attaching}
        onUpload={(file) => upload.mutateAsync(file)}
        onClose={() => {
          if (initialUpload && attaching === "ORIGINAL" && !visit.assessment) onClose();
          else setAttaching(null);
        }}
        onComplete={() => setAttaching(null)}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className={`${styles.dialog} md:max-w-xl`}
          showCloseButton={!pending}
          initialFocus={() => title.current}
        >
          <DialogHeader>
            <DialogTitle ref={title} tabIndex={-1} className="outline-none">
              Nivelamento
            </DialogTitle>
            <DialogDescription>{person}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.body}>
              <div className={styles.context}>
                <p>
                  {dateLabel(visit.date)} · {visit.startTime}–{visit.endTime}
                  <br />
                  {formatLabel(visit.format)}
                </p>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <section className={styles.section}>
                {visit.assessment ? (
                  <div className={styles.proof}>
                    <FileText aria-hidden="true" />
                    <div>
                      <p>Prova aplicada</p>
                      <strong>{visit.assessment.fileName}</strong>
                      <p>Anexada por {visit.assessment.uploadedBy.name}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="compact-responsive"
                      loading={download.isPending}
                      onClick={async () => {
                        try {
                          downloadFileBase64(await download.mutateAsync({ id: visit.id }));
                        } catch {
                          /* Shown below. */
                        }
                      }}
                    >
                      <Download />
                      Baixar
                    </Button>
                  </div>
                ) : (
                  <div className={styles.emptyProof}>
                    <FileUp aria-hidden="true" />
                    <h3>{inactive ? "Nenhuma prova anexada" : "Anexe a prova aplicada"}</h3>
                    <p>
                      {inactive
                        ? "Este atendimento está encerrado para alterações."
                        : started
                          ? "Envie uma foto ou PDF. Depois, registre o estágio indicado pelo professor."
                          : "O envio fica disponível a partir do início do atendimento. Você pode definir o professor agora."}
                    </p>
                    {canEdit && (
                      <Button
                        size="compact-responsive"
                        disabled={!started || pending}
                        onClick={() => setAttaching("ORIGINAL")}
                      >
                        <FileUp />
                        Anexar prova
                      </Button>
                    )}
                  </div>
                )}
                {download.error && <Alert variant="destructive">{download.error.message}</Alert>}
              </section>
              {visit.assessment && (
                <section className={styles.result}>
                  <div className={styles.resultActions}>
                    <h3>Resultado do nivelamento</h3>
                    {canEdit && !editing && (
                      <Button
                        variant="ghost"
                        size="compact-responsive"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil />
                        Editar resultado
                      </Button>
                    )}
                  </div>
                  {canEdit && editing ? (
                    <form
                      id={formId}
                      className={styles.form}
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (stageId && !pending)
                          result.mutate(
                            { id: visit.id, stageId, notes },
                            { onSuccess: () => setEditing(false) },
                          );
                      }}
                    >
                      <IntakeStageSelect
                        value={stageId}
                        onChange={setStageId}
                        disabled={pending}
                        openOnFocus={false}
                        labelIcon={
                          <GraduationCap aria-hidden="true" className="size-4 text-icon" />
                        }
                      />
                      <Field>
                        <Label htmlFor={`placement-notes-${visit.id}`}>
                          <span className="inline-flex items-center gap-1.5">
                            <MessageSquare aria-hidden="true" className="size-4 text-icon" />
                            Observações da correção
                          </span>
                        </Label>
                        <Textarea
                          id={`placement-notes-${visit.id}`}
                          name={`placement-notes-${visit.id}`}
                          rows={4}
                          maxLength={2000}
                          disabled={pending}
                          placeholder="Pontos observados na prova"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                        />
                      </Field>
                    </form>
                  ) : (
                    <>
                      <strong>{visit.assessment.stage?.name ?? "Aguardando correção"}</strong>
                      {visit.assessment.correctedBy && (
                        <p>Resultado registrado por {visit.assessment.correctedBy.name}.</p>
                      )}
                      {visit.assessment.notes && <p>{visit.assessment.notes}</p>}
                    </>
                  )}
                  {result.error && <Alert variant="destructive">{result.error.message}</Alert>}
                  <div className={styles.correctedFile}>
                    <h4>
                      <FileCheck2 aria-hidden="true" />
                      Prova corrigida <span>Opcional</span>
                    </h4>
                    {visit.assessment.correctedFile ? (
                      <div className={styles.proof}>
                        <FileCheck2 aria-hidden="true" />
                        <div>
                          <strong>{visit.assessment.correctedFile.fileName}</strong>
                          <p>Anexada por {visit.assessment.correctedFile.uploadedBy.name}</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="compact-responsive"
                          loading={download.isPending}
                          onClick={async () => {
                            try {
                              downloadFileBase64(
                                await download.mutateAsync({ id: visit.id, kind: "CORRECTED" }),
                              );
                            } catch {
                              /* Shown above. */
                            }
                          }}
                        >
                          <Download />
                          Baixar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p>
                          {canEdit
                            ? "Você pode anexar a versão com as correções do professor."
                            : "Nenhuma versão corrigida anexada."}
                        </p>
                        {canEdit && (
                          <Button
                            variant="secondary"
                            size="compact-responsive"
                            disabled={pending}
                            onClick={() => setAttaching("CORRECTED")}
                          >
                            <FileUp />
                            Anexar prova corrigida
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}
              {canEdit && (
                <section className={styles.secondary}>
                  <SelectControl
                    name={`placement-teacher-${visit.id}`}
                    label="Professor responsável pela correção"
                    labelIcon={<UserRound aria-hidden="true" className="size-4 text-icon" />}
                    value={visit.teacherId ?? ""}
                    onChange={(value) => {
                      if (!pending) assign.mutate({ id: visit.id, teacherId: value || null });
                    }}
                    choices={[
                      { value: "", label: "Atribuir depois" },
                      ...(visit.teacherId &&
                      !teachers.data?.some((teacher) => teacher.id === visit.teacherId)
                        ? [
                            {
                              value: visit.teacherId,
                              label: visit.teacherName ?? "Professor atribuído",
                            },
                          ]
                        : []),
                      ...(teachers.data ?? []).map((teacher) => ({
                        value: teacher.id,
                        label: teacher.name,
                      })),
                    ]}
                  />
                  {assign.error && <Alert variant="destructive">{assign.error.message}</Alert>}
                  {!visit.assessment &&
                    (cancellation === null ? (
                      <Button
                        variant="destructive-ghost"
                        size="compact-responsive"
                        onClick={() => setCancellation("")}
                      >
                        <X />
                        Cancelar atendimento
                      </Button>
                    ) : (
                      <form
                        className={styles.form}
                        noValidate
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (cancellation.trim() && !pending)
                            cancel.mutate({
                              id: visit.id,
                              status: "CANCELLED",
                              notes: cancellation,
                            });
                        }}
                      >
                        <TextControl
                          name={`cancel-${visit.id}`}
                          label="Motivo do cancelamento"
                          labelIcon={
                            <MessageSquare aria-hidden="true" className="size-4 text-icon" />
                          }
                          placeholder="Descreva o motivo"
                          value={cancellation}
                          onChange={setCancellation}
                        />
                        <div className={styles.resultActions}>
                          <Button
                            variant="ghost"
                            disabled={pending}
                            onClick={() => setCancellation(null)}
                          >
                            <ArrowLeft />
                            Voltar
                          </Button>
                          <Button
                            type="submit"
                            variant="destructive"
                            loading={cancel.isPending}
                            disabled={!cancellation.trim() || pending}
                          >
                            <X />
                            Confirmar cancelamento
                          </Button>
                        </div>
                      </form>
                    ))}
                  {cancel.error && <Alert variant="destructive">{cancel.error.message}</Alert>}
                </section>
              )}
              {visit.cancellationReason && (
                <p className="text-caption text-muted-foreground">{visit.cancellationReason}</p>
              )}
            </div>
          </DialogBody>
          <DialogFooter className={styles.footer}>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              <X />
              Fechar
            </Button>
            {canEdit && editing && visit.assessment && (
              <Button
                type="submit"
                form={formId}
                loading={result.isPending}
                disabled={!stageId || pending}
              >
                <Check />
                Registrar estágio
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
