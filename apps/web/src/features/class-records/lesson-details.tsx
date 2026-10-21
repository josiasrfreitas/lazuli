"use client";
import { useState, type ReactElement } from "react";
import { History } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { ClassRecordHistory } from "./history";
import { RecordAttendance } from "./record-attendance";
import { kindLabels, type ClassRecord } from "./shared";
import type { ClassRecordContent } from "@lazuli/validators";
import styles from "./class-record-dialog.module.css";
export function LessonDetails({ data }: { data: ClassRecord }): ReactElement {
  const [appointment, setAppointment] = useState<string | null>(null);
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  return (
    <div className={styles.body}>
      {data.session.cancelled && (
        <Alert>
          Esta aula foi cancelada.{data.session.cancelReason ? ` ${data.session.cancelReason}` : ""}
        </Alert>
      )}
      <RecordAttendance data={data} teacher={!admin} onAppointment={setAppointment} />
      <LessonPerformed data={data} admin={admin} />
      {data.session.scheduleType === "REGULAR" && data.snapshot.note && (
        <section className={styles.note}>
          <h3>Observação da aula</h3>
          <p>{data.snapshot.note}</p>
        </section>
      )}
      <LessonHistory data={data} admin={admin} />
      {appointment && (
        <StudentAppointmentDialog
          key={appointment}
          id={appointment}
          admin={admin}
          onClose={() => setAppointment(null)}
          onSelect={setAppointment}
        />
      )}
    </div>
  );
}
function LessonPerformed({
  data,
  admin,
}: {
  data: ClassRecord;
  admin: boolean;
}): ReactElement | null {
  if (admin || data.version <= 0) return null;
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
function LessonHistory({
  data,
  admin,
}: {
  data: ClassRecord;
  admin: boolean;
}): ReactElement | null {
  const [history, setHistory] = useState(false);
  if ((data.session.scheduleType !== "REGULAR" && admin) || data.version <= 0) return null;
  return (
    <section className={styles.history}>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={history}
        onClick={() => setHistory(!history)}
      >
        <History aria-hidden="true" />
        {history ? "Fechar histórico" : "Histórico do registro"}
      </Button>
      {history && <ClassRecordHistory sessionId={data.session.id} />}
    </section>
  );
}
function PerformedContent({
  title,
  content,
}: {
  title: string;
  content: ClassRecordContent;
}): ReactElement {
  return (
    <div className="grid gap-2 rounded-md border border-border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-caption text-muted-foreground">
        {kindLabels[content.kind]}
        {content.reference ? ` · ${content.reference}` : ""}
        {pageLabel(content)}
      </p>
      {content.planItemId && (
        <p className="text-caption">
          {content.planItemTitle ?? "Etapa do planejamento"} ·{" "}
          {content.planItemStatus === "COMPLETED" ? "Concluída" : "Em andamento"}
        </p>
      )}
      <p className="whitespace-pre-wrap text-sm">{content.account}</p>
    </div>
  );
}
function pageLabel(content: ClassRecordContent): string {
  if (content.pageFrom === null) return "";
  const last =
    content.pageTo !== null && content.pageTo !== content.pageFrom ? `–${content.pageTo}` : "";
  return ` · Pág. ${content.pageFrom}${last}`;
}
