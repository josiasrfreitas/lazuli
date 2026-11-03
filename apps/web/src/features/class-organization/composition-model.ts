"use client";
import { trpc } from "~/lib/trpc";
import { dateOnly, useOrganizationRefresh } from "~/features/class-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import {
  leavingFor,
  rowsFor,
  type ClassPlan,
  type Placement,
  type OrganizationBoard,
} from "./model";

type CompositionModel = {
  rows: Placement[];
  leaving: number;
  leads: OrganizationBoard["waitingLeads"];
  ready: Placement[];
  ended: boolean;
  pending: boolean;
  error: string | undefined;
  onPublish: () => void;
};

export function useCompositionModel({
  plan,
  board,
  onFeedback,
}: {
  plan: ClassPlan;
  board: OrganizationBoard;
  onFeedback: (message: string) => void;
}): CompositionModel {
  const rows = rowsFor(board, plan.id);
  const leaving = leavingFor(board, plan).length;
  const leads = board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id);
  const ready = rows.filter((row) => !row.publishedAt && row.blockers.length === 0);
  const ended = dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  const refresh = useOrganizationRefresh();
  const publish = trpc.semesterOrganization.publish.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onFeedback(
        `${result.count} ${result.count === 1 ? "alocação aplicada" : "alocações aplicadas"}.`,
      );
    },
  });
  const onPublish = (): void =>
    publish.mutate({
      planId: plan.id,
      version: plan.version,
      placements: ready.map(({ id, version }) => ({ id, version })),
    });
  return {
    rows,
    leaving,
    leads,
    ready,
    ended,
    pending: publish.isPending,
    error: publish.error?.message,
    onPublish,
  };
}
