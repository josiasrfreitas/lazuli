"use client";
import { useState, type ReactElement } from "react";
import { DataTable, type DataTableState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { CloseMembershipDialog } from "./close-dialog";
import { rosterColumns } from "./roster-columns";
import { RosterFilters, type RosterSituation } from "./roster-filters";

type List = RouterOutputs["classes"]["roster"];
type Row = List["rows"][number];

function tableState(data: List | undefined, failed: boolean): DataTableState<Row> {
  if (failed) return { kind: "error" };
  if (!data) return { kind: "loading" };
  return data.rows.length > 0 ? { kind: "data", rows: data.rows } : { kind: "empty" };
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
        ...(data ? { pageCount: data.pageCount, totalItems: data.total } : { loading: true }),
        onPageChange: setPage,
        itemLabel: { singular: "vínculo", plural: "vínculos" },
      }}
    />
  );
}
export function RosterSection({ classId }: { classId: string }): ReactElement {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [situations, setSituations] = useState<RosterSituation[]>([]);
  const [closing, setClosing] = useState<{ id: string; studentName: string } | null>(null);
  const query = trpc.classes.roster.useQuery({
    id: classId,
    search,
    page,
    pageSize: 20,
    situations,
  });
  return (
    <section className="min-w-0 space-y-3">
      <h2 className="font-display text-h3 font-semibold">Alunos da turma</h2>
      <RosterFilters
        search={search}
        situations={situations}
        changeSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        changeSituations={(value) => {
          setSituations(value);
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
