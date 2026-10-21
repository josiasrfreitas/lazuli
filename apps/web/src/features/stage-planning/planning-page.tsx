"use client";
import { useEffect, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PlanningState } from "./shared";

/** Compatibility for saved links; the plan itself only renders in its owner. */
export function PlanningPage(): ReactElement {
  const params = useSearchParams();
  const router = useRouter();
  const query = trpc.planning.contexts.useQuery();
  const classId = params.get("turma");
  const progressId = params.get("percurso");
  const group = query.data?.find((row) => row.id === classId);
  const student = group?.students.find((row) => row.progressId === progressId);
  const destination = classId
    ? student
      ? `/alunos/${student.studentId}?secao=planejamento&percurso=${student.progressId}`
      : group && !progressId
        ? `/turmas/${group.id}?secao=${group.scheduleType === "REGULAR" ? "planejamento" : "alunos"}`
        : null
    : "/aulas";
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
