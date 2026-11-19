import { useState } from "react";
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

const reasons = [
  ["Turma e entrada", "waitingLead", "Interessado aguardando entrada"],
  ["Turma e entrada", "noDestination", "Sem turma de destino"],
  ["Turma e entrada", "classClosed", "Turma encerrada"],
  ["Turma e entrada", "change", "Pediu troca de turma"],
  ["Contrato e material", "missingContract", "Sem contrato vigente"],
  ["Contrato e material", "earlyContractEnd", "Contrato termina na primeira metade do período"],
  ["Contrato e material", "material", "Material sem compra registrada"],
  ["Situação acadêmica", "lowGrade", "Notas insuficientes"],
  ["Situação acadêmica", "incomplete", "Notas incompletas"],
  ["Situação acadêmica", "lowAttendance", "Frequência baixa"],
  ["Situação acadêmica", "missingAttendance", "Presença sem registros"],
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

export function ReviewReasonFilter(props: Props) {
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

function ReasonPicker({
  board,
  criteria,
  scope,
  ended,
  change,
  selected,
}: Props & { selected: string[] }) {
  const [query, setQuery] = useState("");
  const { rows, leads } = reviewResults(board, { ...criteria, atencaoVinculo: null }, scope, ended);
  const counts = new Map<string, number>();
  for (const keys of [...rows.map(reviewStudentReasonKeys), ...leads.map(reviewLeadReasonKeys)]) {
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const options: [string, string, string][] = reasons.map(([group, id, label]) => [
    group,
    id,
    label,
  ]);
  for (const id of new Set([...counts.keys(), ...selected])) {
    if (id.startsWith("blocker:")) options.push(["Impedimentos de alocação", id, id.slice(8)]);
    else if (id === "pending" || id === "unassigned")
      options.push([
        "Turma e entrada",
        id,
        id === "pending" ? "Pendências de formação" : "Precisa escolher turma",
      ]);
  }
  const groups = new Map<string, { id: string; label: string; count: number }[]>();
  const search = normalizeSearch(query);
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
  function toggle(id: string) {
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
              {items.some((i) => selected.includes(i.id)) && " ✓"}
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
        {!groups.size && <p role="status">Nenhum ponto de atenção encontrado.</p>}
      </div>
      {selected.length > 0 && (
        <Button size="sm" variant="ghost" onClick={() => change({ atencaoVinculo: null })}>
          Limpar seleção
        </Button>
      )}
    </div>
  );
}
