import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { ToastAlert } from "@lazuli/ui";
import { dateLabel } from "./format";
import { purposes } from "../appointments/shared";

const IMPACT_PREVIEW_LIMIT = 6;

export function DepartureImpact({ impact, date }: DepartureImpactInput): ReactElement {
  return (
    <>
      <ToastAlert variant="warning">
        <p className="font-semibold">
          {impact.commitments.length + impact.appointments.length}{" "}
          {impact.commitments.length + impact.appointments.length === 1
            ? "encontro afetado"
            : "encontros afetados"}{" "}
          a partir de {dateLabel(date)}
        </p>
        <p>
          {impact.revokedSubstitutions}{" "}
          {impact.revokedSubstitutions === 1
            ? "substituição futura será desfeita"
            : "substituições futuras serão desfeitas"}
          , inclusive quando o substituto continuar em atuação.
        </p>
      </ToastAlert>
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
      <DepartureAppointments impact={impact} />
      <p className="text-caption text-muted-foreground">
        Você pode confirmar agora e recompor a cobertura depois. Aulas e atendimentos permanecem
        programados; os registros anteriores são preservados.
      </p>
    </>
  );
}

function DepartureAppointments({ impact }: DepartureCommitmentListProps): ReactElement | null {
  if (impact.appointments.length === 0) return null;
  return (
    <div className="grid gap-2">
      <h3 className="text-control font-semibold">Atendimentos que precisam de reagendamento</h3>
      <ul className="divide-y divide-border text-caption">
        {impact.appointments.slice(0, IMPACT_PREVIEW_LIMIT).map((row) => (
          <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="font-medium">
              {row.studentName} · {purposes[row.purpose]}
            </span>
            <span className="font-numeric text-muted-foreground">
              {dateLabel(row.date)} · {row.startTime}–{row.endTime}
            </span>
          </li>
        ))}
      </ul>
      {impact.appointments.length > IMPACT_PREVIEW_LIMIT && (
        <p className="text-caption text-muted-foreground">
          E mais {impact.appointments.length - IMPACT_PREVIEW_LIMIT} atendimentos nas pendências de
          docente.
        </p>
      )}
    </div>
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
