import { RefreshCw } from "lucide-react";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { ToastAlert, Button } from "@lazuli/ui";
import { QueryLoading } from "~/components/query-loading";
import { formatDateOnlyBR } from "~/lib/format";
export type Planning = RouterOutputs["planning"]["detail"];
export type PlannedItem = NonNullable<Planning["plan"]>["items"][number];
export const KIND_LABELS = {
  CONTENT: "Conteúdo",
  REVIEW: "Revisão",
  ASSESSMENT: "Avaliação",
  ACTIVITY: "Atividade",
} as const;
export const dateLabel = formatDateOnlyBR;
export function targetFor(data: Planning): { progressId?: string; classId: string } {
  return {
    classId: data.scope.class.id,
    ...(data.scope.progressId ? { progressId: data.scope.progressId } : {}),
  };
}
export function PlanningState({
  pending,
  error,
  retry,
  label = "Carregando planejamento",
}: {
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
  label?: string;
}): ReactElement | null {
  if (pending) return <QueryLoading label={label} />;
  if (error)
    return (
      <ToastAlert variant="destructive">
        <span>{error.message}</span>
        <Button variant="secondary" onClick={retry}>
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </ToastAlert>
    );
  return null;
}
