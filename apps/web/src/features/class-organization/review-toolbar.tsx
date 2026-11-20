import { useId, useState } from "react";
import { ReviewReasonFilter } from "./review-reason-filter";
import { normalizeSearch } from "@lazuli/domain";
import type { ReactElement } from "react";
import { ArrowDownWideNarrow, ListFilter, Search } from "lucide-react";
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
  TableFilters,
  type TableFilterField,
} from "@lazuli/ui";
import { SelectControl } from "~/features/classes/form-controls";
import type { OrganizationBoard, Placement } from "./model";
import {
  allowsAttention,
  REVIEW_NO_STAGE,
  type ChangeCriteria,
  type ReviewCriteria,
  type ReviewScope,
} from "./review-filters";
import { findReviewClasses, reviewClassChoices } from "./review-class-search";
import { collator } from "./review-group-model";
import styles from "./review.module.css";

const scopeOptions = {
  all: {
    label: "Todos",
    description: "Alunos e interessados do período, incluindo as saídas registradas.",
  },
  ready: {
    label: "Pré-confirmados",
    description: "Podem seguir com a própria turma e aguardam confirmação.",
  },
  blocked: {
    label: "Continuidade bloqueada",
    description: "Há um impedimento para o aluno seguir com a própria turma.",
  },
  published: {
    label: "Confirmados na turma",
    description: "O vínculo com a turma já foi efetivado ou agendado.",
  },
  pending: {
    label: "Em revisão",
    description: "Aguardam confirmação, incluindo pré-confirmados e alunos com impedimentos.",
  },
} satisfies Record<ReviewScope, { label: string; description: string }>;
const sortChoices = [
  { value: "destino", label: "Turma A–Z" },
  { value: "nome", label: "Nome do aluno" },
  { value: "vigencia", label: "Vigência mais próxima" },
] as const;
type ToolbarProps = {
  board: OrganizationBoard;
  criteria: ReviewCriteria;
  change: ChangeCriteria;
  scope: ReviewScope;
  counts: Record<ReviewScope, number>;
  ended: boolean;
};
type FilterKey =
  | "estagioVinculo"
  | "origemVinculo"
  | "destinoVinculo"
  | "estagioOrigem"
  | "professorVinculo"
  | "modalidadeVinculo";
type Option = { id: string; label: string };
type FilterOption = {
  key: FilterKey;
  label: string;
  options: Option[];
};

type StageLabels = {
  stages: Map<string, string>;
  pastStages: Map<string, string>;
  codes: Map<string, string>;
};

function recordOriginStage(row: Placement, { pastStages, codes }: StageLabels): void {
  if (!row.sourceStageId) return;
  if (row.sourceStageCode) codes.set(row.sourceStageId, row.sourceStageCode);
  pastStages.set(row.sourceStageId, row.sourceStageName ?? row.sourceStageCode ?? "A definir");
}

function recordStage(row: Placement, labels: StageLabels): void {
  if (!row.declinedAt)
    labels.stages.set(
      row.stageId ?? REVIEW_NO_STAGE,
      row.stageName ?? row.stageCode ?? "A definir",
    );
  if (row.stageId && row.stageCode) labels.codes.set(row.stageId, row.stageCode);
  recordOriginStage(row, labels);
}

function stageLabels(board: OrganizationBoard): StageLabels {
  const stages = new Map<string, string>();
  const pastStages = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const lead of board.waitingLeads) {
    stages.set(
      lead.stageId ?? REVIEW_NO_STAGE,
      lead.stage?.name ?? lead.stage?.internalCode ?? "A definir",
    );
    if (lead.stageId && lead.stage) codes.set(lead.stageId, lead.stage.internalCode);
  }
  const labels = { stages, pastStages, codes };
  for (const row of board.placements) recordStage(row, labels);
  return labels;
}

function singleChoice(
  { key, label, options }: FilterOption,
  { criteria, change }: Pick<ToolbarProps, "criteria" | "change">,
): Extract<TableFilterField, { kind: "options" }> {
  const selected = criteria[key];
  return {
    id: key,
    label,
    kind: "options",
    presentation: "dropdown",
    selectionMode: "single",
    options,
    selected: selected ? [selected] : [],
    onChange: (ids) => change({ [key]: ids[0] ?? null }),
    onClear: () => change({ [key]: null }),
  };
}

function stageField(
  {
    key,
    label,
    items,
    codes,
  }: Omit<FilterOption, "options"> & {
    items: Map<string, string>;
    codes: Map<string, string>;
  },
  controls: Pick<ToolbarProps, "criteria" | "change">,
): TableFilterField {
  const options = [...items]
    .toSorted(([, left], [, right]) => collator.compare(left, right))
    .map(([id, name]) => {
      const code = codes.get(id);
      return code && code !== name ? { id, label: name, description: code } : { id, label: name };
    });
  return {
    ...singleChoice({ key, label, options }, controls),
    searchOptions: (query) => {
      const terms = query
        .trim()
        .split(/\s+/)
        .map((term) => normalizeSearch(term));
      return options.filter((option) => {
        const text = normalizeSearch(option.label + " " + (codes.get(option.id) ?? ""));
        return terms.every((term) => text.includes(term));
      });
    },
  };
}

function filterFields({ board, ...controls }: ToolbarProps): TableFilterField[] {
  const { criteria, change } = controls;
  const { origins, destinations } = reviewClassChoices(board);
  const teachers = [
    ...new Set([...destinations, ...origins].map((item) => item.teacher).filter(Boolean)),
  ]
    .toSorted(collator.compare)
    .map((name) => ({ id: name, label: name }));
  const { stages, pastStages, codes } = stageLabels(board);
  return [
    {
      kind: "toggle",
      id: "precisaTurma",
      label: "Precisa escolher turma",
      checked: criteria.precisaTurma,
      onChange: (value) => change({ precisaTurma: value }),
      onClear: () => change({ precisaTurma: false }),
    },
    {
      ...singleChoice(
        { key: "destinoVinculo", label: "Turma de destino", options: destinations },
        controls,
      ),
      searchOptions: (query: string) => findReviewClasses(destinations, query),
    },
    {
      ...singleChoice(
        { key: "origemVinculo", label: "Turma de origem", options: origins },
        controls,
      ),
      searchOptions: (query: string) => findReviewClasses(origins, query),
    },
    {
      ...singleChoice({ key: "professorVinculo", label: "Docente", options: teachers }, controls),
      searchOptions: (query) =>
        teachers.filter((teacher) =>
          normalizeSearch(teacher.label).includes(normalizeSearch(query)),
        ),
    },
    {
      kind: "options",
      id: "modalidadeVinculo",
      label: "Modalidade",
      selectionMode: "multiple",
      selected: criteria.modalidadeVinculo?.split("|") ?? [],
      onChange: (ids) => change({ modalidadeVinculo: ids.join("|") || null }),
      onClear: () => change({ modalidadeVinculo: null }),
      options: [
        { id: "REGULAR", label: "Regular" },
        { id: "PERSONALIZED", label: "PPT" },
      ],
    },
    stageField(
      { key: "estagioVinculo", label: "Estágio de destino", items: stages, codes },
      controls,
    ),
    stageField(
      { key: "estagioOrigem", label: "Estágio de origem", items: pastStages, codes },
      controls,
    ),
  ];
}

function ScopeFilter({
  change,
  scope,
  counts,
  ended,
}: Pick<ToolbarProps, "change" | "scope" | "counts" | "ended">): ReactElement {
  const scopeId = useId();
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopes: ReviewScope[] = ended
    ? ["all", "published", "pending"]
    : ["all", "ready", "blocked", "published", "pending"];
  const choices = scopes.map((value) => ({
    value,
    ...(ended && value === "pending"
      ? { label: "Sem alocação", description: "O período terminou sem confirmação de turma." }
      : scopeOptions[value]),
  }));
  return (
    <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
      <PopoverTrigger render={<Button size="sm" variant="secondary" />}>
        <ListFilter /> Situação do aluno
        {scope !== "all" && ` · ${choices.find((item) => item.value === scope)?.label}`}
      </PopoverTrigger>
      <PopoverContent align="start" size="lg" aria-label="Situação do aluno">
        <div className={styles.scopeList}>
          {choices.map(({ value, label, description }) => (
            <Button
              key={value}
              size="inline"
              variant={scope === value ? "secondary" : "ghost"}
              aria-pressed={scope === value}
              aria-labelledby={`${scopeId}-${value}-title`}
              aria-describedby={`${scopeId}-${value}-description`}
              className="flex-col items-stretch gap-0.5 whitespace-normal px-3 py-2 text-left"
              onClick={() => {
                change({
                  vinculos: value,
                  ...(allowsAttention(value) ? {} : { atencaoVinculo: null }),
                });
                setScopeOpen(false);
              }}
            >
              <span
                id={`${scopeId}-${value}-title`}
                className="flex items-baseline justify-between gap-2"
              >
                {label}
                <span className={styles.count}>{counts[value]}</span>
              </span>
              <small
                id={`${scopeId}-${value}-description`}
                className="font-normal text-muted-foreground"
              >
                {description}
              </small>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ClassRiskFilter({
  criteria,
  change,
  board,
}: Pick<ToolbarProps, "criteria" | "change" | "board">): ReactElement {
  const riskLimit = board.semester.formationRiskLimit;
  const riskCount = Number(criteria.turmasEmRisco) + Number(criteria.reducaoSignificativa);
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" variant="secondary" />}>
        <ListFilter /> Turmas em risco {riskCount > 0 && `(${riskCount})`}
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Turmas em risco">
        <div className="grid gap-3">
          <label className="flex items-start gap-2">
            <Checkbox
              checked={criteria.turmasEmRisco}
              onCheckedChange={(value) => change({ turmasEmRisco: Boolean(value) })}
            />
            <span>
              Abaixo do limite
              <small className="block text-muted-foreground">
                Menos de {riskLimit} alunos previstos.
              </small>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <Checkbox
              checked={criteria.reducaoSignificativa}
              onCheckedChange={(value) => change({ reducaoSignificativa: Boolean(value) })}
            />
            <span>
              Redução significativa
              <small className="block text-muted-foreground">
                Queda de pelo menos 25% da turma anterior e de pelo menos{" "}
                {Math.max(2, Math.ceil(riskLimit / 2))} alunos.
              </small>
            </span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReviewToolbar(props: ToolbarProps): ReactElement {
  const { criteria, change } = props;
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <Input
          name="busca"
          size="sm"
          leadingIcon={<Search />}
          autoComplete="off"
          aria-label="Buscar aluno ou turma"
          placeholder="Buscar aluno ou turma"
          value={criteria.busca}
          onChange={(event) => change({ busca: event.target.value })}
        />
      </div>
      <ScopeFilter {...props} />
      <ClassRiskFilter {...props} />
      <ReviewReasonFilter {...props} />
      <div className={styles.filters}>
        <TableFilters
          fields={filterFields(props)}
          onClearAll={() =>
            change({
              destinoVinculo: null,
              estagioVinculo: null,
              origemVinculo: null,
              estagioOrigem: null,
              professorVinculo: null,
              modalidadeVinculo: null,
              saidaVinculo: null,
              precisaTurma: false,
            })
          }
        />
      </div>
      <div className={styles.sort}>
        <ArrowDownWideNarrow size={16} aria-hidden="true" />
        <SelectControl
          name="review-sort"
          label="Ordenar vínculos"
          hideLabel
          value={criteria.ordemVinculos}
          choices={[...sortChoices]}
          onChange={(value) => {
            const choice = sortChoices.find((option) => option.value === value);
            if (choice) change({ ordemVinculos: choice.value });
          }}
        />
      </div>
    </div>
  );
}
