"use client";
import Link from "next/link";
import type { ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { QueryState, StatusBadge } from "./shared";
export function StudentFollowUp({ studentId }: { studentId: string }): ReactElement {
  const interventions = trpc.interventions.list.useQuery({ studentId });
  const occurrences = trpc.occurrences.list.useQuery({ studentId });
  const active = interventions.data?.rows.filter((row) => row.status !== "CONCLUDED") ?? [];
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ocorrências e intervenções</h2>
          <p className="mt-1 text-caption text-muted-foreground">
            {occurrences.data
              ? `${occurrences.data.total} relatos no histórico do aluno`
              : "Contexto e continuidade do acompanhamento"}
          </p>
        </div>
        <Button
          variant="secondary"
          size="compact-responsive"
          nativeButton={false}
          render={<Link href={`/acompanhamento?aluno=${studentId}`} />}
        >
          Ver acompanhamento
        </Button>
      </div>
      <QueryState
        pending={interventions.isPending || occurrences.isPending}
        error={interventions.error ?? occurrences.error}
        retry={() => {
          void interventions.refetch();
          void occurrences.refetch();
        }}
      />
      {active.map((row) => (
        <Link
          key={row.id}
          href={`/acompanhamento/intervencoes/${row.id}`}
          className="grid gap-2 border-t border-border pt-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-heading">{row.title}</h3>
            <StatusBadge status={row.status} />
          </div>
          <p className="text-sm text-muted-foreground">{row.nextStep}</p>
          <p className="text-caption text-muted-foreground">{row.teacher.name}</p>
        </Link>
      ))}
      {interventions.data && !active.length && (
        <p className="text-sm text-muted-foreground">Sem intervenções em aberto.</p>
      )}
    </section>
  );
}
