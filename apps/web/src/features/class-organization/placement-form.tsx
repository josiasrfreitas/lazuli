"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";
import { FormationProgress } from "./page-loading";
import { trpc } from "~/lib/trpc";
import { RecordState } from "~/features/class-records/shared";
import { TaskDialog } from "~/features/shared/task-form";
import type { Placement, OrganizationBoard } from "./shared";
import { PlacementFields } from "./placement-fields";

export function PlacementForm({
  studentId,
  row,
  board,
  initialPlanId,
  onClose,
}: {
  studentId: string;
  row?: Placement;
  board: OrganizationBoard;
  initialPlanId?: string;
  onClose: () => void;
}): ReactJSX.Element {
  const query = trpc.semesterOrganization.student.useQuery({
    studentId,
    semesterId: board.semester.id,
  });
  const options = trpc.classes.formOptions.useQuery();
  return query.data && options.data ? (
    <PlacementFields
      data={query.data}
      row={row}
      board={board}
      initialPlanId={initialPlanId}
      onClose={onClose}
    />
  ) : (
    <PlacementLoading
      row={row}
      board={board}
      onClose={onClose}
      pending={query.isPending || options.isPending}
      error={query.error ?? options.error}
      retry={() => {
        void query.refetch();
        void options.refetch();
      }}
    />
  );
}

function PlacementLoading({
  row,
  board,
  onClose,
  pending,
  error,
  retry,
}: {
  row: Placement | undefined;
  board: OrganizationBoard;
  onClose: () => void;
  pending: boolean;
  error: ComponentProps<typeof RecordState>["error"];
  retry: () => void;
}): ReactJSX.Element {
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Escolher turma de destino"
      description={`${row?.studentName ?? "Aluno"} · semestre ${board.semester.name}`}
      bodyLayout="placement"
      submitDisabled
      formId="placement-loading"
      firstField=""
      submitLabel="Salvar proposta"
      pending={false}
      onClose={onClose}
    >
      {pending ? (
        <FormationProgress label="Buscando os dados do aluno" />
      ) : (
        <RecordState pending={false} error={error} retry={retry} />
      )}
    </TaskDialog>
  );
}
