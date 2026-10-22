"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { ClassAgenda } from "~/features/class-records/agenda";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherQueryState } from "./shared";
import { TeacherListLoading } from "./list-loading";

export function TeacherAgenda(): ReactJSX.Element {
  return <ClassAgenda teacherView />;
}

export function TeacherPendingPage(): ReactJSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const query = trpc.teacherWorkspace.pending.useQuery();
  return (
    <TeacherPage
      title="Aulas por registrar"
      description="O registro continua disponível mesmo depois do dia da aula."
      back="/professor"
    >
      <TeacherQueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        loading={<TeacherListLoading label="Carregando aulas por registrar" />}
      />
      {query.data && (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {query.data.map((row) => (
            <button
              key={row.id}
              className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted"
              onClick={() => setSelected(row.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{row.className}</p>
                <p className="mt-1 text-caption text-muted-foreground">
                  {formatDateOnlyBR(row.date)} · {row.startTime}–{row.endTime}
                </p>
              </div>
              <ArrowRight className="size-4" />
            </button>
          ))}
          {query.data.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">
              Todos os registros de aula estão em dia.
            </p>
          )}
        </div>
      )}
      {selected && <ClassRecordDialog id={selected} onClose={() => setSelected(null)} />}
    </TeacherPage>
  );
}
