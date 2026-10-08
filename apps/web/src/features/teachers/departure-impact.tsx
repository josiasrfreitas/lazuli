import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Alert } from "@lazuli/ui";
import { dateLabel } from "./format";

const IMPACT_PREVIEW_LIMIT = 6;

export function DepartureImpact({ impact, date }: DepartureImpactInput): ReactElement {
  return (
    <>
      <Alert variant="warning">
        <p className="font-semibold">
          {impact.commitments.length}{" "}
          {impact.commitments.length === 1 ? "encontro afetado" : "encontros afetados"} a partir de{" "}
          {dateLabel(date)}
        </p>
        <p>
          {impact.revokedSubstitutions}{" "}
          {impact.revokedSubstitutions === 1
            ? "substituição futura será desfeita"
            : "substituições futuras serão desfeitas"}
          , inclusive quando o substituto continuar em atuação.
        </p>
      </Alert>
      {impact.commitments.length > 0 && (
        <div className="grid gap-2">
          <h3 className="text-control font-semibold">Compromissos que precisam de cobertura</h3>
          <DepartureCommitmentList impact={impact} />
          {impact.commitments.length > IMPACT_PREVIEW_LIMIT && (
            <p className="text-caption text-muted-foreground">
              E mais {impact.commitments.length - IMPACT_PREVIEW_LIMIT} encontros. A relação
              completa ficará nas pendências de docente.
            </p>
          )}
        </div>
      )}
      <p className="text-caption text-muted-foreground">
        Você pode confirmar agora e recompor a cobertura depois. As aulas permanecem programadas; os
        registros anteriores são preservados.
      </p>
    </>
  );
}

type DepartureCommitmentListProps = { impact: RouterOutputs["teachers"]["previewDeparture"] };
function DepartureCommitmentList(props: DepartureCommitmentListProps): ReactElement {
  return (
    <ul className="divide-y divide-border text-caption">
      {props.impact.commitments.slice(0, IMPACT_PREVIEW_LIMIT).map((row) => (
        <li
          key={`${row.classId}:${row.slotId ?? row.sessionId}:${row.date}`}
          className="flex flex-wrap justify-between gap-2 py-2"
        >
          <span className="font-medium">{row.classCode}</span>
          <span className="font-numeric text-muted-foreground">
            {dateLabel(row.date)} · {row.startTime}–{row.endTime}
          </span>
        </li>
      ))}
    </ul>
  );
}

type DepartureImpactInput = {
  impact: RouterOutputs["teachers"]["previewDeparture"];
  date: string;
};
