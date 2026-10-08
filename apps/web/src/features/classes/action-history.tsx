"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import { Button, DataTable, type DataTableState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { CorrectionDialog } from "./correction-dialog";

type List = RouterOutputs["classes"]["actions"];
type Row = List["rows"][number];
const kindLabel = {
  ENTRY: "Matrícula",
  RETURN: "Retorno",
  PAUSE: "Pausa",
  EXIT: "Saída",
  CORRECTION: "Correção",
} as const;
const statusLabel = {
  SCHEDULED: "Programada",
  APPLIED: "Efetivada",
  CANCELLED: "Cancelada",
} as const;
function tableState(data: List | undefined, failed: boolean): DataTableState<Row> {
  if (failed) return { kind: "error" };
  if (!data) return { kind: "loading" };
  return data.rows.length > 0 ? { kind: "data", rows: data.rows } : { kind: "empty" };
}
export function ActionHistory({ classId }: { classId: string }): ReactElement {
  const [page, setPage] = useState(1);
  const [correcting, setCorrecting] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = trpc.classes.actions.useQuery({ id: classId, page, pageSize: 20 });
  const utils = trpc.useUtils();
  const cancel = trpc.enrollment.cancelScheduled.useMutation({
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        utils.classes.actions.invalidate({ id: classId }),
        utils.classes.roster.invalidate({ id: classId }),
        utils.classes.byId.invalidate({ id: classId }),
        utils.classes.list.invalidate(),
      ]);
    },
    onError: (cause) => setError(cause.message),
  });
  const columns = historyColumns({
    pending: cancel.isPending,
    cancel: (actionId) => cancel.mutate({ actionId }),
    correct: setCorrecting,
  });
  return (
    <section className="min-w-0 space-y-3">
      <h2 className="font-display text-h3 font-semibold">Histórico de ações</h2>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="h-80 min-w-0">
        <HistoryTable
          data={query.data}
          isError={query.isError}
          refetch={() => void query.refetch()}
          columns={columns}
          page={page}
          setPage={setPage}
        />
      </div>
      <CorrectionDialog action={correcting} classId={classId} onClose={() => setCorrecting(null)} />
    </section>
  );
}

function historyColumns(input: {
  pending: boolean;
  cancel: (id: string) => void;
  correct: (row: Row) => void;
}): Array<{ id: string; header: string; width?: "wide"; cell: (row: Row) => ReactNode }> {
  return [
    {
      id: "student",
      header: "Aluno",
      width: "wide",
      cell: (row) => row.enrollment.student.fullName,
    },
    { id: "kind", header: "Ação", cell: (row) => kindLabel[row.kind] },
    {
      id: "date",
      header: "Data efetiva",
      cell: (row) => row.effectiveDate.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
    },
    { id: "status", header: "Estado", cell: (row) => statusLabel[row.status] },
    { id: "author", header: "Registrado por", cell: (row) => row.recordedBy.name },
    { id: "controls", header: "Ação", cell: (row) => actionControl(row, input) },
  ];
}
function actionControl(
  row: Row,
  input: { pending: boolean; cancel: (id: string) => void; correct: (row: Row) => void },
): ReactNode {
  if (row.status === "SCHEDULED")
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={input.pending}
        onClick={() => input.cancel(row.id)}
      >
        Cancelar
      </Button>
    );
  if (row.status === "APPLIED" && row.kind !== "CORRECTION")
    return (
      <Button size="sm" variant="secondary" onClick={() => input.correct(row)}>
        Corrigir data
      </Button>
    );
  return null;
}

function HistoryTable({
  data,
  isError,
  refetch,
  columns,
  page,
  setPage,
}: {
  data: List | undefined;
  isError: boolean;
  refetch: () => void;
  columns: ReturnType<typeof historyColumns>;
  page: number;
  setPage: (page: number) => void;
}): ReactElement {
  return (
    <DataTable
      label="Histórico de ações da turma"
      columns={columns}
      state={tableState(data, isError)}
      onRetry={refetch}
      errorTitle="Não foi possível carregar o histórico"
      empty={{
        title: "Nenhuma ação registrada",
        description: "As ações da turma aparecerão aqui.",
      }}
      pagination={{
        page,
        pageSize: 20,
        pageCount: data?.pageCount ?? 1,
        totalItems: data?.total ?? 0,
        onPageChange: setPage,
        itemLabel: { singular: "ação", plural: "ações" },
      }}
    />
  );
}
