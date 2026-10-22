"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { type OrganizationAction, type SemesterBoard } from "./model";
import { useReviewPublish } from "./review-publish";
import { ReviewView } from "./review-view";

export function OrganizationReview({
  board,
  query,
  onAction,
  onFeedback,
}: {
  board: SemesterBoard;
  query: string;
  onAction: (action: OrganizationAction) => void;
  onFeedback: (text: string) => void;
}): ReactJSX.Element {
  const [ids, setIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const rows = board.placements.filter(
    (row) =>
      (showAll || !row.publishedAt) &&
      row.studentName.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
  );
  const eligible = rows.filter(
    (row) => !row.publishedAt && !row.declinedAt && row.blockers.length === 0 && row.planId,
  );
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
      ids={ids}
      showAll={showAll}
      working={working}
      error={error}
      onShowAll={setShowAll}
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
