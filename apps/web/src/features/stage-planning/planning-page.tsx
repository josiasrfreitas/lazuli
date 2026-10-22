"use client";
import { useEffect, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { PlanningState } from "./shared";

/** Compatibility for saved links; the plan itself only renders in its owner. */
export function PlanningPage(): ReactElement {
  const params = useSearchParams();
  const router = useRouter();
  const query = trpc.planning.contexts.useQuery();
  const classId = params.get("turma");
  const progressId = params.get("percurso");
  const destination = planningDestination({ classId, progressId, contexts: query.data });
  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);
  return (
    <>
      <PlanningState
        pending={query.isPending || Boolean(destination)}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !destination && (
        <EmptyState
          title="Planejamento não disponível"
          description="A turma ou o percurso não está disponível para seu acesso."
        />
      )}
    </>
  );
}

function planningDestination({
  classId,
  progressId,
  contexts,
}: {
  classId: string | null;
  progressId: string | null;
  contexts: RouterOutputs["planning"]["contexts"] | undefined;
}): string | null {
  if (!classId) return "/aulas";
  const group = contexts?.find((row) => row.id === classId);
  const student = group?.students.find((row) => row.progressId === progressId);
  if (student) {
    return `/alunos/${student.studentId}?secao=planejamento&percurso=${student.progressId}`;
  }
  if (!group || progressId) return null;
  const section = group.scheduleType === "REGULAR" ? "planejamento" : "alunos";
  return `/turmas/${group.id}?secao=${section}`;
}
