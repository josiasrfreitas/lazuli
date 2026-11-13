"use client";
import { recordedActivities } from "@lazuli/domain";

import type { JSX as ReactJSX } from "react";
import {
  useState,
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Alert } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { CalendarExperimentalDialog } from "./calendar-experimental-dialog";
import { RecordAttendance } from "./record-attendance";
import type { ClassRecord } from "./shared";
import { kindLabels } from "./shared";
import type { ClassRecordContent } from "@lazuli/validators";
import styles from "./class-record-dialog.module.css";

export function LessonDetails({
  data,
  content,
  compactHeading = false,
}: {
  data: ClassRecord;
  content?: ReactNode;
  compactHeading?: boolean;
}): ReactElement {
  const [appointment, setAppointment] = useState<string | null>(null);
  const [experimental, setExperimental] = useState<string | null>(null);
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  const visit = data.leadGuests.find((item) => item.id === experimental);
  return (
    <div className={styles.body}>
      {data.session.cancelled && (
        <Alert>
          Esta aula foi cancelada.{data.session.cancelReason ? ` ${data.session.cancelReason}` : ""}
        </Alert>
      )}
      <RecordAttendance
        data={data}
        compactHeading={compactHeading}
        content={content}
        teacher={!admin}
        onAppointment={setAppointment}
        onExperimental={setExperimental}
      />
      <div className={styles.body}>
        <LessonPerformedContent data={data} admin={admin} />
        <LessonNote data={data} />
      </div>
      <LessonDialogs
        appointment={appointment}
        visit={visit}
        admin={admin}
        setAppointment={setAppointment}
        setExperimental={setExperimental}
      />
    </div>
  );
}

function LessonNote({ data }: { data: ClassRecord }): ReactElement | null {
  if (data.session.scheduleType !== "REGULAR" || !data.snapshot.note) return null;
  return (
    <section className={styles.note}>
      <h3>Observação da aula</h3>
      <p>{data.snapshot.note}</p>
    </section>
  );
}

function LessonPerformedContent({
  data,
  admin,
}: {
  data: ClassRecord;
  admin: boolean;
}): ReactJSX.Element | null {
  if (admin || data.version === 0) return null;
  return (
    <section className="grid gap-4" aria-label="Conteúdo realizado">
      {data.snapshot.sharedContent && (
        <PerformedContent title="Realizado pela turma" content={data.snapshot.sharedContent} />
      )}
      {data.session.scheduleType === "PERSONALIZED" &&
        data.snapshot.entries
          .filter((row) => row.content)
          .map((row) => (
            <PerformedContent key={row.enrollmentId} title={row.name} content={row.content!} />
          ))}
    </section>
  );
}

function LessonDialogs({
  appointment,
  visit,
  admin,
  setAppointment,
  setExperimental,
}: {
  appointment: string | null;
  visit: ClassRecord["leadGuests"][number] | undefined;
  admin: boolean;
  setAppointment: Dispatch<SetStateAction<string | null>>;
  setExperimental: Dispatch<SetStateAction<string | null>>;
}): ReactJSX.Element {
  return (
    <>
      {appointment && (
        <StudentAppointmentDialog
          key={appointment}
          id={appointment}
          admin={admin}
          onClose={() => setAppointment(null)}
          onSelect={setAppointment}
        />
      )}
      {visit && (
        <CalendarExperimentalDialog
          visit={visit}
          admin={admin}
          onClose={() => setExperimental(null)}
        />
      )}
    </>
  );
}

function PerformedContent({
  title,
  content,
}: {
  title: string;
  content: ClassRecordContent;
}): ReactJSX.Element {
  return (
    <div className="grid gap-2 rounded-md border border-border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-caption text-muted-foreground">
        {kindLabels[content.kind]}
        {content.reference ? ` · ${content.reference}` : ""}
        {content.pageFrom === null
          ? ""
          : ` · Pág. ${content.pageFrom}${content.pageTo !== null && content.pageTo !== content.pageFrom ? `–${content.pageTo}` : ""}`}
      </p>
      {recordedActivities(content).map((item) => (
        <p key={item.id} className="text-caption">
          {item.title ?? "Conteúdo do planejamento"} ·{" "}
          {item.status === "COMPLETED"
            ? "Concluído"
            : item.status === "PARTIAL"
              ? "Em andamento"
              : "Sem conclusão informada"}
        </p>
      ))}
      <p className="whitespace-pre-wrap text-sm">{content.account}</p>
    </div>
  );
}
