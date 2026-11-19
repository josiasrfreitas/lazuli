import { useState, type ReactElement } from "react";
import { normalizeSearch } from "@lazuli/domain";
import { Button, Checkbox, Input, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { ListFilter } from "lucide-react";
import { selectedReviewReasons } from "./attention-reasons";
import type { OrganizationBoard } from "./model";
import {
  allowsAttention,
  reviewResults,
  reviewLeadReasonKeys,
  reviewStudentReasonKeys,
  type ChangeCriteria,
  type ReviewCriteria,
  type ReviewScope,
} from "./review-filters";

const placementGroup = "Turma e entrada";
const contractGroup = "Contrato e material";
const academicGroup = "Situação acadêmica";
const blockerPrefix = "blocker:";
const reasons = [
  [placementGroup, "waitingLead", "Interessado aguardando entrada"],
  [placementGroup, "noDestination", "Sem turma de destino"],
  [placementGroup, "classClosed", "Turma encerrada"],
  [placementGroup, "change", "Pediu troca de turma"],
  [contractGroup, "missingContract", "Sem contrato vigente"],
  [contractGroup, "earlyContractEnd", "Contrato termina na primeira metade do período"],
  [contractGroup, "material", "Material sem compra registrada"],
  [academicGroup, "lowGrade", "Notas insuficientes"],
  [academicGroup, "incomplete", "Notas incompletas"],
  [academicGroup, "lowAttendance", "Frequência baixa"],
  [academicGroup, "missingAttendance", "Presença sem registros"],
  ["Continuidade", "leaving", "Risco de saída"],
  ["Acompanhamento", "lowHealth", "Score de saúde do vínculo baixo"],
  ["Continuidade", "staff", "Impedimento sinalizado pela equipe"],
  ["Acompanhamento", "other", "Observação da equipe"],
] as const;

type Props = {
  board: OrganizationBoard;
  criteria: ReviewCriteria;
  scope: ReviewScope;
  ended: boolean;
  change: ChangeCriteria;
};

export function ReviewReasonFilter(props: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const selected = selectedReviewReasons(props.criteria.atencaoVinculo);
  if (!allowsAttention(props.scope))
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled
        title="Disponível para Todos, Em revisão e Continuidade bloqueada."
      >
        <ListFilter /> Pontos de atenção
      </Button>
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="secondary" size="sm" />}>
        <ListFilter /> Pontos de atenção {selected.length > 0 && `(${selected.length})`}
      </PopoverTrigger>
      {open && (
        <PopoverContent align="start" aria-label="Pontos de atenção">
          <ReasonPicker {...props} selected={selected} />
        </PopoverContent>
      )}
    </Popover>
  );
}

function reasonCounts({ board, criteria, scope, ended }: Props): Map<string, number> {
  const { rows, leads } = reviewResults(board, {
    criteria: { ...criteria, atencaoVinculo: null },
    scope,
    ended,
  });
  const counts = new Map<string, number>();
  const allKeys = [
    ...rows.map((row) => reviewStudentReasonKeys(row)),
    ...leads.map((lead) => reviewLeadReasonKeys(lead)),
  ];
  for (const keys of allKeys) {
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

type ReasonGroup = Map<string, { id: string; label: string; count: number }[]>;
type ReasonOption = readonly [group: string, id: string, label: string];

function reasonOptions(ids: Set<string>): ReasonOption[] {
  const options: ReasonOption[] = [...reasons];
  for (const id of ids) {
    if (id.startsWith(blockerPrefix))
      options.push(["Impedimentos de alocação", id, id.slice(blockerPrefix.length)]);
    else if (id === "pending" || id === "unassigned")
      options.push([
        placementGroup,
        id,
        id === "pending" ? "Pendências de formação" : "Precisa escolher turma",
      ]);
  }
  return options;
}

function groupReasonOptions(
  counts: Map<string, number>,
  { selected, search }: { selected: string[]; search: string },
): ReasonGroup {
  const options = reasonOptions(new Set([...counts.keys(), ...selected]));
  const groups: ReasonGroup = new Map();
  for (const [group, id, label] of options) {
    const count = counts.get(id) ?? 0;
    if (
      (!count && !selected.includes(id)) ||
      !normalizeSearch(group + " " + label).includes(search)
    )
      continue;
    const items = groups.get(group) ?? [];
    items.push({ id, label, count });
    groups.set(group, items);
  }
  return groups;
}

function ReasonPicker(props: Props & { selected: string[] }): ReactElement {
  const { change, selected } = props;
  const [query, setQuery] = useState("");
  const search = normalizeSearch(query);
  const groups = groupReasonOptions(reasonCounts(props), { selected, search });
  function toggle(id: string): void {
    const next = selected.includes(id) ? selected.filter((key) => key !== id) : [...selected, id];
    change({ atencaoVinculo: next.join("|") || null });
  }
  return (
    <div className="grid gap-2">
      <Input
        size="sm"
        type="search"
        aria-label="Buscar ponto de atenção"
        placeholder="Buscar ponto de atenção"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="scrollbar-subtle max-h-72 overflow-y-auto pe-4 [scrollbar-gutter:stable]">
        {[...groups].map(([group, items]) => (
          <details
            key={group + (search ? "-search" : "")}
            open={search ? true : undefined}
            className="border-b border-border py-1"
          >
            <summary className="cursor-pointer py-1 font-semibold">
              {group}
              {items.some((item) => selected.includes(item.id)) && " ✓"}
            </summary>
            {items.map(({ id, label, count }) => (
              <label key={id} className="flex cursor-pointer items-center gap-2 py-1.5">
                <Checkbox checked={selected.includes(id)} onCheckedChange={() => toggle(id)} />
                <span className="flex-1">{label}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </label>
            ))}
          </details>
        ))}
        {groups.size === 0 && <p role="status">Nenhum ponto de atenção encontrado.</p>}
      </div>
      {selected.length > 0 && (
        <Button size="sm" variant="ghost" onClick={() => change({ atencaoVinculo: null })}>
          Limpar seleção
        </Button>
      )}
    </div>
  );
}
