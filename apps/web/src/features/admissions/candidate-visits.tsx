"use client";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { CalendarDays, MoreHorizontal } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TextControl } from "~/features/classes/form-controls";
import { VisitDialog } from "./visit-dialog";
import { dateLabel, visitLabels, type Candidate } from "./labels";

type Visit = Candidate["visits"][number];
export function CandidateVisits({ candidate }: { candidate: Candidate }): ReactElement {
  const [outcome, setOutcome] = useState<Visit | null>(null);
  const [cancel, setCancel] = useState(false);
  const [reschedule, setReschedule] = useState<string | null>(null);
  return (
    <>
      {candidate.visits.length === 0 ? (
        <div className="flex gap-3 border-t border-border py-5">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="grid gap-1">
            <p className="font-medium">A primeira aula ainda não foi marcada</p>
            <p className="text-caption text-muted-foreground">
              Agende uma participação na turma ou uma apresentação do personalizado.
            </p>
          </div>
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {candidate.visits.map((visit) => (
            <li key={visit.id} className="grid gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">
                      {visit.kind === "TRIAL" ? "Aula experimental" : "Aula introdutória"}
                    </h3>
                    <Badge
                      variant={
                        visit.status === "ATTENDED"
                          ? "success"
                          : visit.status === "ABSENT"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {visitLabels[visit.status]}
                    </Badge>
                    {visit.previousVisitId && (
                      <span className="text-caption text-muted-foreground">Remarcada</span>
                    )}
                  </div>
                  <p className="font-numeric text-caption">
                    {dateLabel(visit.date)} · {visit.startTime}–{visit.endTime}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {visit.teacherName ?? "Professor a definir"}
                    {visit.class ? ` · ${visit.class.portalClassName}` : ""}
                  </p>
                </div>
                {visit.status !== "CANCELLED" && (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-compact-responsive"
                          aria-label={`Ações da aula de ${dateLabel(visit.date)}`}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </PopoverTrigger>
                    <PopoverContent align="end">
                      <div className="grid gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCancel(false);
                            setOutcome(visit);
                          }}
                        >
                          Registrar comparecimento
                        </Button>
                        {visit.status === "SCHEDULED" && candidate.status === "WAITING" && (
                          <Button variant="ghost" size="sm" onClick={() => setReschedule(visit.id)}>
                            Remarcar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCancel(true);
                            setOutcome(visit);
                          }}
                        >
                          Cancelar aula
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {visit.needsReschedule && (
                <Alert variant="warning">
                  O encontro da turma mudou ou está sem professor. Remarque esta aula de entrada.
                </Alert>
              )}
              {visit.notes && (
                <p className="break-words text-caption text-muted-foreground">{visit.notes}</p>
              )}
              {visit.cancellationReason && (
                <p className="text-caption text-muted-foreground">{visit.cancellationReason}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {outcome && (
        <OutcomeDialog visit={outcome} cancel={cancel} onClose={() => setOutcome(null)} />
      )}
      {reschedule && (
        <VisitDialog
          candidate={candidate}
          previousVisitId={reschedule}
          onClose={() => setReschedule(null)}
        />
      )}
    </>
  );
}
function OutcomeDialog({
  visit,
  cancel,
  onClose,
}: {
  visit: Visit;
  cancel: boolean;
  onClose: () => void;
}): ReactElement {
  const [status, setStatus] = useState<"ATTENDED" | "ABSENT">(
    visit.status === "ABSENT" ? "ABSENT" : "ATTENDED",
  );
  const [notes, setNotes] = useState(cancel ? "" : (visit.notes ?? ""));
  const [error, setError] = useState("");
  const popup = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const mutation = trpc.admissions.outcome.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admissions.invalidate(), utils.teachers.invalidate()]);
      onClose();
    },
  });
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (mutation.isPending) return;
    if (cancel && !notes.trim()) {
      setError("Informe o motivo do cancelamento.");
      popup.current?.querySelector("input")?.focus();
      return;
    }
    mutation.mutate({ id: visit.id, status: cancel ? "CANCELLED" : status, notes });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          ref={popup}
          initialFocus={() => popup.current?.querySelector("input") ?? false}
        >
          <DialogHeader>
            <DialogTitle>
              {cancel ? "Cancelar aula de entrada" : "Registrar comparecimento"}
            </DialogTitle>
            <DialogDescription>
              {dateLabel(visit.date)} · {visit.startTime}–{visit.endTime}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="visit-outcome" noValidate onSubmit={submit} className="grid gap-4 pt-4">
              {!cancel && (
                <SegmentedControl
                  aria-label="Comparecimento"
                  size="sm"
                  value={status}
                  onValueChange={(value) => {
                    if (value === "ATTENDED" || value === "ABSENT") setStatus(value);
                  }}
                >
                  <SegmentedControlItem value="ATTENDED">Compareceu</SegmentedControlItem>
                  <SegmentedControlItem value="ABSENT">Não compareceu</SegmentedControlItem>
                </SegmentedControl>
              )}
              <TextControl
                name="outcome-notes"
                label={cancel ? "Motivo" : "Observações"}
                placeholder={cancel ? "Por que a aula será cancelada?" : "Como foi a experiência?"}
                value={notes}
                onChange={(value) => {
                  setNotes(value);
                  setError("");
                }}
                error={error}
              />
              {!cancel && (
                <p className="text-caption text-muted-foreground">
                  O comparecimento não efetiva uma matrícula.
                </p>
              )}
              {mutation.isError && <Alert variant="destructive">{mutation.error.message}</Alert>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" disabled={mutation.isPending} onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" form="visit-outcome" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Salvando…"
                : cancel
                  ? "Confirmar cancelamento"
                  : "Salvar comparecimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
