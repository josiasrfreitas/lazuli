"use client";
import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import type { DataTableColumn, DataTableState } from "@lazuli/ui";
import { Plus } from "lucide-react";
import {
  Button,
  DataTable,
  DataTablePage,
  TableFilters,
  type TableFilterField,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { useUrlPagination, tablePaginationPropsFor } from "~/lib/pagination";
import { TeacherDialog } from "./teacher-dialog";
import { TeacherStatus } from "./teacher-status";
import { AREA_LABELS } from "./employee-labels";
import { TableSearch } from "~/components/table-search";

export function EmployeesPage(): ReactElement {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const pagination = useUrlPagination(studentPaginationPolicy);
  const [areas, setAreas] = useState<(keyof typeof AREA_LABELS)[]>([]);
  const [profile, setProfile] = useState<string[]>([]);
  const fields: TableFilterField[] = [
    {
      id: "area",
      label: "Área",
      kind: "options",
      options: Object.entries(AREA_LABELS).map(([id, label]) => ({ id, label })),
      selected: areas,
      onChange: (values) => {
        setAreas(
          values.filter((value): value is keyof typeof AREA_LABELS =>
            Object.hasOwn(AREA_LABELS, value),
          ),
        );
        pagination.setPage(1);
      },
      onClear: () => {
        setAreas([]);
        pagination.setPage(1);
      },
    },
    {
      id: "profile",
      label: "Perfil docente",
      kind: "options",
      selectionMode: "single",
      options: [
        { id: "with", label: "Com perfil docente" },
        { id: "without", label: "Sem perfil docente" },
      ],
      selected: profile,
      onChange: (values) => {
        setProfile(values);
        pagination.setPage(1);
      },
      onClear: () => {
        setProfile([]);
        pagination.setPage(1);
      },
    },
  ];
  const query = trpc.employees.list.useQuery({
    search,
    areas,
    hasTeacherProfile: profile.length ? profile[0] === "with" : undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const data = query.data;
  return (
    <>
      <DataTablePage
        title="Colaboradores"
        summary={data ? `${data.total} colaboradores` : undefined}
        controls={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-56">
              <TableSearch
                name="employee-search"
                label="Buscar colaborador"
                placeholder="Buscar por nome"
                value={search}
                onCommit={(value) => {
                  setSearch(value);
                  pagination.setPage(1);
                }}
              />
            </div>
            <TableFilters
              fields={fields}
              onClearAll={() => {
                setAreas([]);
                setProfile([]);
                pagination.setPage(1);
              }}
            />
            <Button size="compact-responsive" onClick={() => setSelected("new")}>
              <Plus />
              Novo colaborador
            </Button>
          </div>
        }
      >
        <DataTable
          errorTitle="Não foi possível carregar os colaboradores"
          label="Colaboradores"
          columns={employeeColumns({ setSelected, today: data?.today ?? "" })}
          onRowClick={(row) => setSelected(row.id)}
          state={employeeState({
            data,
            filtered: Boolean(search || areas.length || profile.length),
            isError: query.isError,
          })}
          empty={{
            title: "Nenhum colaborador cadastrado",
            description: "Cadastre a primeira pessoa da equipe.",
          }}
          onRetry={() => void query.refetch()}
          pagination={{
            ...tablePaginationPropsFor(pagination, data),
            itemLabel: { singular: "colaborador", plural: "colaboradores" },
          }}
        />
      </DataTablePage>
      {selected === "new" && <TeacherDialog onClose={() => setSelected(null)} />}
      {selected && selected !== "new" && (
        <EditEmployee key={selected} id={selected} close={() => setSelected(null)} />
      )}
    </>
  );
}
type EmployeeList = RouterOutputs["employees"]["list"];
type EmployeeRow = EmployeeList["rows"][number];
function employeeState({
  data,
  filtered,
  isError,
}: {
  data: EmployeeList | undefined;
  filtered: boolean;
  isError: boolean;
}): DataTableState<EmployeeRow> {
  if (isError) return { kind: "error" };
  if (!data) return { kind: "loading" };
  if (data.rows.length > 0) return { kind: "data", rows: data.rows };
  return { kind: filtered ? "noResults" : "empty" };
}
function employeeColumns({
  setSelected,
  today,
}: {
  setSelected: (id: string) => void;
  today: string;
}): DataTableColumn<EmployeeRow>[] {
  return [
    {
      id: "name",
      header: "Nome",
      width: "wide",
      cell: (row) => (
        <button
          type="button"
          className="text-left font-medium hover:underline"
          onClick={() => setSelected(row.id)}
        >
          {row.name}
        </button>
      ),
    },
    {
      id: "area",
      header: "Área",
      cell: (row) =>
        row.employeeProfile?.area ? AREA_LABELS[row.employeeProfile.area] : "A preencher",
    },
    {
      id: "job",
      header: "Cargo",
      cell: (row) => row.employeeProfile?.jobTitle || "A preencher",
    },
    { id: "email", header: "E-mail", width: "wide", cell: (row) => row.email },
    {
      id: "teaches",
      header: "Atuação docente",
      cell: (row) =>
        row.teacherProfile && !row.teacherProfile.deletedAt ? (
          <TeacherStatus departure={row.teacherProfile.departureDate} today={today} />
        ) : (
          "Sem perfil"
        ),
    },
  ];
}
function EditEmployee({ id, close }: { id: string; close: () => void }): ReactElement {
  const query = trpc.employees.byId.useQuery({ id });
  if (query.data) return <TeacherDialog teacher={query.data} onClose={close} />;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastro do colaborador</DialogTitle>
            <DialogDescription role="status">
              {query.error ? query.error.message : "Abrindo cadastro…"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={close}>
              Fechar
            </Button>
            {query.error && <Button onClick={() => void query.refetch()}>Tentar novamente</Button>}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
