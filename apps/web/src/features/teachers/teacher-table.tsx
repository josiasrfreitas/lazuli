"use client";
import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, DataTable } from "@lazuli/ui";
import { tablePaginationPropsFor, type UrlPagination } from "~/lib/pagination";
import { TeacherStatus } from "./teacher-status";
export function TeacherTable({
  data,
  isError,
  isFetching,
  filtered,
  pagination,
  href,
  onOpen,
  onRetry,
}: {
  data: RouterOutputs["teachers"]["list"] | undefined;
  isError: boolean;
  isFetching: boolean;
  filtered: boolean;
  pagination: UrlPagination;
  href: (id: string) => string;
  onOpen: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <DataTable
      label="Professores"
      columns={[
        {
          id: "name",
          header: "Professor",
          width: "wide",
          cell: (row) => (
            <Link href={href(row.id)} className="font-medium underline-offset-4 hover:underline">
              {row.name}
            </Link>
          ),
        },
        {
          id: "email",
          header: "E-mail",
          width: "wide",
          cell: (row) => <span className="break-all text-muted-foreground">{row.email}</span>,
        },
        {
          id: "classes",
          header: "Turmas",
          width: "standard",
          numeric: true,
          cell: (row) => (
            <span className="font-numeric tabular-nums" title="Turmas atuais sob responsabilidade do professor">
              {row.classCount}
            </span>
          ),
        },
        {
          id: "activity",
          header: "Atuação",
          width: "wide",
          cell: (row) => (
            <TeacherStatus
              departure={row.teacherProfile?.departureDate}
              today={data?.today ?? ""}
            />
          ),
        },
        {
          id: "access",
          header: "Acesso ao sistema",
          width: "standard",
          cell: (row) => {
            const enabled =
              row.isEnabled &&
              (!row.teacherProfile?.departureDate ||
                row.teacherProfile.departureDate.toISOString().slice(0, 10) > (data?.today ?? ""));
            return (
              <Badge variant={enabled ? "success" : "neutral"}>
                {enabled ? "Habilitado" : "Não habilitado"}
              </Badge>
            );
          },
        },
      ]}
      state={
        isError
          ? { kind: "error" }
          : !data
            ? { kind: "loading" }
            : data.rows.length
              ? { kind: "data", rows: data.rows }
              : { kind: filtered ? "noResults" : "empty" }
      }
      onRowClick={(row) => onOpen(row.id)}
      onRetry={onRetry}
      updating={isFetching}
      errorTitle="Não foi possível carregar os professores"
      empty={{
        title: "Nenhum professor cadastrado",
        description:
          "Cadastre um professor para começar a organizar as turmas. O acesso ao sistema é opcional.",
      }}
      pagination={{
        ...tablePaginationPropsFor(pagination, data),
        itemLabel: { singular: "professor", plural: "professores" },
      }}
    />
  );
}
