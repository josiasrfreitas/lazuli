"use client";

import { useEffect } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { createJobNotifier } from "~/features/shared/job-toast";
import { trpc } from "~/lib/trpc";
import type { AcademicYear } from "./model";

type CalendarExecutionSnapshot =
  RouterOutputs["calendar"]["academic"]["changes"]["executionStatuses"];
type NoticeState = "PENDING" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "UNAVAILABLE";
const STATUS_POLL_MS = 3000;
const MAX_STATUS_REQUESTS = 100;
const notifier = createJobNotifier();
const messages: Record<NoticeState, string> = {
  PENDING: "Calendário salvo. Chamando o reforço…",
  QUEUED: "Já entrou na fila. A agenda já já fica em dia.",
  RUNNING: "Ajustando as datas. Cada aula no seu quadrado…",
  SUCCEEDED: "Tudo nos conformes. A agenda agradece!",
  FAILED: "A atualização tropeçou. Vamos tentar de novo?",
  UNAVAILABLE: "Calendário salvo. O processamento ficou sem sinal.",
};

export function notifyCalendarExecution(input: {
  id: string;
  state: NoticeState;
  reason?: string | undefined;
}): void {
  let outcome: "working" | "success" | "error" = "working";
  if (input.state === "SUCCEEDED") outcome = "success";
  if (input.state === "FAILED" || input.state === "UNAVAILABLE") outcome = "error";
  notifier.notify({
    key: input.id,
    state: input.state,
    title: messages[input.state],
    outcome,
    description:
      outcome === "error"
        ? "A solicitação foi preservada. Confira as pendências no calendário e tente novamente."
        : input.reason,
  });
}

function executionState(
  request: AcademicYear["requests"][number],
  execution?: CalendarExecutionSnapshot,
): NoticeState {
  if (request.status === "SUCCEEDED" || request.status === "FAILED") return request.status;
  if (execution?.available === false) return "UNAVAILABLE";
  switch (execution?.statuses[request.id]) {
    case "FAILED":
    case "CANCELLED": {
      return "FAILED";
    }
    case "RUNNING": {
      return "RUNNING";
    }
    case "QUEUED": {
      return "QUEUED";
    }
    default: {
      return request.status;
    }
  }
}

/** One observer covers all calendar entry points, including management views. */
export function CalendarExecutionNotifications({ requests }: Pick<AcademicYear, "requests">): null {
  const activeIds = requests
    .filter((row) => notifier.has(row.id) && (row.status === "PENDING" || row.status === "RUNNING"))
    .map((row) => row.id)
    .toSorted()
    .slice(0, MAX_STATUS_REQUESTS);
  const execution = trpc.calendar.academic.changes.executionStatuses.useQuery(
    { ids: activeIds },
    {
      enabled: activeIds.length > 0,
      refetchInterval: STATUS_POLL_MS,
      retry: false,
      staleTime: 0,
    },
  );
  useEffect(() => {
    for (const request of requests) {
      if (!notifier.has(request.id)) continue;
      const snapshot = execution.error ? { available: false, statuses: {} } : execution.data;
      notifyCalendarExecution({
        id: request.id,
        state: executionState(request, snapshot),
        reason: request.reason,
      });
    }
  }, [requests, execution.data, execution.error]);
  return null;
}
