import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { useOrganizationRefresh } from "~/features/semester-organization/shared";
import type { Placement, SemesterBoard } from "./model";

type PublishState = { working: boolean; error: string | null; confirm: () => Promise<void> };

export function useReviewPublish({
  board,
  selected,
  onFeedback,
  clearSelection,
}: {
  board: SemesterBoard;
  selected: Placement[];
  onFeedback: (text: string) => void;
  clearSelection: () => void;
}): PublishState {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publish = trpc.semesterOrganization.publish.useMutation();
  const refresh = useOrganizationRefresh();
  async function confirm(): Promise<void> {
    if (working || selected.length === 0) return;
    setWorking(true);
    setError(null);
    let count = 0;
    try {
      for (const plan of board.plans) {
        const placements = selected
          .filter((row) => row.planId === plan.id)
          .map(({ id, version }) => ({ id, version }));
        if (placements.length === 0) continue;
        const result = await publish.mutateAsync({
          planId: plan.id,
          version: plan.version,
          placements,
        });
        count += result.count;
      }
      clearSelection();
      onFeedback(
        `${count} ${count === 1 ? "alocação confirmada" : "alocações confirmadas"}. Cada vínculo respeita sua data de vigência.`,
      );
    } catch (error_) {
      setError(
        `${count ? `${count} alocações foram confirmadas. ` : ""}${error_ instanceof Error ? error_.message : "Não foi possível concluir. Atualize e tente novamente."}`,
      );
    } finally {
      await refresh();
      setWorking(false);
    }
  }
  return { working, error, confirm };
}
