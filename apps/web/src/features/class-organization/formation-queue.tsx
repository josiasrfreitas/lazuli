"use client";
import { useState, type ReactElement } from "react";
import { ArrowLeft, CheckCheck, Filter, Plus, Search, Rows3 } from "lucide-react";
import { Button, Input } from "@lazuli/ui";
import { normalizeSearch } from "@lazuli/domain";
import { SelectControl } from "~/features/classes/form-controls";
import { needsPlace, matchesFilter } from "./attention-reasons";
import { FormationPersonRow, GroupedQueue, LeadItem } from "./formation-roster";
import type { OrganizationBoard, OrganizationAction, Placement } from "./model";
import type { PanelPerson } from "./use-formation-navigation";
import styles from "./formation.module.css";

type QueueProps = {
  board: OrganizationBoard;
  ended: boolean;
  hidden: boolean;
  grouped: boolean;
  expandQueue: (origin: HTMLElement) => void;
  onBack: () => void;
  onAction: (action: OrganizationAction) => void;
  onSelect: (selection: PanelPerson, origin: HTMLElement) => void;
};
type Lead = OrganizationBoard["waitingLeads"][number];
const filters = [
  ["pending", "Todas as pendências"],
  ["unassigned", "Sem turma"],
  ["contract", "Contrato"],
  ["grades", "Notas e médias"],
  ["attendance", "Presença"],
  ["engagement", "Evasão e desinteresse"],
  ["material", "Material sem compra registrada"],
  ["all", "Todos os alunos"],
] as const;

type QueueCriteria = { filter: string; query: string; stage: string; stageKind: string };
function matchingPeople(
  board: OrganizationBoard,
  { filter, query, stage, stageKind }: QueueCriteria,
): { rows: Placement[]; leads: Lead[] } {
  const search = normalizeSearch(query);
  const rows = board.placements
    .filter(
      (row) =>
        !row.declinedAt &&
        matchesFilter(row, filter) &&
        normalizeSearch(row.studentName).includes(search) &&
        (stage === "all" || stage === (stageKind === "source" ? row.sourceStageId : row.stageId)),
    )
    .toSorted((left, right) => Number(needsPlace(right)) - Number(needsPlace(left)));
  const leads = board.waitingLeads.filter(
    (lead) =>
      ["pending", "unassigned", "all"].includes(filter) &&
      (filter !== "unassigned" || !lead.allocationPlanId) &&
      normalizeSearch(lead.fullName).includes(search) &&
      (stage === "all" || (stageKind === "chosen" && lead.stageId === stage)),
  );
  return { rows, leads };
}
function stageOptions(board: OrganizationBoard, stageKind: string): Map<string, string> {
  const stages = new Map<string, string>();
  for (const row of board.placements) {
    const id = stageKind === "source" ? row.sourceStageId : row.stageId;
    const code = stageKind === "source" ? row.sourceStageCode : row.stageCode;
    if (id && code) stages.set(id, code);
  }
  if (stageKind === "chosen")
    for (const row of board.waitingLeads)
      if (row.stageId && row.stage) stages.set(row.stageId, row.stage.internalCode);
  return stages;
}
const initialCriteria: QueueCriteria = {
  filter: "pending",
  query: "",
  stage: "all",
  stageKind: "chosen",
};
export function FormationQueue({
  board,
  ended,
  hidden,
  grouped,
  expandQueue,
  onBack,
  onAction,
  onSelect,
}: QueueProps): ReactElement | null {
  const [criteria, setCriteria] = useState(initialCriteria);
  const [filterOpen, setFilterOpen] = useState(false);
  if (hidden) return null;
  const { rows, leads } = matchingPeople(board, criteria);
  const stages = stageOptions(board, criteria.stageKind);
  const count = rows.length + leads.length;
  const update = (patch: Partial<QueueCriteria>): void =>
    setCriteria((current) => ({ ...current, ...patch }));
  return (
    <>
      <div className={styles.panelTitle}>
        {grouped && (
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft size={14} /> Voltar à grade
          </Button>
        )}
        <h2 id="formation-panel-heading" tabIndex={-1}>
          {grouped ? "Pendências por turma" : "Pendências"}
        </h2>
        <span className={styles.count}>{count}</span>
        {!grouped && (
          <Button
            size="sm"
            variant="secondary"
            data-formation-focus="expand-queue"
            onClick={(event) => expandQueue(event.currentTarget)}
          >
            <Rows3 size={14} /> Por turma
          </Button>
        )}
        {!ended && (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Adicionar aluno à formação"
            onClick={() => onAction({ kind: "findStudent" })}
          >
            <Plus size={16} />
          </Button>
        )}
      </div>
      <QueueFilters
        criteria={criteria}
        update={update}
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
        stages={stages}
      />
      {!ended && criteria.filter === "unassigned" && criteria.stageKind === "chosen" && (
        <FormGroup
          stage={criteria.stage}
          stages={stages}
          rows={rows}
          leads={leads}
          onAction={onAction}
        />
      )}
      {grouped && count > 0 ? (
        <GroupedQueue rows={rows} leads={leads} onSelect={onSelect} filter={criteria.filter} />
      ) : (
        <QueueResults
          rows={rows}
          leads={leads}
          filter={criteria.filter}
          isDefault={criteria.filter === "pending" && !criteria.query && criteria.stage === "all"}
          onSelect={onSelect}
          reset={() => setCriteria({ ...initialCriteria, filter: "all" })}
        />
      )}
    </>
  );
}
function FormGroup({
  stage,
  stages,
  rows,
  leads,
  onAction,
}: {
  stage: string;
  stages: Map<string, string>;
  rows: Placement[];
  leads: Lead[];
  onAction: QueueProps["onAction"];
}): ReactElement | null {
  const stageCode = stages.get(stage);
  const unassigned = rows.filter((row) => !row.publishedAt);
  if (!stageCode || unassigned.length + leads.length === 0) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() =>
        onAction({ kind: "plan", group: { stageId: stage, stageCode, rows: unassigned, leads } })
      }
    >
      Formar turma de {stageCode}
    </Button>
  );
}
function QueueFilters({
  criteria,
  update,
  filterOpen,
  setFilterOpen,
  stages,
}: {
  criteria: QueueCriteria;
  update: (patch: Partial<QueueCriteria>) => void;
  filterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  stages: Map<string, string>;
}): ReactElement {
  const { filter, query, stage, stageKind } = criteria;
  return (
    <div className={styles.panelControls}>
      <div className={styles.find}>
        <Input
          size="sm"
          aria-label="Buscar na fila"
          leadingIcon={<Search />}
          placeholder="Buscar aluno ou lead"
          value={query}
          onChange={(event) => update({ query: event.target.value })}
        />
        <Button
          size="sm"
          variant={filterOpen || stage !== "all" ? "secondary" : "ghost"}
          aria-label="Filtrar por estágio"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <Filter size={15} />
        </Button>
      </div>
      <SelectControl
        name="formation-attention"
        label="Motivo de atenção"
        hideLabel
        value={filter}
        onChange={(value) => update({ filter: value })}
        choices={filters.map(([value, label]) => ({ value, label }))}
      />
      {filterOpen && (
        <>
          <SelectControl
            name="formation-stage-kind"
            label="Recorte de estágio"
            value={stageKind}
            onChange={(value) => update({ stageKind: value, stage: "all" })}
            choices={[
              { value: "chosen", label: "Estágio de destino" },
              { value: "source", label: "Estágio anterior" },
            ]}
          />
          <SelectControl
            name="formation-stage"
            label="Estágio"
            value={stage}
            onChange={(value) => update({ stage: value })}
            choices={[
              { value: "all", label: "Todos os estágios" },
              ...[...stages]
                .toSorted((left, right) => left[1].localeCompare(right[1], "pt-BR"))
                .map(([value, label]) => ({ value, label })),
            ]}
          />
        </>
      )}
    </div>
  );
}
function QueueResults({
  rows,
  leads,
  filter,
  isDefault,
  reset,
  onSelect,
}: {
  rows: Placement[];
  leads: Lead[];
  filter: string;
  isDefault: boolean;
  reset: () => void;
  onSelect: QueueProps["onSelect"];
}): ReactElement {
  const count = rows.length + leads.length;
  return (
    <div className={styles.panelScroll} data-formation-scroll="">
      {rows.map((row) => (
        <FormationPersonRow key={row.id} row={row} filter={filter} onSelect={onSelect} compact />
      ))}
      {leads.map((lead) => (
        <LeadItem key={lead.id} lead={lead} onSelect={onSelect} />
      ))}
      {count === 0 && (
        <div className={styles.zero}>
          <CheckCheck size={24} />
          <h3>{isDefault ? "Fila de pendências em dia" : "Nenhum aluno neste recorte"}</h3>
          <Button size="sm" variant="ghost" onClick={reset}>
            Ver todos os alunos
          </Button>
        </div>
      )}
    </div>
  );
}
