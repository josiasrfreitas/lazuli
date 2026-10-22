"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { sessionEndInstant } from "@lazuli/domain";
import type { Candidate } from "~/features/admissions/labels";
import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogPortal,
  PencilLoader,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { LeadCaptureDialog } from "~/features/admissions/lead-capture-dialog";
import { OutcomeDialog } from "~/features/admissions/visit-outcome";
import { PlacementVisitDialog } from "~/features/admissions/placement-assessment";
import { TeacherVisitDialog } from "~/features/teacher-workspace/visits";
import { RecordState } from "./shared";
import {
  ExperimentalBodyContent,
  ExperimentalFooter,
  ExperimentalHeader,
  type ExperimentalVisit,
  type VisitRecord,
  type VisitStatus,
} from "./calendar-experimental-sections";
import styles from "./calendar-experimental-dialog.module.css";

export function CalendarExperimentalDialog({
  visit,
  admin,
  onClose,
}: {
  visit: ExperimentalVisit;
  admin: boolean;
  onClose: () => void;
}): ReactElement {
  if (!admin) return <TeacherVisitDialog id={visit.id} onClose={onClose} />;
  if (visit.kind === "PLACEMENT")
    return (
      <PlacementVisitDialog candidateId={visit.candidate.id} visitId={visit.id} onClose={onClose} />
    );
  return <ExperimentalDetails visit={visit} onClose={onClose} />;
}

function ExperimentalDetails({
  visit,
  onClose,
}: {
  visit: ExperimentalVisit;
  onClose: () => void;
}): ReactElement {
  const [editing, setEditing] = useState<"contact" | "outcome" | null>(null);
  const query = trpc.admissions.byId.useQuery({ id: visit.candidate.id }, { retry: false });
  const lead = query.data;
  const record = lead?.visits.find((item) => item.id === visit.id);
  const status = record?.status ?? visit.status;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !editing) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <ExperimentalPanel
          visit={visit}
          lead={lead}
          record={record}
          status={status}
          editing={editing}
          setEditing={setEditing}
          onClose={onClose}
          loading={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
      </DialogPortal>
    </Dialog>
  );
}

type PanelProps = {
  visit: ExperimentalVisit;
  lead: Candidate | undefined;
  record: VisitRecord | undefined;
  status: VisitStatus;
  editing: "contact" | "outcome" | null;
  setEditing: (value: "contact" | "outcome" | null) => void;
  onClose: () => void;
  loading: boolean;
  error: { message: string } | null;
  retry: () => void;
};

function ExperimentalPanel(props: PanelProps): ReactElement {
  const { visit, lead, record, status, setEditing, onClose, loading, error, retry } = props;
  return (
    <DialogContent className="md:max-w-4xl md:w-[calc(100%-2rem)]">
      <ExperimentalHeader
        visit={visit}
        lead={lead}
        status={status}
        pending={status === "SCHEDULED" && visit.overdue}
      />
      <DialogBody>
        <ExperimentalBodyContent
          visit={visit}
          record={record}
          lead={lead}
          onEditContact={() => setEditing("contact")}
        />
        {loading && (
          <div className={styles.loading}>
            <PencilLoader size="sm" label="Carregando dados do lead" />
          </div>
        )}
        <RecordState pending={false} error={error} retry={retry} />
      </DialogBody>
      <ExperimentalFooter
        visit={visit}
        admin
        status={status}
        canRecord={canRecordVisit(record, status)}
        onClose={onClose}
        onRecord={() => setEditing("outcome")}
      />
      <ExperimentalEditDialogs {...props} />
    </DialogContent>
  );
}

function ExperimentalEditDialogs({ lead, record, editing, setEditing }: PanelProps): ReactElement {
  return (
    <>
      {lead?.status === "WAITING" && editing === "contact" && (
        <LeadCaptureDialog candidate={lead} onClose={() => setEditing(null)} />
      )}
      {record && editing === "outcome" && (
        <OutcomeDialog visit={record} cancel={false} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function canRecordVisit(record: VisitRecord | undefined, status: VisitStatus): boolean {
  if (!record || status === "CANCELLED" || record.needsReschedule) return false;
  return sessionEndInstant({ date: record.date, endTime: record.startTime }) <= new Date();
}
