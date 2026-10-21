"use client";

import { useState, type ReactElement } from "react";
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
  return (
    <div data-page-scroll="internal" className={styles.page}>
      {query.isPending ? (
        <CandidateLoading />
      ) : query.data ? (
        <CandidateWorkspace candidate={query.data} />
      ) : (
        <Alert variant="destructive">
          {query.error?.message ?? "Não foi possível abrir o lead."}
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      )}
    </div>
  );
}

function CandidateWorkspace({ candidate }: { candidate: Candidate }): ReactElement {
  const [dialog, setDialog] = useState<"edit" | "trial" | "placement" | null>(null);
  const utils = trpc.useUtils();
  const status = trpc.admissions.setStatus.useMutation({
    onSuccess: () => utils.admissions.invalidate(),
  });
  const active = candidate.status === "WAITING";
  const placements = candidate.visits.filter((visit) => visit.kind === "PLACEMENT");
  const hasPlacement = placements.some((visit) => visit.status === "SCHEDULED");
  return (
    <div className={styles.workspace}>
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
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-compact-responsive"
                      aria-label="Mais ações do lead"
                    />
                  }
                >
                  <MoreHorizontal />
                </PopoverTrigger>
                <PopoverContent align="end">
                  <div className="grid gap-1">
                    {active && (
                      <PopoverClose
                        render={<Button variant="ghost" size="sm" />}
                        onClick={() => setDialog("edit")}
                      >
                        <Pencil />
                        Editar lead
                      </PopoverClose>
                    )}
                    <PopoverClose
                      render={<Button variant="ghost" size="sm" />}
                      disabled={status.isPending}
                      onClick={() =>
                        status.mutate({ id: candidate.id, status: active ? "ARCHIVED" : "WAITING" })
                      }
                    >
                      {active ? <Archive /> : <RotateCcw />}
                      {active ? "Arquivar lead" : "Reabrir lead"}
                    </PopoverClose>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
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
                    onClick={() => setDialog("placement")}
                  >
                    <CalendarPlus />
                    {placements.length > 0 ? "Novo nivelamento" : "Agendar nivelamento"}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="compact-responsive"
                  onClick={() => setDialog("trial")}
                >
                  <CalendarPlus />
                  Agendar experimental
                </Button>
              </div>
            )}
          </div>
          <CandidateVisits candidate={candidate} />
        </section>
      </div>
      {dialog === "edit" && (
        <LeadCaptureDialog candidate={candidate} onClose={() => setDialog(null)} />
      )}
      {dialog === "trial" && <VisitDialog candidate={candidate} onClose={() => setDialog(null)} />}
      {dialog === "placement" && (
        <PlacementSchedule candidate={candidate} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function CandidateLoading(): ReactElement {
  return (
    <div className={styles.loading} aria-busy="true">
      <PencilLoader label="Carregando lead" />
    </div>
  );
}
