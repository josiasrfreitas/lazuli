"use client";

import { useState, type ReactElement } from "react";
import { History } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Pagination,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { ActionHistoryEntry, type HistoryRow } from "./action-history-entry";
import { CorrectionDialog } from "./correction-dialog";

type List = RouterOutputs["classes"]["actions"];
type HistoryControls = {
  pending: boolean;
  cancel: (id: string) => void;
  correct: (row: HistoryRow) => void;
};

export function ActionHistory({ classId }: { classId: string }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={<Button size="icon-sm" variant="ghost" aria-label="Histórico da turma" />}
            />
          }
        >
          <History aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Histórico</TooltipContent>
      </Tooltip>
      {open && <HistoryContent classId={classId} />}
    </Dialog>
  );
}

function HistoryContent({ classId }: { classId: string }): ReactElement {
  const state = useHistory(classId);
  return (
    <>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico da turma</DialogTitle>
            <DialogDescription>Matrículas, retornos e alterações de vínculo.</DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-5">
            {state.error && (
              <p role="alert" className="mb-3 text-destructive">
                {state.error}
              </p>
            )}
            <HistoryFeed query={state.query} controls={state.controls} />
          </DialogBody>
          {state.query.data && state.query.data.pageCount > 1 && (
            <div className="mt-4 flex justify-end border-t border-border pt-3">
              <Pagination
                label="Páginas do histórico"
                page={state.page}
                pageCount={state.query.data.pageCount}
                onPageChange={state.setPage}
              />
            </div>
          )}
        </DialogContent>
      </DialogPortal>
      <CorrectionDialog
        action={state.correcting}
        classId={classId}
        onClose={() => state.setCorrecting(null)}
      />
    </>
  );
}

function HistoryFeed({
  query,
  controls,
}: {
  query: QueryResult<List>;
  controls: HistoryControls;
}): ReactElement {
  if (query.isError)
    return (
      <EmptyState
        role="alert"
        title="Não foi possível carregar o histórico"
        action={
          <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  if (!query.data)
    return (
      <p role="status" className="text-muted-foreground">
        Carregando movimentações…
      </p>
    );
  if (query.data.rows.length === 0)
    return (
      <EmptyState
        icon={<History />}
        title="Nenhuma movimentação registrada"
        description="As matrículas e alterações de vínculo aparecerão aqui."
      />
    );
  return <HistoryTimeline rows={query.data.rows} controls={controls} />;
}

function HistoryTimeline({
  rows,
  controls,
}: {
  rows: HistoryRow[];
  controls: HistoryControls;
}): ReactElement {
  const days = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const day = row.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const entries = days.get(day) ?? [];
    entries.push(row);
    days.set(day, entries);
  }
  return (
    <div className="space-y-5">
      {[...days].map(([day, entries]) => (
        <section key={day} aria-label={`Registros de ${day}`}>
          <h3 className="mb-3 border-b border-border pb-2 font-numeric text-caption text-muted-foreground">
            {day}
          </h3>
          <ol>
            {entries.map((row) => (
              <ActionHistoryEntry key={row.id} row={row} controls={controls} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

type HistoryState = {
  page: number;
  setPage: (page: number) => void;
  correcting: HistoryRow | null;
  setCorrecting: (row: HistoryRow | null) => void;
  error: string | null;
  query: QueryResult<List>;
  controls: HistoryControls;
};

function useHistory(classId: string): HistoryState {
  const [page, setPage] = useState(1);
  const [correcting, setCorrecting] = useState<HistoryRow | null>(null);
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
  return {
    page,
    setPage,
    correcting,
    setCorrecting,
    error,
    query,
    controls: {
      pending: cancel.isPending,
      cancel: (actionId) => cancel.mutate({ actionId }),
      correct: setCorrecting,
    },
  };
}
