"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  Button,
  DataTablePage,
  Input,
  TableFilters,
  TableFilterChips,
  SegmentedControl,
  SegmentedControlItem,
  type TableFilterField,
} from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { useUrlPagination } from "~/lib/pagination";
import { TeacherDialog } from "./teacher-dialog";
import { TeacherTable } from "./teacher-table";
import { CoverageTable } from "./coverage-table";

const activity = ["all", "active", "scheduled", "departed"] as const;
const access = ["all", "enabled", "disabled"] as const;
export function TeachersPage() {
  const [params, setParams] = useQueryStates({
    busca: parseAsString.withDefault(""),
    atuacao: parseAsStringLiteral(activity).withDefault("all"),
    acesso: parseAsStringLiteral(access).withDefault("all"),
    pendencias: parseAsString.withDefault(""),
  });
  const pagination = useUrlPagination(studentPaginationPolicy);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);
  const isCoverage = params.pendencias === "docente";
  const query = trpc.teachers.list.useQuery(
    {
      search: params.busca,
      active: params.atuacao,
      access: params.acesso,
      page: pagination.page,
      pageSize: pagination.pageSize,
    },
    { enabled: !isCoverage },
  );
  const fields: TableFilterField[] = [
    {
      id: "activity",
      kind: "options",
      label: "Atuação",
      promoted: true,
      options: [
        { id: "active", label: "Em atuação" },
        { id: "scheduled", label: "Saída programada" },
        { id: "departed", label: "Atuação encerrada" },
      ],
      selected: params.atuacao === "all" ? [] : [params.atuacao],
      onClear: () => {
        void setParams({ atuacao: "all" });
        pagination.setPage(1);
      },
      onChange: (values) => {
        const last = values.at(-1);
        void setParams({
          atuacao: last === "active" || last === "scheduled" || last === "departed" ? last : "all",
        });
        pagination.setPage(1);
      },
    },
    {
      id: "access",
      kind: "options",
      label: "Acesso",
      promoted: true,
      options: [
        { id: "enabled", label: "Habilitado" },
        { id: "disabled", label: "Não habilitado" },
      ],
      selected: params.acesso === "all" ? [] : [params.acesso],
      onClear: () => {
        void setParams({ acesso: "all" });
        pagination.setPage(1);
      },
      onChange: (values) => {
        const last = values.at(-1);
        void setParams({ acesso: last === "enabled" || last === "disabled" ? last : "all" });
        pagination.setPage(1);
      },
    },
  ];
  const href = (id: string) =>
    `/professores/${id}?voltar=${encodeURIComponent(`/professores?${searchParams.toString()}`)}`;
  const filtered = Boolean(params.busca || params.atuacao !== "all" || params.acesso !== "all");
  return (
    <>
      <DataTablePage
        title="Professores"
        summary={
          isCoverage
            ? "Compromissos que precisam de cobertura"
            : query.data
              ? `${query.data.total} professores`
              : undefined
        }
        controls={
          <div className="flex flex-wrap items-center gap-2">
            {!isCoverage && (
              <>
                <div className="w-full sm:w-56">
                  <Input
                    name="teacher-search"
                    aria-label="Buscar professor"
                    placeholder="Buscar por nome"
                    autoComplete="off"
                    size="compact-responsive"
                    value={params.busca}
                    onChange={(event) => {
                      void setParams({ busca: event.target.value });
                      pagination.setPage(1);
                    }}
                  />
                </div>
                <TableFilters
                  fields={fields}
                  onClearAll={() => {
                    void setParams({ atuacao: "all", acesso: "all" });
                    pagination.setPage(1);
                  }}
                />
              </>
            )}
            {!isCoverage && (
              <Button size="compact-responsive" onClick={() => setCreating(true)}>
                Novo professor
              </Button>
            )}
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl
              size="sm"
              value={isCoverage ? "coverage" : "teachers"}
              aria-label="Visão de professores"
              onValueChange={(value) => {
                void setParams({ pendencias: value === "coverage" ? "docente" : "" });
                pagination.setPage(1);
              }}
            >
              <SegmentedControlItem value="teachers">Cadastro</SegmentedControlItem>
              <SegmentedControlItem value="coverage">Pendências de docente</SegmentedControlItem>
            </SegmentedControl>
            {!isCoverage && <TableFilterChips fields={fields} />}
          </div>
          <div className="min-h-0 flex-1">
            {isCoverage ? (
              <CoverageTable pagination={pagination} />
            ) : (
              <TeacherTable
                data={query.data}
                isError={query.isError}
                isFetching={query.isFetching}
                filtered={filtered}
                pagination={pagination}
                href={href}
                onOpen={(id) => router.push(href(id))}
                onRetry={() => void query.refetch()}
              />
            )}
          </div>
        </div>
      </DataTablePage>
      {creating && <TeacherDialog onClose={() => setCreating(false)} />}
    </>
  );
}
