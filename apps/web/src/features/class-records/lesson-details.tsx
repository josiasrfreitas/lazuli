"use client";

import type { JSX as ReactJSX } from "react";
import { useState, type ReactElement } from "react";
import { History } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { CalendarExperimentalDialog } from "./calendar-experimental-dialog";
import { ClassRecordHistory } from "./history";
import { RecordAttendance } from "./record-attendance";
import type { ClassRecord } from "./shared";
import { kindLabels } from "./shared";
import type { ClassRecordContent } from "@lazuli/validators";
import styles from "./class-record-dialog.module.css";

export function LessonDetails({ data }: { data: ClassRecord }): ReactElement {
  const [appointment, setAppointment] = useState<string | null>(null);
  const [experimental, setExperimental] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
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
        teacher={!admin}
        onAppointment={setAppointment}
        onExperimental={setExperimental}
      />
      {!admin && data.version > 0 && (
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
      )}
      {data.session.scheduleType === "REGULAR" && data.snapshot.note && (
        <section className={styles.note}>
          <h3>Observação da aula</h3>
          <p>{data.snapshot.note}</p>
        </section>
      )}
      {(data.session.scheduleType === "REGULAR" || !admin) && data.version > 0 && (
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
      )}
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
    </div>
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
