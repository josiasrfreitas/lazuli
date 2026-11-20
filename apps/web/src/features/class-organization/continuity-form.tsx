"use client";
import type { ReactElement } from "react";
import type { Placement, OrganizationBoard } from "./model";
import { CaseForm } from "./case-form";
import { useOrganizationRefresh } from "./shared";

type Props = {
  row: Placement;
  board: OrganizationBoard;
  onFeedback: (message: string) => void;
  onClose: () => void;
};

export function ContinuityDialog(props: Props): ReactElement {
  const refresh = useOrganizationRefresh();
  return (
    <CaseForm
      id={props.row.id}
      semesterId={props.row.semesterId}
      version={props.row.version}
      hasBlock={Boolean(props.row.attentionNote)}
      description={`${props.row.studentName} · ${props.board.semester.name}`}
      mode="signal"
      onClose={props.onClose}
      onSaved={async () => {
        await refresh();
        props.onFeedback(`${props.row.studentName} · Sinalização registrada.`);
      }}
    />
  );
}
