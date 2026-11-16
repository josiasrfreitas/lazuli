"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@lazuli/ui";
import { notifyHealthRefresh } from "./health-refresh-notice";
import { trpc } from "~/lib/trpc";

const STATUS_POLL_MS = 3000;
const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export function StudentHealthRefresh({ studentId }: { studentId: string }): ReactElement {
  const [runId, setRunId] = useState<string | null>(null);
  const restart = useRef<() => void>(() => {});
  const utils = trpc.useUtils();
  const status = trpc.students.healthRefreshStatus.useQuery(
    { id: studentId, runId: runId ?? "00000000-0000-0000-0000-000000000000" },
    {
      enabled: Boolean(runId),
      retry: false,
      staleTime: 0,
      refetchInterval: (query) =>
        TERMINAL.has(query.state.data?.status ?? "") ? false : STATUS_POLL_MS,
    },
  );
  const mutation = trpc.students.refreshHealth.useMutation({
    onSuccess: ({ runId: id }) => {
      setRunId(id);
      notify("QUEUED");
    },
    onError: (error) => notify("FAILED", error.message),
  });
  const state = status.error ? "UNAVAILABLE" : status.data?.status;
  const busy = mutation.isPending || isHealthRefreshActive({ runId, state });

  function start(): void {
    if (mutation.isPending) return;
    setRunId(null);
    notify("STARTING");
    mutation.mutate({ id: studentId });
  }
  restart.current = start;
  function notify(next: string, description?: string): void {
    notifyHealthRefresh({ studentId, state: next, description, retry: () => restart.current() });
  }
  useEffect(() => {
    if (!runId || !state) return;
    notify(state);
    if (state === "COMPLETED") {
      void Promise.all([
        utils.students.invalidate(),
        utils.dashboard.invalidate(),
        utils.teachers.invalidate(),
      ]);
    }
  }, [runId, state, utils]);

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      disabled={busy}
      aria-label={busy ? "Atualizando health score" : "Atualizar health score deste aluno"}
      title={busy ? "Atualizando health score" : "Atualizar health score"}
      onClick={start}
    >
      <RefreshCw aria-hidden="true" className={busy ? "animate-spin" : undefined} />
    </Button>
  );
}

function isHealthRefreshActive(input: {
  runId: string | null;
  state: string | undefined;
}): boolean {
  return Boolean(input.runId && !TERMINAL.has(input.state ?? "") && input.state !== "UNAVAILABLE");
}
