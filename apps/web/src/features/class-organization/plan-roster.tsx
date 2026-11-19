"use client";

import { useState, type ReactElement } from "react";
import { Badge, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { ChevronRight } from "lucide-react";
import { StudentAvatar } from "~/components/student-avatar";
import { SelectControl } from "~/features/classes/form-controls";
import {
  rosterAttentionReasons,
  rosterRiskOptions,
  type AttentionReason,
} from "./attention-reasons";
import { confirmationLabels, confirmationVariants } from "./confirmation";
import { FormationReason } from "./formation-reason";
import { LeadItem } from "./formation-roster";
import type { OrganizationBoard, Placement } from "./model";
import type { PanelPerson } from "./use-formation-navigation";
import styles from "./plan-roster.module.css";

type SelectPerson = (person: PanelPerson, origin: HTMLElement) => void;
const statuses = [
  ["all", "Todos"],
  ["CONFIRMED", "Confirmado na turma"],
  ["PRECONFIRMED", "Pré-confirmado"],
  ["BLOCKED", "Continuidade bloqueada"],
  ["PENDING", "A confirmar"],
  ["risk", "Em risco"],
] as const;
type Entry = { row: Placement; reasons: AttentionReason[]; risks: Set<string> };

function rosterEntry(row: Placement): Entry {
  const reasons = rosterAttentionReasons(row);
  const risks = new Set(reasons.flatMap((reason) => (reason.risk ? [reason.risk] : [])));
  return { row, reasons, risks };
}

function matchesStatus({ row, risks }: Entry, status: string): boolean {
  return status === "all" || (status === "risk" ? risks.size > 0 : row.confirmation === status);
}

function StudentLine({
  entry,
  showStage,
  onSelect,
}: {
  entry: Entry;
  showStage: boolean;
  onSelect: SelectPerson;
}): ReactElement {
  const { row, reasons } = entry;
  const blocked = row.confirmation === "BLOCKED";
  const blockers = blocked ? reasons.filter((reason) => reason.blocker) : [];
  const attention = blocked ? reasons.filter((reason) => !reason.blocker) : reasons;
  const average = row.attention.gradeAverage?.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        aria-label={[
          `Revisar ${row.studentName}`,
          showStage && (row.stageName ?? "Estágio a definir"),
          confirmationLabels[row.confirmation],
          average && `Média ${average}`,
          ...reasons.map((reason) => reason.label),
        ]
          .filter(Boolean)
          .join(" · ")}
        data-formation-focus={`person-${row.id}`}
        onClick={(event) => onSelect({ kind: "student", id: row.id }, event.currentTarget)}
      >
        <span className={styles.identity}>
          <StudentAvatar size="md" name={row.studentName} colorKey={row.studentId} />
          <span>
            <strong>{row.studentName}</strong>
            {showStage && <small>{row.stageName ?? "Estágio a definir"}</small>}
          </span>
        </span>
        <span className={styles.status}>
          {blockers.length ? (
            blockers.map((reason) => <FormationReason key={reason.risk} reason={reason} />)
          ) : (
            <Badge variant={confirmationVariants[row.confirmation]}>
              {confirmationLabels[row.confirmation]}
            </Badge>
          )}
        </span>
        <span className={styles.grade} data-low={entry.risks.has("lowGrade") || undefined}>
          <span className={styles.mobileLabel}>Média </span>
          {average ?? "—"}
        </span>
        <span className={styles.reasons} data-empty={attention.length === 0 || undefined}>
          {attention.length
            ? attention.map((reason) => <FormationReason key={reason.risk} reason={reason} />)
            : "—"}
        </span>
        <ChevronRight className={styles.arrow} size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

const initialCriteria = { status: "all", risk: "all" };
type Criteria = typeof initialCriteria;

type RosterFilters = {
  forPlan: (id: string) => Criteria;
  update: (id: string, criteria: Criteria) => void;
};

export function usePlanRosterFilters(): RosterFilters {
  const [byPlan, setByPlan] = useState<Record<string, Criteria>>({});
  return {
    forPlan: (id: string) => byPlan[id] ?? initialCriteria,
    update: (id: string, criteria: Criteria) =>
      setByPlan((previous) => ({ ...previous, [id]: criteria })),
  };
}

export function PlanRoster({
  planId,
  filters,
  rows,
  leads,
  onSelect,
}: {
  planId: string;
  filters: RosterFilters;
  rows: Placement[];
  leads: OrganizationBoard["waitingLeads"];
  onSelect: SelectPerson;
}): ReactElement {
  const { status, risk: selectedRisk } = filters.forPlan(planId);
  const entries = rows.map(rosterEntry);
  const riskOptions = rosterRiskOptions(entries);
  const risk = riskOptions.some((option) => option.value === selectedRisk) ? selectedRisk : "all";
  const showStage = new Set(rows.map((row) => row.stageId)).size > 1;
  const visible = entries.filter(
    (entry) =>
      matchesStatus(entry, status) &&
      (status !== "risk" || risk === "all" || entry.risks.has(risk)),
  );
  return (
    <div className={styles.roster}>
      <section aria-label="Alunos da turma">
        <RosterHeader
          status={status}
          risk={risk}
          entries={entries}
          riskOptions={riskOptions}
          update={(criteria) => filters.update(planId, criteria)}
        />
        <span className="sr-only" role="status">
          {visible.length} {visible.length === 1 ? "aluno na lista" : "alunos na lista"}
        </span>
        {visible.length ? (
          <>
            <div className={styles.columns} aria-hidden="true">
              <span>Aluno</span>
              <span>Confirmação</span>
              <span>Média</span>
              <span>Pontos de atenção</span>
            </div>
            <ul className={styles.list}>
              {visible.map((entry) => (
                <StudentLine
                  key={entry.row.id}
                  entry={entry}
                  showStage={showStage}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.empty}>
            {rows.length
              ? "Nenhum aluno corresponde ao filtro selecionado."
              : "Nenhum aluno proposto para esta turma."}
          </p>
        )}
      </section>
      {leads.length > 0 && (
        <section aria-label="Leads com turma proposta">
          <h2 className={styles.leadsTitle}>Leads com turma proposta</h2>
          {leads.map((lead) => (
            <LeadItem key={lead.id} lead={lead} onSelect={onSelect} />
          ))}
        </section>
      )}
    </div>
  );
}

function RosterHeader({
  status,
  risk,
  entries,
  riskOptions,
  update,
}: Criteria & {
  entries: Entry[];
  riskOptions: ReturnType<typeof rosterRiskOptions>;
  update: (criteria: Criteria) => void;
}): ReactElement {
  return (
    <header className={styles.header}>
      <h2>Alunos da turma</h2>
      <SegmentedControl
        value={status}
        size="sm"
        wrap
        aria-label="Filtrar alunos da turma"
        onValueChange={(value) => {
          update({ status: value ?? "all", risk: "all" });
        }}
      >
        {statuses.map(([key, label]) => (
          <SegmentedControlItem key={key} value={key}>
            {label} · {entries.filter((entry) => matchesStatus(entry, key)).length}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      {status === "risk" && (
        <div className={styles.riskFilter}>
          <SelectControl
            name="formation-roster-risk"
            label="Motivo do risco"
            choices={riskOptions}
            value={risk}
            onChange={(value) => update({ status, risk: value })}
          />
        </div>
      )}
    </header>
  );
}
