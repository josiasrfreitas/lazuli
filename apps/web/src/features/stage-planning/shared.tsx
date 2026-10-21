import { Pencil, RefreshCw } from "lucide-react";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Alert, Button, DataTable, type DataTableColumn } from "@lazuli/ui";
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
      <Alert variant="destructive">
        <span>{error.message}</span>
        <Button variant="secondary" onClick={retry}>
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </Alert>
    );
  return null;
}
export function PlanTable({
  items,
  onEdit,
  filtered = false,
  pagination,
}: {
  items: PlannedItem[];
  pagination?: import("@lazuli/ui").TablePaginationConfig | undefined;
  filtered?: boolean;
  onEdit?: ((item: PlannedItem) => void) | undefined;
}): ReactElement {
  const columns: DataTableColumn<PlannedItem>[] = [
    {
      id: "date",
      header: "Data prevista",
      width: "narrow",
      cell: (item) => (
        <span className="font-numeric tabular-nums">{dateLabel(item.plannedOn)}</span>
      ),
    },
    {
      id: "activity",
      header: "Atividade planejada",
      width: "wide",
      cell: (item) => (
        <div className="grid gap-1">
          <span className="font-semibold">{item.title}</span>
          <span className="text-caption text-muted-foreground">{KIND_LABELS[item.kind]}</span>
        </div>
      ),
    },
    {
      id: "reference",
      header: "Referência",
      width: "standard",
      cell: (item) => (
        <div className="grid gap-1">
          <span>{item.reference ?? "—"}</span>
          {item.pageFrom !== null && (
            <span className="text-caption text-muted-foreground">
              Pág. {item.pageFrom}
              {item.pageTo !== null && item.pageTo !== item.pageFrom ? `–${item.pageTo}` : ""}
            </span>
          )}
        </div>
      ),
    },
  ];
  if (onEdit)
    columns.push({
      id: "actions",
      header: <span className="sr-only">Ações</span>,
      width: "narrow",
      cell: (item) => (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Editar ${item.title} de ${dateLabel(item.plannedOn)}`}
          onClick={() => onEdit(item)}
        >
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      ),
    });
  return (
    <DataTable
      label="Roteiro de atividades planejadas"
      {...(pagination ? { pagination } : {})}
      columns={columns}
      state={
        items.length > 0
          ? { kind: "data", rows: items }
          : { kind: filtered ? "noResults" : "empty" }
      }
      empty={{
        title: "O roteiro começa aqui",
        description:
          "Inclua as atividades e suas datas previstas. Revisões e avaliações também fazem parte do plano.",
      }}
      errorTitle="Não foi possível carregar o roteiro"
      onRetry={() => {}}
    />
  );
}
