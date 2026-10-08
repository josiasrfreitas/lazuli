"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge, DataTable } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatClassScheduleTime } from "../classes/labels";
export function TeacherClasses({ teacherId, back }: { teacherId: string; back: string }) {
  const [page, setPage] = useState(1);
  const query = trpc.teachers.classes.useQuery({ id: teacherId, page, pageSize: 10 });
  return (
    <section className="grid gap-3 border-t border-border pt-5" aria-label="Turmas vinculadas">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-control font-semibold">Turmas vinculadas</h2>
        <p className="text-caption text-muted-foreground">
          Inclui vínculos atuais, programados e históricos
        </p>
      </div>
      <div className="h-64">
        <DataTable
          label="Turmas do professor"
          columns={[
            {
              id: "class",
              header: "Turma",
              width: "wide",
              cell: (row) => (
                <Link
                  className="font-medium underline-offset-4 hover:underline"
                  href={`/turmas/${row.id}?voltar=${encodeURIComponent(back)}`}
                >
                  {row.internalCode}
                </Link>
              ),
            },
            {
              id: "semester",
              header: "Semestre",
              width: "standard",
              cell: (row) => row.semester.name,
            },
            {
              id: "schedule",
              header: "Horários",
              width: "wide",
              cell: (row) => formatClassScheduleTime(row.scheduleSlots),
            },
            {
              id: "status",
              header: "Situação da turma",
              width: "standard",
              cell: (row) => (
                <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>
                  {row.status === "ACTIVE" ? "Ativa" : "Arquivada"}
                </Badge>
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
          errorTitle="Não foi possível carregar as turmas"
          onRetry={() => void query.refetch()}
          empty={{
            title: "Nenhuma turma vinculada",
            description: "Atribua este professor na criação ou manutenção de uma turma.",
          }}
          pagination={{
            page: query.data?.page ?? page,
            pageSize: 10,
            ...(query.data
              ? { totalItems: query.data.total, pageCount: query.data.pageCount }
              : { loading: true }),
            onPageChange: setPage,
            itemLabel: { singular: "turma", plural: "turmas" },
          }}
        />
      </div>
    </section>
  );
}
