import type { ReactElement } from "react";
import { Badge } from "@lazuli/ui";
import { Check, ChevronRight, UsersRound } from "lucide-react";
import { StudentAvatar } from "~/components/student-avatar";
import { attentionReasons } from "./attention-reasons";
import { confirmationLabels, confirmationVariants, isConfirmed } from "./confirmation";
import type { OrganizationBoard, Placement } from "./model";
import { scheduleLabel } from "./shared";
import type { PanelPerson } from "./use-formation-navigation";
import styles from "./formation.module.css";

type SelectPerson = (person: PanelPerson, origin: HTMLElement) => void;
type WaitingLead = OrganizationBoard["waitingLeads"][number];

export function FormationPersonRow({
  row,
  filter,
  onSelect,
  compact = false,
}: {
  row: Placement;
  filter?: string;
  onSelect: SelectPerson;
  compact?: boolean;
}): ReactElement {
  const reasons = attentionReasons(row);
  const primary = reasons.find((reason) => reason.kind === filter) ?? reasons[0];
  const issue = primary?.label ?? row.blockers[0];
  const listed = compact
    ? issue
      ? [issue]
      : []
    : [...new Set(reasons.map((reason) => reason.label))];
  if (!compact && !listed.length && issue) listed.push(issue);
  const numberOfIssues = reasons.length || (issue ? 1 : 0);
  return (
    <button
      className={styles.personRow}
      data-compact={compact}
      type="button"
      data-formation-focus={`person-${row.id}`}
      aria-label={`Revisar ${row.studentName} · ${confirmationLabels[row.confirmation]}`}
      onClick={(event) => onSelect({ kind: "student", id: row.id }, event.currentTarget)}
    >
      {!compact && <StudentAvatar size="md" name={row.studentName} colorKey={row.studentId} />}
      <span className={styles.personIdentity}>
        <strong>{row.studentName}</strong>
        <small>
          {compact
            ? [row.sourceClassName, row.stageCode].filter(Boolean).join(" · ") || "Nova entrada"
            : (row.stageCode ?? "Estágio a definir")}
        </small>
      </span>
      {!compact && (
        <span className={styles.gradeValue}>
          Média{" "}
          <strong>
            {row.attention.gradeAverage?.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) ??
              "—"}
          </strong>
        </span>
      )}
      <span className={styles.personBadges}>
        {(!compact || isConfirmed(row) || !issue) && (
          <Badge variant={confirmationVariants[row.confirmation]}>
            {isConfirmed(row) && <Check size={12} />} {confirmationLabels[row.confirmation]}
          </Badge>
        )}
        {listed.map((label) => (
          <Badge key={label} variant="warning">
            {label}
          </Badge>
        ))}
        {compact && numberOfIssues > listed.length && (
          <small>+{numberOfIssues - listed.length}</small>
        )}
      </span>
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  );
}

export function LeadItem({
  lead,
  onSelect,
}: {
  lead: WaitingLead;
  onSelect: SelectPerson;
}): ReactElement {
  return (
    <button
      type="button"
      className={styles.item}
      data-formation-focus={`lead-${lead.id}`}
      onClick={(event) => onSelect({ kind: "lead", id: lead.id }, event.currentTarget)}
    >
      <span>
        <strong>{lead.fullName}</strong>
        <small>
          Lead · {lead.stage?.internalCode ?? "Estágio a definir"}
          {lead.allocationPlanId ? " · Turma proposta" : ""}
        </small>
      </span>
      <ChevronRight size={14} />
    </button>
  );
}

export function GroupedQueue({
  rows,
  leads,
  onSelect,
  filter,
}: {
  rows: Placement[];
  leads: WaitingLead[];
  onSelect: SelectPerson;
  filter: string;
}): ReactElement {
  const groups = new Map<string | null, Placement[]>();
  for (const row of rows) {
    const members = groups.get(row.sourceClassId);
    if (members) members.push(row);
    else groups.set(row.sourceClassId, [row]);
  }
  const ordered = [...groups.values()].sort((a, b) => {
    const left = a[0]?.sourceClassName;
    const right = b[0]?.sourceClassName;
    if (!left) return right ? 1 : 0;
    return right ? left.localeCompare(right, "pt-BR", { numeric: true }) : -1;
  });
  return (
    <div className={styles.groupScroll} data-formation-scroll="">
      {ordered.map((members) => {
        const first = members[0]!;
        return (
          <section key={first.sourceClassId ?? "no-source"} className={styles.rosterGroup}>
            <header>
              <div>
                <h3>
                  <UsersRound size={16} /> {first.sourceClassName ?? "Alunos sem turma de origem"}
                </h3>
                {first.sourceClassId && (
                  <p>
                    {[
                      first.sourceTeacher ?? "Professor a definir",
                      scheduleLabel(first.sourceSchedule),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <small>
                {members.length} {members.length === 1 ? "aluno" : "alunos"}
              </small>
            </header>
            {members.map((row) => (
              <FormationPersonRow key={row.id} row={row} filter={filter} onSelect={onSelect} />
            ))}
          </section>
        );
      })}
      {leads.length > 0 && (
        <section className={styles.rosterGroup}>
          <header>
            <h3>Leads aguardando entrada</h3>
            <small>{leads.length}</small>
          </header>
          {leads.map((lead) => (
            <LeadItem key={lead.id} lead={lead} onSelect={onSelect} />
          ))}
        </section>
      )}
    </div>
  );
}
