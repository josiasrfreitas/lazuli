import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { ArrowRight, Check, History } from "lucide-react";
import {
  Button,
  Checkbox,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { dateOnly, scheduleLabel } from "~/features/semester-organization/shared";
import {
  changeLabel,
  contractLabel,
  type OrganizationAction,
  type Placement,
  type SemesterBoard,
} from "./model";
import styles from "./organization.module.css";

type RowProps = {
  row: Placement;
  board: SemesterBoard;
  selected: boolean;
  eligible: boolean;
  working: boolean;
  onSelection: (value: boolean) => void;
  onAction: (action: OrganizationAction) => void;
};

export function ReviewRow({
  row,
  board,
  selected,
  eligible,
  working,
  onSelection,
  onAction,
}: RowProps): ReactJSX.Element {
  const plan = board.plans.find((item) => item.id === row.planId);
  return (
    <tr>
      <td>
        <Checkbox
          size="sm"
          aria-label={`Confirmar ${row.studentName}`}
          checked={selected}
          disabled={working || !eligible}
          onCheckedChange={(value) => onSelection(Boolean(value))}
        />
      </td>
      <td>
        <div className={styles.person}>
          <Link href={`/alunos/${row.studentId}`}>
            <strong>{row.studentName}</strong>
          </Link>
          <DiffDetails row={row} board={board} />
        </div>
      </td>
      <td>
        <ReviewOrigin row={row} />
      </td>
      <td>
        <ReviewDestination row={row} plan={plan} board={board} />
      </td>
      <td className="whitespace-nowrap">
        <ReviewTiming row={row} board={board} />
      </td>
      <td>
        <ReviewBlockers row={row} onAction={onAction} />
      </td>
      <td>
        <ReviewActions row={row} working={working} onAction={onAction} />
      </td>
    </tr>
  );
}

function ReviewOrigin({ row }: { row: Placement }): ReactJSX.Element {
  return (
    <div className={styles.origin}>
      <span>{row.sourceClassName ?? "Sem vínculo anterior"}</span>
      <span className={styles.small}>{row.sourceStageCode ?? "Nova entrada"}</span>
      <span className={styles.small}>{scheduleLabel(row.sourceSchedule) || "—"}</span>
      <span className={styles.small}>{row.sourceTeacher ?? "—"}</span>
    </div>
  );
}

function ReviewDestination({
  row,
  plan,
  board,
}: {
  row: Placement;
  plan: SemesterBoard["plans"][number] | undefined;
  board: SemesterBoard;
}): ReactJSX.Element {
  return (
    <div className={styles.destination}>
      <span className={changeLabel(row, board) === "Transferência" ? styles.changed : undefined}>
        {row.declinedAt ? "Não continuará" : (plan?.name ?? "Turma a definir")}
      </span>
      <span className={row.stageId === row.sourceStageId ? styles.small : styles.changed}>
        {row.stageCode ?? "Estágio a definir"}
      </span>
      <span className={styles.small}>{plan ? scheduleLabel(plan.slots) : "—"}</span>
      <span className={styles.small}>{plan?.teacherName ?? "Professor a definir"}</span>
    </div>
  );
}

function ReviewTiming({ row, board }: { row: Placement; board: SemesterBoard }): ReactJSX.Element {
  let status = "A confirmar";
  if (row.declinedAt) status = "Registrada";
  else if (row.publishedAt) status = "Confirmada";
  return (
    <div className={styles.person}>
      <span>{formatDateOnlyBR(dateOnly(row.effectiveDate ?? board.semester.startDate))}</span>
      <span className={styles.small}>{status}</span>
    </div>
  );
}

function ReviewBlockers({
  row,
  onAction,
}: {
  row: Placement;
  onAction: RowProps["onAction"];
}): ReactJSX.Element {
  const contract = contractLabel(row);
  return (
    <div className={styles.person}>
      {row.blockers.slice(0, 2).map((blocker) => (
        <span key={blocker} className={`${styles.small} ${styles.attention}`}>
          {blocker}
        </span>
      ))}
      {row.blockers.length > 2 && (
        <span className={styles.small}>+{row.blockers.length - 2} nos detalhes</span>
      )}
      {row.blockers.length === 0 && !row.declinedAt && (
        <span className={styles.small}>
          <Check size={12} className="inline" />
          {row.publishedAt ? "Alocação confirmada" : "Alocação pronta"}
        </span>
      )}
      {contract.warning && row.lastContract ? (
        <button
          type="button"
          className={`${styles.small} ${styles.attention} text-left underline underline-offset-4`}
          onClick={() => onAction({ kind: "renew", contractId: row.lastContract!.id })}
        >
          {contract.label} · renovar
        </button>
      ) : (
        <Link
          href={`/alunos/${row.studentId}?secao=financeiro`}
          className={`${styles.small} ${contract.warning ? styles.attention : ""}`}
        >
          {contract.label}
        </Link>
      )}
    </div>
  );
}

function ReviewActions({
  row,
  working,
  onAction,
}: {
  row: Placement;
  working: boolean;
  onAction: RowProps["onAction"];
}): ReactJSX.Element {
  return (
    <div className={styles.actions}>
      <Button
        size="sm"
        variant="ghost"
        disabled={working}
        onClick={() =>
          onAction(
            row.publishedAt
              ? { kind: "move", rows: [row] }
              : { kind: "placement", studentId: row.studentId, row },
          )
        }
      >
        Revisar
      </Button>
      {row.entryStatus === "SCHEDULED" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={working}
          onClick={() => onAction({ kind: "withdraw", row })}
        >
          Desfazer
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Histórico de ${row.studentName}`}
        onClick={() => onAction({ kind: "history", row })}
      >
        <History size={14} />
      </Button>
    </div>
  );
}

function diffFields(row: Placement, board: SemesterBoard): [string, string, string][] {
  const plan = board.plans.find((item) => item.id === row.planId);
  return [
    ["Turma", row.sourceClassName ?? "Sem turma", plan?.name ?? "A definir"],
    ["Estágio", row.sourceStageCode ?? "—", row.stageCode ?? "A definir"],
    ...staffFields(row, plan),
  ];
}

function staffFields(
  row: Placement,
  plan: SemesterBoard["plans"][number] | undefined,
): [string, string, string][] {
  return [
    [
      "Horário",
      scheduleLabel(row.sourceSchedule) || "—",
      plan ? scheduleLabel(plan.slots) : "A definir",
    ],
    ["Professor", row.sourceTeacher ?? "—", plan?.teacherName ?? "A definir"],
  ];
}

function DiffDetails({ row, board }: { row: Placement; board: SemesterBoard }): ReactJSX.Element {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={300}
        className="text-micro text-interactive text-left underline underline-offset-4"
      >
        {changeLabel(row, board)} · detalhes
      </PopoverTrigger>
      <PopoverContent size="lg">
        <PopoverTitle>{row.studentName}</PopoverTitle>
        <div className={`${styles.diffDetails} mt-3`}>
          {diffFields(row, board).map(([label, before, after]) => (
            <div key={label}>
              <span className={styles.small}>{label}</span>
              <div className={styles.diffLine}>
                <span className={styles.origin}>{before}</span>
                <ArrowRight size={12} />
                <span className={before === after ? undefined : styles.changed}>{after}</span>
              </div>
            </div>
          ))}
          <p>
            Válida a partir de{" "}
            {formatDateOnlyBR(dateOnly(row.effectiveDate ?? board.semester.startDate))}.
          </p>
          {row.notes && <p className={styles.small}>{row.notes}</p>}
          {row.blockers.map((blocker) => (
            <p key={blocker} className={styles.attention}>
              {blocker}
            </p>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
