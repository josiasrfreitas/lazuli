"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import { Button, DataTable, Input, type DataTableState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { CloseMembershipDialog } from "./close-dialog";

type List = RouterOutputs["classes"]["roster"];
type Row = List["rows"][number];
type Situation = "CURRENT" | "SCHEDULED" | "PAUSED" | "ENDED" | "";
const DATE_LENGTH = 10;
function tableState(data: List | undefined, failed: boolean): DataTableState<Row> {
  if (failed) return { kind: "error" };
  if (!data) return { kind: "loading" };
  return data.rows.length > 0 ? { kind: "data", rows: data.rows } : { kind: "empty" };
}
function status(row: Row, today: string): string {
  if (row.entryDate.toISOString().slice(0, DATE_LENGTH) > today) return "Programada";
  const close = row.actions[0];
  if (close && close.effectiveDate.toISOString().slice(0, DATE_LENGTH) <= today)
    return "Aguardando execução";
  if (row.exitDate === null || row.exitDate.toISOString().slice(0, DATE_LENGTH) > today)
    return "Vigente";
  return row.exitReason === "SUSPENDED" ? "Pausada" : "Encerrada";
}
function rosterColumns(
  today: string,
  close: (row: Row) => void,
): Array<{ id: string; header: string; width?: "wide"; cell: (row: Row) => ReactNode }> {
  return [
    { id: "student", header: "Aluno", width: "wide", cell: (row) => row.student.fullName },
    { id: "stage", header: "Etapa", cell: (row) => row.progressRecords[0]?.stage.name ?? "—" },
    {
      id: "entry",
      header: "Entrada",
      cell: (row) => row.entryDate.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
    },
    { id: "status", header: "Situação", cell: (row) => status(row, today) },
    {
      id: "actions",
      header: "Ação",
      cell: (row) =>
        status(row, today) === "Vigente" ? (
          <Button size="sm" variant="secondary" onClick={() => close(row)}>
            Pausar ou encerrar
          </Button>
        ) : null,
    },
  ];
}
function RosterFilters({
  search,
  situation,
  changeSearch,
  changeSituation,
}: {
  search: string;
  situation: Situation;
  changeSearch: (value: string) => void;
  changeSituation: (value: Situation) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        aria-label="Buscar aluno na turma"
        size="sm"
        placeholder="Buscar aluno"
        value={search}
        onChange={(event) => changeSearch(event.target.value)}
      />
      <select
        aria-label="Situação do vínculo"
        className="h-control-sm rounded-sm border border-input bg-background px-2 text-control"
        value={situation}
        onChange={(event) => changeSituation(event.target.value as Situation)}
      >
        <option value="">Todas as situações</option>
        <option value="CURRENT">Vigente</option>
        <option value="SCHEDULED">Programada</option>
        <option value="PAUSED">Pausada</option>
        <option value="ENDED">Encerrada</option>
      </select>
    </div>
  );
}
function RosterTable({
  data,
  failed,
  refetch,
  page,
  setPage,
  close,
}: {
  data: List | undefined;
  failed: boolean;
  refetch: () => void;
  page: number;
  setPage: (value: number) => void;
  close: (row: Row) => void;
}): ReactElement {
  return (
    <DataTable
      label="Alunos da turma"
      columns={rosterColumns(data?.today ?? "", close)}
      state={tableState(data, failed)}
      onRetry={refetch}
      errorTitle="Não foi possível carregar os alunos"
      empty={{
        title: "Nenhum vínculo encontrado",
        description: "Ajuste os filtros ou matricule um aluno.",
      }}
      pagination={{
        page,
        pageSize: 20,
        pageCount: data?.pageCount ?? 1,
        totalItems: data?.total ?? 0,
        onPageChange: setPage,
        itemLabel: { singular: "vínculo", plural: "vínculos" },
      }}
    />
  );
}
export function RosterSection({ classId }: { classId: string }): ReactElement {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [situation, setSituation] = useState<Situation>("");
  const [closing, setClosing] = useState<{ id: string; studentName: string } | null>(null);
  const query = trpc.classes.roster.useQuery({
    id: classId,
    search,
    page,
    pageSize: 20,
    ...(situation ? { situation } : {}),
  });
  return (
    <section className="min-w-0 space-y-3">
      <h2 className="font-display text-h3 font-semibold">Alunos da turma</h2>
      <RosterFilters
        search={search}
        situation={situation}
        changeSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        changeSituation={(value) => {
          setSituation(value);
          setPage(1);
        }}
      />
      <div className="h-80 min-w-0">
        <RosterTable
          data={query.data}
          failed={query.isError}
          refetch={() => void query.refetch()}
          page={page}
          setPage={setPage}
          close={(row) => setClosing({ id: row.id, studentName: row.student.fullName })}
        />
      </div>
      <CloseMembershipDialog
        enrollment={closing}
        classId={classId}
        onOpenChange={(value) => {
          if (!value) setClosing(null);
        }}
      />
    </section>
  );
}
