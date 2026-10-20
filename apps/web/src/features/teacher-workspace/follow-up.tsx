"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button, Input, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TeacherPage, TeacherLinkRow, TeacherQueryState } from "./shared";
import { TeacherListLoading } from "./list-loading";

export function TeacherFollowUp() {
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
      <Input
        aria-label="Buscar acompanhamento"
        placeholder="Buscar por aluno ou registro"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setPage(1);
        }}
        variant="underline"
      >
        <TabsList aria-label="Registros pedagógicos">
          <TabsTab value="intervencoes">Intervenções</TabsTab>
          <TabsTab value="ocorrencias">Ocorrências</TabsTab>
        </TabsList>
        <TabsPanel value="intervencoes">
          {interventions.data && (
            <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
              {interventions.data.rows.map((row) => (
                <TeacherLinkRow
                  key={row.id}
                  title={row.student.fullName}
                  subtitle="Consultar intervenção e registrar evolução"
                  href={`/professor/alunos/${row.studentId}?registro=intervention:${row.id}#acompanhamento`}
                />
              ))}
            </div>
          )}
        </TabsPanel>
        <TabsPanel value="ocorrencias">
          {occurrences.data && (
            <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
              {occurrences.data.rows.map((row) => (
                <TeacherLinkRow
                  key={row.id}
                  title={row.student.fullName}
                  subtitle={row.classSession.class.portalClassName}
                  href={`/professor/alunos/${row.studentId}?registro=occurrence:${row.id}#acompanhamento`}
                />
              ))}
            </div>
          )}
        </TabsPanel>
      </Tabs>
      <TeacherQueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        loading={
          <TeacherListLoading
            kind="links"
            label={tab === "intervencoes" ? "Carregando intervenções" : "Carregando ocorrências"}
          />
        }
      />
      {query.data?.total === 0 && (
        <p className="py-6 text-sm text-muted-foreground">
          Nenhum registro encontrado. Para registrar uma ocorrência, abra o aluno.
        </p>
      )}
      {query.data && query.data.total > query.data.pageSize && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft aria-hidden="true" /> Anterior
          </Button>
          <span className="text-sm">Página {page}</span>
          <Button
            variant="secondary"
            disabled={page * query.data.pageSize >= query.data.total}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight aria-hidden="true" /> Próxima
          </Button>
        </div>
      )}
    </TeacherPage>
  );
}
