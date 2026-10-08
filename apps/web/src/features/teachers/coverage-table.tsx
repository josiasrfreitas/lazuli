"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge, Button, DataTable } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { tablePaginationPropsFor, type UrlPagination } from "~/lib/pagination";
import { MeetingDialog, type Meeting } from "./meeting-dialog";
import { dateLabel } from "./format";
export function CoverageTable({ pagination }: { pagination: UrlPagination }) {
  const query = trpc.teachers.uncovered.useQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  return (
    <>
      <DataTable
        label="Pendências de docente"
        columns={[
          {
            id: "class",
            header: "Turma",
            width: "wide",
            cell: (row) => (
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={`/turmas/${row.classId}?voltar=${encodeURIComponent("/professores?pendencias=docente")}`}
              >
                {row.classCode}
              </Link>
            ),
          },
          {
            id: "date",
            header: "Encontro",
            width: "medium",
            cell: (row) => (
              <div>
                {dateLabel(row.date)}
                <p className="text-caption text-muted-foreground">
                  {row.startTime}–{row.endTime}
                </p>
              </div>
            ),
          },
          {
            id: "state",
            header: "Cobertura",
            width: "medium",
            cell: (row) => (
              <div className="grid gap-1">
                <Badge variant="warning">Sem professor</Badge>
                {row.requiresCoverage && (
                  <span className="text-caption text-muted-foreground">Substituição desfeita</span>
                )}
              </div>
            ),
          },
          {
            id: "actions",
            header: "Resolver",
            width: "standard",
            cell: (row) => (
              <Button size="compact-responsive" variant="secondary" onClick={() => setMeeting(row)}>
                Cobrir encontro
              </Button>
            ),
          },
        ]}
        state={
          query.isError
            ? { kind: "error" }
            : !query.data
              ? { kind: "loading" }
              : query.data.rows.length
                ? { kind: "data", rows: query.data.rows }
                : { kind: "empty" }
        }
        empty={{
          title: "Nenhuma pendência de docente",
          description:
            "Todos os compromissos previstos têm cobertura. Novas saídas programadas aparecerão aqui.",
        }}
        errorTitle="Não foi possível carregar as pendências"
        onRetry={() => void query.refetch()}
        updating={query.isFetching}
        pagination={{
          ...tablePaginationPropsFor(pagination, query.data),
          itemLabel: { singular: "encontro", plural: "encontros" },
        }}
      />
      {meeting && (
        <MeetingDialog
          meeting={meeting}
          back="/professores?pendencias=docente"
          onClose={() => setMeeting(null)}
        />
      )}
    </>
  );
}
