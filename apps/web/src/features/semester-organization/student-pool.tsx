"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Button, DataTable, Input, TableFilters, type DataTableColumn } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { SemesterBoard } from "./shared";

const STUDENT_PAGE_SIZE = 20;
type Student = RouterOutputs["semesterOrganization"]["students"]["rows"][number];
export function StudentPool({
  board,
  readOnly,
  onOrganize,
}: {
  board: SemesterBoard;
  readOnly: boolean;
  onOrganize: (studentId: string) => void;
}): ReactJSX.Element {
  const [search, setSearch] = useState("");
  const [unassigned, setUnassigned] = useState(true);
  const [page, setPage] = useState(1);
  const query = trpc.semesterOrganization.students.useQuery({
    semesterId: board.semester.id,
    search,
    unassigned,
    page,
  });
  const columns: DataTableColumn<Student>[] = [
    {
      id: "name",
      header: "Aluno",
      width: "wide",
      cell: (row) => (
        <div className="grid gap-1">
          <span className="font-medium">{row.name}</span>
          {row.status !== "ACTIVE" && (
            <Badge variant="neutral">{row.status === "SUSPENDED" ? "Suspenso" : "Inativo"}</Badge>
          )}
        </div>
      ),
    },
    {
      id: "current",
      header: "Percurso atual",
      width: "wide",
      cell: (row) =>
        row.current.length > 0 ? (
          <div className="grid gap-1">
            {row.current.map((item) => (
              <div key={item.id}>
                <p>
                  {item.stageCode} · {item.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"}
                </p>
                <p className="text-caption text-muted-foreground">{item.className}</p>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">Sem vínculo vigente</span>
        ),
    },
    {
      id: "proposals",
      header: "Próximo semestre",
      width: "medium",
      cell: (row) => {
        const proposals = board.placements.filter((item) => item.studentId === row.id);
        return proposals.length > 0 ? (
          <div className="grid gap-1">
            {proposals.map((item) => (
              <span key={item.id}>
                {board.plans.find((plan) => plan.id === item.planId)?.name ?? "Ainda sem turma"}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">Sem proposta</span>
        );
      },
    },
    {
      id: "action",
      header: "",
      width: "narrow",
      cell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          disabled={readOnly}
          onClick={() => onOrganize(row.id)}
        >
          Organizar aluno
        </Button>
      ),
    },
  ];
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            name="organization-search"
            autoComplete="off"
            size="sm"
            aria-label="Buscar aluno"
            placeholder="Buscar aluno pelo nome"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <TableFilters
          fields={[
            {
              id: "unassigned",
              label: "Organização",
              kind: "options",
              promoted: true,
              options: [{ id: "yes", label: "Sem proposta neste semestre" }],
              selected: unassigned ? ["yes"] : [],
              onChange: (value) => {
                setUnassigned(value.includes("yes"));
                setPage(1);
              },
              onClear: () => {
                setUnassigned(false);
                setPage(1);
              },
            },
          ]}
          onClearAll={() => {
            setUnassigned(false);
            setPage(1);
          }}
        />
      </div>
      <DataTable
        label="Alunos a organizar"
        columns={columns}
        state={
          query.isPending
            ? { kind: "loading" }
            : query.error
              ? { kind: "error" }
              : query.data?.rows.length
                ? { kind: "data", rows: query.data.rows }
                : { kind: search ? "noResults" : "empty" }
        }
        onRetry={() => void query.refetch()}
        empty={{
          title: "Todos os alunos deste recorte foram organizados",
          description: "Remova o filtro para revisar propostas existentes.",
        }}
        errorTitle="Não foi possível carregar os alunos"
        pagination={{
          page,
          pageSize: 25,
          pageCount: Math.max(1, Math.ceil((query.data?.total ?? 0) / STUDENT_PAGE_SIZE)),
          totalItems: query.data?.total ?? 0,
          onPageChange: setPage,
          itemLabel: { singular: "aluno", plural: "alunos" },
        }}
      />
    </div>
  );
}
