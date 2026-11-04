"use client";
import { StudentAttendanceSection } from "~/features/student-attendance/staff-section";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { Alert, Badge, Button, type BadgeVariant } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ClassRecordEditor } from "./editor";
import { RecordState, SnapshotView, dateLabel, type ClassRecord } from "./shared";

const DECLARATION_POLL_MS = 5000;
export function ClassRecordPage({ id }: { id: string }): ReactElement {
  const query = trpc.classRecords.detail.useQuery(
    { sessionId: id },
    {
      retry: false,
      refetchInterval: (query) => (query.state.data?.version === 0 ? DECLARATION_POLL_MS : false),
    },
  );
  const [editing, setEditing] = useState(false);
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-7xl content-start gap-5 p-4 sm:p-6">
      <Link className="w-fit text-caption text-interactive hover:underline" href="/aulas">
        Voltar para Aulas
      </Link>
      <RecordState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <>
          <RecordHeader data={query.data} />
          <StudentAttendanceSection sessionId={id} />
          {query.data.restriction && <Alert>{query.data.restriction}</Alert>}
          {editing ? (
            <ClassRecordEditor key={id} data={query.data} onClose={() => setEditing(false)} />
          ) : (
            <>
              <RecordAction data={query.data} start={() => setEditing(true)} />
              <AttendanceHint data={query.data} />
              <SnapshotView
                snapshot={query.data.snapshot}
                draft={!query.data.version && !query.data.attendanceOnly}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
function RecordHeader({ data }: { data: ClassRecord }): ReactElement {
  const badge = recordBadge(data);
  return (
    <header className="grid gap-2 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-h1 text-heading">{data.session.className}</h1>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <p>
        {dateLabel(data.session.date)} · {data.session.startTime}–{data.session.endTime} ·{" "}
        {data.session.teacher ?? "Sem professor"}
      </p>
      {data.recordedAt && (
        <p className="text-caption text-muted-foreground">
          Registro em {data.recordedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>
      )}
    </header>
  );
}

function recordBadge(data: ClassRecord): { variant: BadgeVariant; label: string } {
  if (data.session.cancelled) return { variant: "neutral", label: "Cancelada" };
  if (data.version) return { variant: "success", label: "Registrada" };
  if (data.session.upcoming) return { variant: "neutral", label: "Prevista" };
  return { variant: "warning", label: "Pendente de registro" };
}

function RecordAction({
  data,
  start,
}: {
  data: ClassRecord;
  start: () => void;
}): ReactElement | null {
  if (data.restriction) return null;
  return (
    <div>
      <Button variant={data.version ? "secondary" : "primary"} onClick={start}>
        {data.version ? "Corrigir registro" : "Registrar aula"}
      </Button>
    </div>
  );
}

function AttendanceHint({ data }: { data: ClassRecord }): ReactElement | null {
  if (data.version) return null;
  return (
    <Alert>
      {data.attendanceOnly
        ? "A frequência já foi confirmada. Falta registrar o conteúdo realizado."
        : "A chamada ainda não foi confirmada. A presença exibida é uma prévia para revisão."}
    </Alert>
  );
}
