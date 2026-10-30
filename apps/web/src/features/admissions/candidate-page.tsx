"use client";

import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { useQueryState } from "nuqs";
import { PlacementVisitDialog } from "./placement-assessment";
import { Archive, CalendarPlus, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  DetailHeader,
  PencilLoader,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { LeadCaptureDialog } from "./lead-capture-dialog";
import { LeadContext } from "./lead-context";
import { LeadEnrollment } from "./lead-enrollment";
import { CandidateVisits } from "./candidate-visits";
import { PlacementSchedule } from "./placement-schedule";
import { VisitDialog } from "./visit-dialog";
import { statusLabels, type Candidate } from "./labels";
import styles from "./lead-workspace.module.css";

export function CandidatePage({ id }: { id: string }): ReactElement {
  const query = trpc.admissions.byId.useQuery({ id }, { retry: false });
  let content: ReactElement;
  if (query.isPending) content = <CandidateLoading />;
  else if (query.data) content = <CandidateWorkspace candidate={query.data} />;
  else
    content = (
      <Alert variant="destructive">
        {query.error?.message ?? "Não foi possível abrir o lead."}
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    );
  return (
    <div data-page-scroll="internal" className={styles.page}>
      {content}
    </div>
  );
}

const PLACEMENT_OPEN_DELAY_MS = 180;
type CandidateDialog = "edit" | "trial" | "placement" | null;

function CandidateWorkspace({ candidate }: { candidate: Candidate }): ReactElement {
  const [dialog, setDialog] = useState<CandidateDialog>(null);
  const [requestedPlacement, setRequestedPlacement] = useQueryState("nivelamento");
  const [placementId, setPlacementId] = useState<string | null>(null);
  useRequestedPlacement({
    candidate,
    requestedPlacement,
    setRequestedPlacement,
    setPlacementId,
    setDialog,
  });
  const utils = trpc.useUtils();
  const status = trpc.admissions.setStatus.useMutation({
    onSuccess: () => utils.admissions.invalidate(),
  });
  const active = candidate.status === "WAITING";
  return (
    <div className={styles.workspace}>
      <CandidateHeader
        candidate={candidate}
        active={active}
        pending={status.isPending}
        onEdit={() => setDialog("edit")}
        onToggle={() =>
          status.mutate({ id: candidate.id, status: active ? "ARCHIVED" : "WAITING" })
        }
      />
      {status.error && <Alert variant="destructive">{status.error.message}</Alert>}
      {candidate.status === "ARCHIVED" && (
        <p className={styles.archived}>
          Este lead está arquivado. Reabra pelo menu de ações para retomar os agendamentos e o
          cadastro.
        </p>
      )}
      <div className={styles.layout}>
        <LeadContext candidate={candidate} onEdit={() => setDialog("edit")} />
        <CandidateAgenda candidate={candidate} active={active} onSchedule={setDialog} />
      </div>
      <CandidateDialogs {...{ candidate, placementId, setPlacementId, dialog, setDialog }} />
    </div>
  );
}

function CandidateDialogs({
  candidate,
  placementId,
  setPlacementId,
  dialog,
  setDialog,
}: {
  candidate: Candidate;
  placementId: string | null;
  setPlacementId: Dispatch<SetStateAction<string | null>>;
  dialog: CandidateDialog;
  setDialog: Dispatch<SetStateAction<CandidateDialog>>;
}): ReactElement {
  return (
    <>
      {placementId && (
        <PlacementVisitDialog
          candidateId={candidate.id}
          visitId={placementId}
          onClose={() => setPlacementId(null)}
        />
      )}
      {dialog === "edit" && (
        <LeadCaptureDialog candidate={candidate} onClose={() => setDialog(null)} />
      )}
      {dialog === "trial" && <VisitDialog candidate={candidate} onClose={() => setDialog(null)} />}
      {dialog === "placement" && (
        <PlacementSchedule candidate={candidate} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function useRequestedPlacement({
  candidate,
  requestedPlacement,
  setRequestedPlacement,
  setPlacementId,
  setDialog,
}: {
  candidate: Candidate;
  requestedPlacement: string | null;
  setRequestedPlacement: ReturnType<typeof useQueryState>[1];
  setPlacementId: Dispatch<SetStateAction<string | null>>;
  setDialog: Dispatch<SetStateAction<CandidateDialog>>;
}): void {
  useEffect(() => {
    if (requestedPlacement !== "pendente" || candidate.status === "ARCHIVED") return;
    // This workspace mounts only after the lead has loaded. Let it paint first.
    const timer = setTimeout(() => {
      const latest = candidate.visits
        .filter((visit) => visit.kind === "PLACEMENT" && visit.status !== "CANCELLED")
        .toSorted(
          (left, right) =>
            right.date.getTime() - left.date.getTime() ||
            right.startTime.localeCompare(left.startTime),
        )[0];
      if (latest && latest.status !== "ABSENT") setPlacementId(latest.id);
      else if (candidate.status === "WAITING") setDialog("placement");
      void setRequestedPlacement(null);
    }, PLACEMENT_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [candidate, requestedPlacement, setRequestedPlacement]);
}

function CandidateHeader({
  candidate,
  active,
  pending,
  onEdit,
  onToggle,
}: {
  candidate: Candidate;
  active: boolean;
  pending: boolean;
  onEdit: () => void;
  onToggle: () => void;
}): ReactElement {
  return (
    <DetailHeader
      title={candidate.fullName}
      metadata={
        <Badge variant={candidate.status === "ENROLLED" ? "success" : "neutral"}>
          {statusLabels[candidate.status]}
        </Badge>
      }
      actions={
        <div className={styles.headerActions}>
          <LeadEnrollment candidate={candidate} />
          {candidate.status !== "ENROLLED" && (
            <CandidateActionMenu {...{ active, pending, onEdit, onToggle }} />
          )}
        </div>
      }
    />
  );
}

function CandidateActionMenu({
  active,
  pending,
  onEdit,
  onToggle,
}: {
  active: boolean;
  pending: boolean;
  onEdit: () => void;
  onToggle: () => void;
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-compact-responsive" aria-label="Mais ações do lead" />
        }
      >
        <MoreHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="grid gap-1">
          {active && (
            <PopoverClose render={<Button variant="ghost" size="sm" />} onClick={onEdit}>
              <Pencil />
              Editar lead
            </PopoverClose>
          )}
          <PopoverClose
            render={<Button variant="ghost" size="sm" />}
            disabled={pending}
            onClick={onToggle}
          >
            {active ? <Archive /> : <RotateCcw />}
            {active ? "Arquivar lead" : "Reabrir lead"}
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CandidateAgenda({
  candidate,
  active,
  onSchedule,
}: {
  candidate: Candidate;
  active: boolean;
  onSchedule: (dialog: "edit" | "trial" | "placement" | null) => void;
}): ReactElement {
  const placements = candidate.visits.filter((visit) => visit.kind === "PLACEMENT");
  const hasPlacement = placements.some((visit) => visit.status === "SCHEDULED");
  return (
    <section className={styles.agenda} aria-label="Agendamentos do lead">
      <div className={styles.agendaHeader}>
        <div>
          <h2>
            Agendamentos <span>{candidate.visits.length}</span>
          </h2>
          <p>Encontros, provas e próximos passos.</p>
        </div>
        {active && (
          <div className={styles.scheduleActions}>
            {candidate.englishExperience === "SOME" && !hasPlacement && (
              <Button
                variant="secondary"
                size="compact-responsive"
                onClick={() => onSchedule("placement")}
              >
                <CalendarPlus />
                {placements.length > 0 ? "Novo nivelamento" : "Agendar nivelamento"}
              </Button>
            )}
            <Button
              variant="secondary"
              size="compact-responsive"
              onClick={() => onSchedule("trial")}
            >
              <CalendarPlus />
              Agendar experimental
            </Button>
          </div>
        )}
      </div>
      <CandidateVisits candidate={candidate} />
    </section>
  );
}

function CandidateLoading(): ReactElement {
  return (
    <div className={styles.loading} aria-busy="true">
      <PencilLoader label="Carregando lead" />
    </div>
  );
}
