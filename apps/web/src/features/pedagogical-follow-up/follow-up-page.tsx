"use client";
import Link from "next/link";
import { useState, type ReactElement } from "react";
import { parseAsString, parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  Badge,
  Button,
  Input,
  SegmentedControl,
  SegmentedControlItem,
  Tabs,
  TabsList,
  TabsTab,
} from "@lazuli/ui";
import { ArrowUpRight, Plus } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { OccurrenceForm } from "./occurrence-form";
import { CATEGORY, dateLabel, FollowUpEmpty, QueryState, StatusBadge } from "./shared";
const STATES = ["ALL", "OPEN", "IN_PROGRESS", "CONCLUDED", "OVERDUE"] as const;
const stateLabels = ["Todas", "A iniciar", "Em andamento", "Concluídas", "Prazo vencido"];
export function FollowUpPage(): ReactElement {
  const [params, setParams] = useQueryStates({
    view: parseAsStringLiteral(["interventions", "occurrences"] as const).withDefault(
      "interventions",
    ),
    busca: parseAsString.withDefault(""),
    aluno: parseAsString.withDefault(""),
    estado: parseAsStringLiteral(STATES).withDefault("ALL"),
    pagina: parseAsInteger.withDefault(1),
  });
  const [creating, setCreating] = useState(false);
  const input = {
    search: params.busca,
    status: params.estado,
    page: params.pagina,
    ...(params.aluno ? { studentId: params.aluno } : {}),
  };
  const interventions = trpc.interventions.list.useQuery(input, {
    enabled: params.view === "interventions",
  });
  const occurrences = trpc.occurrences.list.useQuery(input, {
    enabled: params.view === "occurrences",
  });
  const query = params.view === "interventions" ? interventions : occurrences;
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col">
      <div className="grid shrink-0 gap-5 border-b border-border p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-h2 font-semibold text-heading">Acompanhamento</h1>
            <p className="mt-1 text-caption text-muted-foreground">
              Ocorrências, atuação dos professores e próximos passos.
            </p>
          </div>
          <Button onClick={() => setCreating(true)} size="compact-responsive">
            <Plus />
            Registrar ocorrência
          </Button>
        </header>
        <Tabs
          value={params.view}
          variant="underline"
          onValueChange={(value) =>
            void setParams({
              view: value === "occurrences" ? "occurrences" : "interventions",
              pagina: 1,
            })
          }
        >
          <TabsList aria-label="Visões de acompanhamento">
            <TabsTab value="interventions">Intervenções</TabsTab>
            <TabsTab value="occurrences">Ocorrências</TabsTab>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:max-w-sm">
            <Input
              name="follow-up-search"
              aria-label="Buscar acompanhamento"
              placeholder="Buscar por aluno ou contexto"
              autoComplete="off"
              size="compact-responsive"
              value={params.busca}
              onChange={(event) => void setParams({ busca: event.target.value, pagina: 1 })}
            />
          </div>
          {params.aluno && (
            <Button
              variant="secondary"
              size="compact-responsive"
              onClick={() => void setParams({ aluno: null, pagina: 1 })}
            >
              Mostrar todos os alunos
            </Button>
          )}
        </div>
        {params.view === "interventions" && (
          <div className="overflow-x-auto">
            <SegmentedControl
              aria-label="Situação da intervenção"
              value={params.estado}
              onValueChange={(value) => {
                if (STATES.includes(value as typeof params.estado))
                  void setParams({ estado: value as typeof params.estado, pagina: 1 });
              }}
            >
              {STATES.map((state, index) => (
                <SegmentedControlItem key={state} value={state}>
                  {stateLabels[index]}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>
        )}
      </div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.data && (
          <p className="mb-4 text-caption text-muted-foreground">
            {query.data.total} {params.view === "interventions" ? "intervenções" : "ocorrências"}
            {params.aluno ? " deste aluno" : " no acompanhamento"}
          </p>
        )}
        {query.data?.total === 0 && (
          <FollowUpEmpty kind={params.view === "interventions" ? "intervenção" : "ocorrência"} />
        )}
        {params.view === "interventions" && (
          <div className="grid gap-3">
            {interventions.data?.rows.map((row) => (
              <Link
                key={row.id}
                href={`/acompanhamento/intervencoes/${row.id}`}
                className="group grid gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong sm:grid-cols-[minmax(0,1fr)_16rem]"
              >
                <div className="grid gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-caption font-medium text-interactive">
                      {row.student.fullName}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-heading group-hover:text-interactive">
                    {row.title}
                  </h2>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {row.status === "CONCLUDED" ? row.outcome : row.nextStep}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:border-l sm:border-border sm:pl-5">
                  <div className="grid gap-2">
                    <p className="text-caption font-medium">{row.teacher.name}</p>
                    <p className="text-caption text-muted-foreground">
                      {row._count.occurrences} ocorrências ·{" "}
                      {row.dueOn ? `Prazo ${dateLabel(row.dueOn)}` : "Sem prazo definido"}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
        {params.view === "occurrences" && (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {occurrences.data?.rows.map((row) => (
              <Link
                key={row.id}
                href={`/acompanhamento/ocorrencias/${row.id}`}
                className="grid gap-3 p-5 transition-colors hover:bg-muted/40 sm:grid-cols-[8rem_minmax(0,1fr)]"
              >
                <div className="grid content-start gap-1 text-caption text-muted-foreground">
                  <span>{dateLabel(row.classSession.date)}</span>
                  <span>{row.classSession.class.portalClassName}</span>
                </div>
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-caption font-medium text-interactive">
                      {row.student.fullName}
                    </span>
                    <Badge variant="muted">{CATEGORY[row.category]}</Badge>
                  </div>
                  <h2 className="font-semibold text-heading">{row.title}</h2>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{row.account}</p>
                  <p className="text-caption text-muted-foreground">
                    Relato de {row.recordedBy.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {query.data && query.data.total > query.data.pageSize && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              disabled={params.pagina <= 1}
              onClick={() => void setParams({ pagina: params.pagina - 1 })}
            >
              Anterior
            </Button>
            <span className="text-caption text-muted-foreground">Página {params.pagina}</span>
            <Button
              variant="secondary"
              disabled={params.pagina * query.data.pageSize >= query.data.total}
              onClick={() => void setParams({ pagina: params.pagina + 1 })}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
      {creating && <OccurrenceForm onClose={() => setCreating(false)} />}
    </div>
  );
}
