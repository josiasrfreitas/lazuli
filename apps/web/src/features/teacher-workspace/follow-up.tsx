"use client";
import type { JSX as ReactJSX } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button, Input, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { TeacherPage, TeacherLinkRow, TeacherQueryState } from "./shared";
import { TeacherListLoading } from "./list-loading";

export function TeacherFollowUp(): ReactJSX.Element {
  const [tab, setTab] = useState("intervencoes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const interventions = trpc.interventions.list.useQuery({ search, page });
  const occurrences = trpc.occurrences.list.useQuery({ search, page });
  const query = tab === "intervencoes" ? interventions : occurrences;
  return (
    <TeacherPage
      title="Acompanhamento"
      description="Intervenções atribuídas a você e ocorrências que você acompanha."
    >
      <FollowUpSearch
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />
      <FollowUpTabs
        tab={tab}
        onTab={(value) => {
          setTab(value);
          setPage(1);
        }}
        interventions={interventions.data?.rows}
        occurrences={occurrences.data?.rows}
      />
      <FollowUpState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        tab={tab}
        total={query.data?.total}
      />
      {query.data && (
        <FollowUpPagination
          page={page}
          pageSize={query.data.pageSize}
          total={query.data.total}
          onPage={setPage}
        />
      )}
    </TeacherPage>
  );
}

function FollowUpState({
  pending,
  error,
  retry,
  tab,
  total,
}: {
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
  tab: string;
  total: number | undefined;
}): ReactJSX.Element {
  return (
    <>
      <TeacherQueryState
        pending={pending}
        error={error}
        retry={retry}
        loading={
          <TeacherListLoading
            kind="links"
            label={tab === "intervencoes" ? "Carregando intervenções" : "Carregando ocorrências"}
          />
        }
      />
      {total === 0 && (
        <p className="py-6 text-sm text-muted-foreground">
          Nenhum registro encontrado. Para registrar uma ocorrência, abra o aluno.
        </p>
      )}
    </>
  );
}

function FollowUpSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): ReactJSX.Element {
  return (
    <Input
      aria-label="Buscar acompanhamento"
      placeholder="Buscar por aluno ou registro"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function FollowUpTabs({
  tab,
  onTab,
  interventions,
  occurrences,
}: {
  tab: string;
  onTab: (value: string) => void;
  interventions: RouterOutputs["interventions"]["list"]["rows"] | undefined;
  occurrences: RouterOutputs["occurrences"]["list"]["rows"] | undefined;
}): ReactJSX.Element {
  return (
    <Tabs value={tab} onValueChange={onTab} variant="underline">
      <TabsList aria-label="Registros pedagógicos">
        <TabsTab value="intervencoes">Intervenções</TabsTab>
        <TabsTab value="ocorrencias">Ocorrências</TabsTab>
      </TabsList>
      <TabsPanel value="intervencoes">
        {interventions && <InterventionRows rows={interventions} />}
      </TabsPanel>
      <TabsPanel value="ocorrencias">
        {occurrences && <OccurrenceRows rows={occurrences} />}
      </TabsPanel>
    </Tabs>
  );
}

function InterventionRows({
  rows,
}: {
  rows: RouterOutputs["interventions"]["list"]["rows"];
}): ReactJSX.Element {
  return (
    <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map((row) => (
        <TeacherLinkRow
          key={row.id}
          title={row.student.fullName}
          subtitle="Consultar intervenção e registrar evolução"
          href={`/professor/alunos/${row.studentId}?registro=intervention:${row.id}#acompanhamento`}
        />
      ))}
    </div>
  );
}

function OccurrenceRows({
  rows,
}: {
  rows: RouterOutputs["occurrences"]["list"]["rows"];
}): ReactJSX.Element {
  return (
    <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map((row) => (
        <TeacherLinkRow
          key={row.id}
          title={row.student.fullName}
          subtitle={row.classSession.class.portalClassName}
          href={`/professor/alunos/${row.studentId}?registro=occurrence:${row.id}#acompanhamento`}
        />
      ))}
    </div>
  );
}

function FollowUpPagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (value: number) => void;
}): ReactJSX.Element | null {
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft aria-hidden="true" /> Anterior
      </Button>
      <span className="text-sm">Página {page}</span>
      <Button
        variant="secondary"
        disabled={page * pageSize >= total}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight aria-hidden="true" /> Próxima
      </Button>
    </div>
  );
}
