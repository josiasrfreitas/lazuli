"use client";
import { useState } from "react";
import { CalendarDays, Download, FileUp } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Field,
  Input,
  Label,
} from "@lazuli/ui";
import { MAX_PLACEMENT_FILE_BYTES } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { schoolToday } from "~/features/class-records/calendar-model";
import { IntakeStageSelect } from "./intake-fields";
import { PlacementSchedule } from "./placement-schedule";
import { dateLabel, formatLabel, type Candidate } from "./labels";

type Visit = Candidate["visits"][number];

export function PlacementAssessment({ candidate }: { candidate: Candidate }) {
  const [scheduling, setScheduling] = useState(false);
  const visits = candidate.visits.filter((row) => row.kind === "PLACEMENT");
  const pending = visits.some((row) => row.status === "SCHEDULED");
  const latest = visits.find((row) => row.status !== "CANCELLED");
  const next = latest?.assessment?.stageId
    ? "Estágio definido"
    : latest?.assessment
      ? "Aguardando correção"
      : pending
        ? "Prova agendada"
        : "Agendar nivelamento";
  return (
    <section className="grid gap-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-display text-h3 font-semibold">Nivelamento</h2>
          <p className="text-caption text-muted-foreground">{next}</p>
        </div>
        {candidate.status === "WAITING" && !pending && (
          <Button variant="secondary" size="sm" onClick={() => setScheduling(true)}>
            <CalendarDays />
            {visits.length ? "Novo nivelamento" : "Agendar prova"}
          </Button>
        )}
      </div>
      {!visits.length && (
        <p className="text-caption">
          A prova pode ser presencial ou online. O professor define o estágio após a aplicação.
        </p>
      )}
      {visits.map((visit) => (
        <PlacementVisit key={visit.id} visit={visit} editable={candidate.status === "WAITING"} />
      ))}
      {scheduling && (
        <PlacementSchedule candidate={candidate} onClose={() => setScheduling(false)} />
      )}
    </section>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
    reader.readAsDataURL(file);
  });
}

export function PlacementVisit({ visit, editable }: { visit: Visit; editable: boolean }) {
  const utils = trpc.useUtils();
  const refresh = () =>
    Promise.all([utils.admissions.invalidate(), utils.classRecords.invalidate()]);
  const upload = trpc.admissions.placementUpload.useMutation({ onSuccess: refresh });
  const download = trpc.admissions.placementDownload.useMutation();
  const result = trpc.admissions.placementResult.useMutation({ onSuccess: refresh });
  const cancel = trpc.admissions.outcome.useMutation({ onSuccess: refresh });
  const teachers = trpc.teachers.options.useQuery({ date: schoolToday(), search: "" });
  const assign = trpc.admissions.assignPlacement.useMutation({ onSuccess: refresh });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const [stageId, setStageId] = useState<string | null>(visit.assessment?.stageId ?? null);
  const [notes, setNotes] = useState(visit.assessment?.notes ?? "");
  const [cancellation, setCancellation] = useState<string | null>(null);
  const inactive = visit.status === "CANCELLED" || visit.status === "ABSENT";
  const canEdit = editable && !inactive;
  async function sendFile() {
    if (!file || reading || upload.isPending) return;
    setFileError("");
    if (file.size > MAX_PLACEMENT_FILE_BYTES) return setFileError("O arquivo deve ter até 5 MB.");
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
      return setFileError("Escolha um PDF, JPG ou PNG.");
    setReading(true);
    try {
      await upload.mutateAsync({
        id: visit.id,
        fileName: file.name,
        contentType: file.type as "application/pdf" | "image/jpeg" | "image/png",
        base64: await readFile(file),
      });
      setFile(null);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Não foi possível anexar a prova.");
    } finally {
      setReading(false);
    }
  }
  async function downloadFile() {
    try {
      const attachment = await download.mutateAsync({ id: visit.id });
      const bytes = Uint8Array.from(atob(attachment.base64), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: attachment.contentType }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* Mutation error is displayed below. */
    }
  }
  return (
    <div className="grid gap-3 rounded-lg border border-border p-4">
      {canEdit && (
        <SelectControl
          name={`placement-teacher-${visit.id}`}
          label="Professor responsável pela correção"
          value={visit.teacherId ?? ""}
          onChange={(value) => assign.mutate({ id: visit.id, teacherId: value || null })}
          choices={[
            { value: "", label: "Atribuir depois" },
            ...(teachers.data ?? []).map((teacher) => ({ value: teacher.id, label: teacher.name })),
          ]}
        />
      )}
      {assign.error && <Alert variant="destructive">{assign.error.message}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption font-medium">
          {dateLabel(visit.date)} · {visit.startTime}–{visit.endTime} · {formatLabel(visit.format)}
        </p>
        <Badge variant={visit.assessment?.stageId ? "success" : "neutral"}>
          {inactive
            ? visit.status === "CANCELLED"
              ? "Cancelado"
              : "Não compareceu"
            : visit.assessment?.stageId
              ? "Estágio definido"
              : visit.assessment
                ? "Aguardando correção"
                : "Aguardando prova"}
        </Badge>
      </div>
      {visit.assessment ? (
        <>
          <Button
            variant="ghost"
            className="justify-start"
            disabled={download.isPending}
            onClick={() => void downloadFile()}
          >
            <Download />
            {visit.assessment.fileName}
          </Button>
          <p className="text-caption text-muted-foreground">
            Anexada por {visit.assessment.uploadedBy.name}.
          </p>
          {visit.assessment.stage && (
            <p className="text-caption">
              {visit.assessment.stage.name} · Resultado registrado por{" "}
              {visit.assessment.correctedBy?.name}.
            </p>
          )}
          {canEdit && (
            <>
              <IntakeStageSelect value={stageId} onChange={setStageId} />
              <TextControl
                name={`placement-notes-${visit.id}`}
                label="Observações da correção"
                value={notes}
                onChange={setNotes}
              />
              <Button
                disabled={!stageId || result.isPending}
                onClick={() => stageId && result.mutate({ id: visit.id, stageId, notes })}
              >
                {result.isPending ? "Salvando…" : "Registrar estágio"}
              </Button>
            </>
          )}
        </>
      ) : (
        canEdit && (
          <>
            <Field>
              <Label>Arquivo da prova · PDF, JPG ou PNG, até 5 MB</Label>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setFileError("");
                }}
              />
            </Field>
            <Button
              variant="secondary"
              disabled={!file || reading || upload.isPending}
              onClick={() => void sendFile()}
            >
              <FileUp />
              {reading || upload.isPending ? "Enviando…" : "Anexar prova"}
            </Button>
          </>
        )
      )}
      {canEdit &&
        !visit.assessment &&
        (cancellation === null ? (
          <Button variant="ghost" size="sm" onClick={() => setCancellation("")}>
            Cancelar atendimento
          </Button>
        ) : (
          <div className="grid gap-2">
            <TextControl
              name={`cancel-${visit.id}`}
              label="Motivo do cancelamento"
              value={cancellation}
              onChange={setCancellation}
            />
            <Button
              variant="secondary"
              disabled={!cancellation.trim() || cancel.isPending}
              onClick={() =>
                cancel.mutate({ id: visit.id, status: "CANCELLED", notes: cancellation })
              }
            >
              Confirmar cancelamento
            </Button>
          </div>
        ))}
      {(fileError || download.error || result.error || cancel.error) && (
        <Alert variant="destructive">
          {fileError || download.error?.message || result.error?.message || cancel.error?.message}
        </Alert>
      )}
    </div>
  );
}

export function PlacementVisitDialog({
  candidateId,
  visitId,
  onClose,
}: {
  candidateId: string;
  visitId: string;
  onClose: () => void;
}) {
  const query = trpc.admissions.byId.useQuery({ id: candidateId });
  const visit = query.data?.visits.find((row) => row.id === visitId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nivelamento · {query.data?.fullName ?? "Lead"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {visit ? (
              <PlacementVisit visit={visit} editable={query.data?.status === "WAITING"} />
            ) : (
              <p role="status">{query.error?.message ?? "Carregando atendimento…"}</p>
            )}
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
