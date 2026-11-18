"use client";
import { trpc } from "~/lib/trpc";
import { useOrganizationRefresh } from "~/features/class-organization/shared";
import { rowsFor, type ClassPlan, type Placement, type OrganizationBoard } from "./model";

type CompositionModel = {
  rows: Placement[];
  leads: OrganizationBoard["waitingLeads"];
  ready: Placement[];
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
  const leads = board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id);
  const ready = rows.filter((row) => !row.publishedAt && row.blockers.length === 0);
  const refresh = useOrganizationRefresh();
  const publish = trpc.semesterOrganization.publish.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onFeedback(
        `${result.count} ${result.count === 1 ? "vínculo oficializado" : "vínculos oficializados"}.`,
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
    leads,
    ready,
    pending: publish.isPending,
    error: publish.error?.message,
    onPublish,
  };
}
