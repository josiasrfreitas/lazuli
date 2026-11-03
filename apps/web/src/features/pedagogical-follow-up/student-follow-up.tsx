"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { ArrowLeft, ClipboardList, Plus } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { QueryLoading } from "~/components/query-loading";
import { StudentAppointmentCarousel } from "~/features/appointments/student-carousel";
import { ScheduleAppointmentDialog } from "~/features/appointments/schedule-dialog";
import { OccurrenceForm } from "./occurrence-form";
import { StudentInterventionForm } from "./student-intervention-form";
import { DeskEmptyDetail } from "./student-desk-empty";
import { StudentDeskLoading } from "./student-desk-loading";
import { StudentDeskRail } from "./student-desk-rail";
import { DeskIntervention } from "./desk-intervention";
import { DeskOccurrence } from "./desk-occurrence";
import {
  parseFollowUpSelection,
  type FollowUpSelection,
  type SelectFollowUp,
} from "./student-navigation";
import styles from "./student-desk.module.css";
type Props = {
  studentId: string;
  studentName: string;
  canRecord: boolean;
  showAppointments?: boolean;
};
type Action = "schedule" | "occurrence" | "intervention" | null;
export function StudentFollowUp({
  studentId,
  studentName,
  canRecord,
  showAppointments = true,
}: Props): ReactElement {
  const [record, setRecord] = useQueryState("registro", parseAsString.withDefault(""));
  const [action, setAction] = useState<Action>(null);
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  const selection = parseFollowUpSelection(record);
  const select: SelectFollowUp = (next) => {
    void setRecord(`${next.kind}:${next.id}`);
  };
  const anchor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (globalThis.location.hash === "#acompanhamento")
      anchor.current?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <section id="acompanhamento" ref={anchor} className={styles.workspace}>
      {showAppointments && (
        <StudentAppointmentCarousel
          studentId={studentId}
          admin={admin && canRecord}
          hideEmpty={!canRecord}
          onSchedule={() => setAction("schedule")}
        />
      )}
      <StudentDesk
        studentId={studentId}
        canRecord={canRecord}
        heading={<DeskHeading admin={admin} canRecord={canRecord} open={setAction} />}
        selection={selection}
        select={select}
        create={() => setAction("occurrence")}
        clear={() => void setRecord(null)}
      />
      {canRecord && (
        <CreationDialog
          action={action}
          selection={selection}
          student={{ id: studentId, name: studentName }}
          close={() => setAction(null)}
          select={select}
        />
      )}
    </section>
  );
}
function DeskHeading({
  admin,
  canRecord,
  open,
}: {
  admin: boolean;
  canRecord: boolean;
  open: (action: Action) => void;
}): ReactElement {
  return (
    <header className={styles.heading}>
      <div>
        <h2>{canRecord ? "Acompanhamento pedagógico" : "Histórico pedagógico"}</h2>
        <p>
          {canRecord
            ? "Ocorrências, tratativas e evoluções do aluno."
            : "Registros anteriores disponíveis para consulta."}
        </p>
      </div>
      {canRecord && (
        <div className={styles.actions}>
          {admin && (
            <Button size="sm" variant="secondary" onClick={() => open("intervention")}>
              <ClipboardList aria-hidden="true" />
              Registrar intervenção
            </Button>
          )}
          <Button size="sm" onClick={() => open("occurrence")}>
            <Plus aria-hidden="true" />
            Registrar ocorrência
          </Button>
        </div>
      )}
    </header>
  );
}
type DeskProps = {
  studentId: string;
  canRecord: boolean;
  heading: ReactElement;
  selection: FollowUpSelection | null;
  select: SelectFollowUp;
  clear: () => void;
  create: () => void;
};
function StudentDesk({
  studentId,
  canRecord,
  heading,
  selection,
  select,
  clear,
  create,
}: DeskProps): ReactElement | null {
  const input = { studentId, search: "", page: 1 };
  const occurrences = trpc.occurrences.list.useQuery(input);
  const interventions = trpc.interventions.list.useQuery(input);
  const initializedStudent = useRef<string | null>(null);
  useEffect(() => {
    if (initializedStudent.current === studentId || !occurrences.data || !interventions.data)
      return;
    initializedStudent.current = studentId;
    if (selection) return;
    const firstOccurrence = occurrences.data.rows[0];
    const firstIntervention = interventions.data.rows[0];
    if (firstOccurrence) select({ kind: "occurrence", id: firstOccurrence.id });
    else if (firstIntervention) select({ kind: "intervention", id: firstIntervention.id });
  }, [studentId, occurrences.data, interventions.data, selection, select]);
  if (occurrences.isPending || interventions.isPending)
    return canRecord ? (
      <>
        {heading}
        <StudentDeskLoading selected={Boolean(selection)} />
      </>
    ) : (
      <QueryLoading label="Consultando histórico pedagógico" />
    );

  if (!canRecord && occurrences.data?.total === 0 && interventions.data?.total === 0) return null;
  return (
    <>
      {heading}
      <DeskWorkspace {...{ studentId, canRecord, selection, select, clear, create }} />
    </>
  );
}

function DeskWorkspace({
  studentId,
  canRecord,
  selection,
  select,
  clear,
  create,
}: Omit<DeskProps, "heading">): ReactElement {
  return (
    <div className={styles.deskContainer}>
      <div className={styles.desk} data-selected={Boolean(selection)}>
        <StudentDeskRail studentId={studentId} selected={selection} select={select} clear={clear} />
        <DeskDetail {...{ studentId, canRecord, selection, select, clear, create }} />
      </div>
    </div>
  );
}

function DeskDetail({
  studentId,
  canRecord,
  selection,
  select,
  clear,
  create,
}: Omit<DeskProps, "heading">): ReactElement {
  return (
    <section
      key={selection ? `${selection.kind}:${selection.id}` : "empty"}
      className={styles.detail}
      aria-label="Detalhe do registro"
      tabIndex={0}
    >
      {selection && (
        <div className={styles.mobileBack}>
          <Button size="sm" variant="ghost" onClick={clear}>
            <ArrowLeft aria-hidden="true" />
            Todos os registros
          </Button>
        </div>
      )}
      {selection?.kind === "intervention" && (
        <DeskIntervention
          id={selection.id}
          studentId={studentId}
          select={select}
          readOnly={!canRecord}
        />
      )}
      {selection?.kind === "occurrence" && (
        <DeskOccurrence
          id={selection.id}
          studentId={studentId}
          select={select}
          readOnly={!canRecord}
        />
      )}
      {!selection && (
        <DeskEmptyDetail
          studentId={studentId}
          create={create}
          select={select}
          readOnly={!canRecord}
        />
      )}
    </section>
  );
}
function CreationDialog({
  action,
  selection,
  student,
  close,
  select,
}: {
  action: Action;
  selection: FollowUpSelection | null;
  student: { id: string; name: string };
  close: () => void;
  select: SelectFollowUp;
}): ReactElement | null {
  if (action === "schedule") return <ScheduleAppointmentDialog student={student} onClose={close} />;
  if (action === "occurrence")
    return (
      <OccurrenceForm
        student={student}
        onClose={close}
        onCreated={(id) => select({ kind: "occurrence", id })}
      />
    );
  if (action === "intervention")
    return (
      <StudentInterventionForm
        student={student}
        initialOccurrenceIds={selection?.kind === "occurrence" ? [selection.id] : []}
        onClose={close}
        onCreated={(id) => select({ kind: "intervention", id })}
      />
    );
  return null;
}
