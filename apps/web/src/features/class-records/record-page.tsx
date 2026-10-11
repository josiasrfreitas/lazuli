"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert, Badge, Button, Tabs, TabsList, TabsTab } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ClassRecordEditor } from "./editor";
import { ClassRecordHistory } from "./history";
import { dateLabel, RecordState, SnapshotView, PlannedReference, type ClassRecord } from "./shared";
export function ClassRecordPage({ id }: { id: string }): ReactElement {
  const query = trpc.classRecords.detail.useQuery({ sessionId: id }, { retry: false });
  return (
    <div
      id="class-record-scroll"
      className="mx-auto grid h-full w-full max-w-6xl content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8"
    >
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/aulas" />}>
          <ArrowLeft />
          Aulas
        </Button>
      </div>
      <RecordState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && <RecordContent key={id} data={query.data} />}
    </div>
  );
}
function RecordContent({ data }: { data: ClassRecord }): ReactElement {
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState("record");
  const editorOpen = !data.restriction && (data.version === 0 || editing);
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="grid gap-2">
          <span className="text-caption text-muted-foreground">
            {dateLabel(data.session.date)} · {data.session.startTime}–{data.session.endTime}
          </span>
          <h1 className="font-display text-h2 font-semibold text-heading">
            {data.session.className}
          </h1>
          <p className="text-caption text-muted-foreground">
            {data.session.teacher ?? "Professor a definir"} ·{" "}
            {data.session.scheduleType === "REGULAR"
              ? "Registro compartilhado"
              : "Registro individual · PPT"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={data.version ? "success" : "neutral"}>
            {data.session.cancelled
              ? "Cancelada"
              : data.version
                ? `Com baixa · versão ${data.version}`
                : data.session.upcoming
                  ? "Prevista"
                  : "A registrar"}
          </Badge>
          {data.version > 0 && !data.restriction && !editorOpen && (
            <Button
              variant="secondary"
              onClick={() => {
                setView("record");
                setEditing(true);
              }}
            >
              Corrigir registro
            </Button>
          )}
        </div>
      </header>
      {data.restriction && (
        <Alert>
          {data.restriction}
          {data.session.cancelReason ? ` ${data.session.cancelReason}` : ""}
        </Alert>
      )}
      {editorOpen ? (
        <ClassRecordEditor
          data={data}
          onClose={() => {
            setEditing(false);
            document.getElementById("class-record-scroll")?.scrollTo({ top: 0 });
          }}
        />
      ) : data.version > 0 ? (
        <>
          <Tabs variant="underline" value={view} onValueChange={setView}>
            <TabsList aria-label="Registro da aula">
              <TabsTab value="record">Registro atual</TabsTab>
              <TabsTab value="history">Histórico · {data.version}</TabsTab>
            </TabsList>
          </Tabs>
          {view === "record" ? (
            <SnapshotView snapshot={data.snapshot} />
          ) : (
            <ClassRecordHistory sessionId={data.session.id} />
          )}
        </>
      ) : !data.session.cancelled ? (
        <div className="grid gap-5">
          {data.attendanceOnly ? (
            <>
              <p className="text-sm text-muted-foreground">
                A chamada foi confirmada; o conteúdo ainda aguarda registro.
              </p>
              <SnapshotView snapshot={data.snapshot} />
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold">
                Alunos previstos · {data.snapshot.entries.length}
              </h2>
              <ul className="grid gap-2 text-sm">
                {data.snapshot.entries.map((row) => (
                  <li key={row.enrollmentId}>
                    {row.name}
                    {row.stage ? ` · ${row.stage}` : ""}
                  </li>
                ))}
              </ul>
              <PlannedReference value={data.snapshot.sharedPlanned} />
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
