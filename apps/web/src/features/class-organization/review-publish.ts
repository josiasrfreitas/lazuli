import type { PublishSemesterInput } from "@lazuli/validators";
import { useRef, useState } from "react";
import { trpc } from "~/lib/trpc";
import { useOrganizationRefresh } from "~/features/class-organization/shared";
import type { ClassPlan, OrganizationBoard, Placement } from "./model";
import { reviewPlanName } from "./review-group-model";

type PublishState = { working: boolean; error: string | null; confirm: () => Promise<void> };
type PublishPlan = Pick<ClassPlan, "id" | "name" | "version"> &
  Partial<Pick<ClassPlan, "className">>;
type Selection = Pick<Placement, "id" | "planId" | "version">;
type BatchSelection = { plans: PublishPlan[]; selected: Selection[] };
type Group = { plan: PublishPlan; placements: PublishSemesterInput["placements"] };
type BatchResult = { ok: boolean; appliedIds: string[]; message: string };
const planNames = new Intl.ListFormat("pt-BR", { type: "conjunction" });

function groupSelection({ plans, selected }: BatchSelection): Group[] | null {
  const groups = new Map<string, Group>(plans.map((plan) => [plan.id, { plan, placements: [] }]));
  for (const row of selected) {
    const group = row.planId && groups.get(row.planId);
    if (!group) return null;
    group.placements.push({ id: row.id, version: row.version });
  }
  return [...groups.values()].filter((group) => group.placements.length > 0);
}

function confirmedMemberships(count: number): string {
  return count === 1 ? "1 vínculo confirmado" : `${count} vínculos confirmados`;
}

export async function publishReviewBatch(
  selection: BatchSelection,
  publish: (input: PublishSemesterInput) => Promise<{ count: number }>,
): Promise<BatchResult> {
  const groups = groupSelection(selection);
  const appliedIds: string[] = [];
  const appliedPlans: string[] = [];
  if (!groups?.length)
    return {
      ok: false,
      appliedIds,
      message: "Confira as turmas de destino e selecione novamente.",
    };
  let count = 0;
  for (const { plan, placements } of groups) {
    try {
      const result = await publish({ planId: plan.id, version: plan.version, placements });
      count += result.count;
      appliedPlans.push(reviewPlanName(plan));
      appliedIds.push(...placements.map(({ id }) => id));
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Revise as propostas e tente novamente.";
      const failure = `Não foi possível concluir a confirmação em ${reviewPlanName(plan)}. ${reason}`;
      const remaining = selection.selected.length - appliedIds.length;
      const pending =
        remaining === 1
          ? "Confira a proposta restante."
          : `Confira as ${remaining} propostas restantes.`;
      return {
        ok: false,
        appliedIds,
        message: count
          ? `${confirmedMemberships(count)} (${planNames.format(appliedPlans)}). ${failure} ${pending}`
          : failure,
      };
    }
  }
  return {
    ok: true,
    appliedIds,
    message: `${confirmedMemberships(count)}. Cada vínculo respeita a data de início da proposta.`,
  };
}

export function useReviewPublish({
  board,
  selected,
  onFeedback,
  clearSelection,
  removeSelection,
}: {
  board: OrganizationBoard;
  selected: Placement[];
  onFeedback: (text: string) => void;
  clearSelection: () => void;
  removeSelection: (ids: string[]) => void;
}): PublishState {
  const inFlight = useRef<Promise<void> | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publish = trpc.semesterOrganization.publish.useMutation();
  const refresh = useOrganizationRefresh();
  async function publishSelection(): Promise<void> {
    try {
      const result = await publishReviewBatch(
        { plans: board.plans, selected },
        publish.mutateAsync,
      );
      if (result.ok) {
        clearSelection();
        onFeedback(result.message);
      } else {
        if (result.appliedIds.length > 0) removeSelection(result.appliedIds);
        setError(result.message);
      }
    } finally {
      try {
        await refresh();
      } catch {
        const message = "Atualize a página para conferir a situação de cada vínculo.";
        setError((previous) => (previous ? `${previous} ${message}` : message));
      }
      inFlight.current = null;
      setWorking(false);
    }
  }
  function confirm(): Promise<void> {
    if (inFlight.current) return inFlight.current;
    if (selected.length === 0) return Promise.resolve();
    setWorking(true);
    setError(null);
    inFlight.current = Promise.resolve().then(publishSelection);
    return inFlight.current;
  }
  return { working, error, confirm };
}
