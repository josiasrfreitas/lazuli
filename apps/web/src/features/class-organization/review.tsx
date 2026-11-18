"use client";
import type { JSX as ReactJSX } from "react";
import { normalizeSearch } from "@lazuli/domain";
import { useState } from "react";
import { type OrganizationAction, type OrganizationBoard } from "./model";
import { isReadyForAllocation } from "./confirmation";
import { useReviewPublish } from "./review-publish";
import { ReviewView } from "./review-view";

export function OrganizationReview({
  board,
  ended,
  query,
  scope,
  onAction,
  onFeedback,
}: {
  board: OrganizationBoard;
  ended: boolean;
  query: string;
  scope: "pending" | "published" | "all";
  onAction: (action: OrganizationAction) => void;
  onFeedback: (text: string) => void;
}): ReactJSX.Element {
  const [ids, setIds] = useState<string[]>([]);
  const rows = board.placements.filter(
    (row) =>
      (scope === "all" ||
        (scope === "published"
          ? Boolean(row.publishedAt && !row.declinedAt)
          : !row.publishedAt && !row.declinedAt)) &&
      normalizeSearch(row.studentName).includes(normalizeSearch(query)),
  );
  const eligible = ended ? [] : rows.filter(isReadyForAllocation);
  const selected = eligible.filter((row) => ids.includes(row.id));
  const { working, error, confirm } = useReviewPublish({
    board,
    selected,
    onFeedback,
    clearSelection: () => setIds([]),
  });
  return (
    <ReviewView
      board={board}
      rows={rows}
      eligible={eligible}
      selected={selected}
      showSelection={!ended && scope !== "published"}
      scope={scope}
      working={working}
      error={error}
      onIds={setIds}
      onSelection={(row, value) =>
        setIds((previous) =>
          value ? [...previous, row.id] : previous.filter((id) => id !== row.id),
        )
      }
      onAction={onAction}
      onConfirm={() => void confirm()}
    />
  );
}
