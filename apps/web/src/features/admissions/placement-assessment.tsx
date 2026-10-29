"use client";

import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import {
  Alert,
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
  PencilLoader,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PlacementSchedule } from "./placement-schedule";
import { PlacementVisit } from "./placement-visit-details";
import { dateLabel, type Candidate } from "./labels";
import { placementStatus } from "./placement-state";
import styles from "./placement-review.module.css";

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
        editable={
          query.data.status === "WAITING" ||
          (query.data.status === "ENROLLED" &&
            Boolean(query.data.studentId) &&
            !visit.assessment?.stageId)
        }
        initialUpload={initialUpload}
        onClose={onClose}
      />
    );
  return (
    <PendingVisitDialog
      person={query.data?.fullName}
      error={query.error?.message}
      retry={() => void query.refetch()}
      onClose={onClose}
    />
  );
}

function PendingVisitDialog({
  person,
  error,
  retry,
  onClose,
}: {
  person: string | undefined;
  error: string | undefined;
  retry: () => void;
  onClose: () => void;
}): ReactJSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="max-h-[calc(100dvh-2rem)] md:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nivelamento</DialogTitle>
            <DialogDescription>{person ?? "Atendimento do lead"}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {error ? (
              <Alert variant="destructive">
                {error}
                <Button variant="ghost" onClick={retry}>
                  Tentar novamente
                </Button>
              </Alert>
            ) : (
              <div className={styles.body}>
                <PencilLoader size="sm" label="Carregando atendimento" />
              </div>
            )}
          </DialogBody>
          <DialogFooter className="mt-4 flex flex-row justify-end gap-3 border-t border-border pt-4 max-sm:[&>button]:min-h-11 max-sm:[&>button]:min-w-0 max-sm:[&>button]:flex-1 max-sm:[&>button]:whitespace-normal max-sm:[&>button]:px-3">
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
