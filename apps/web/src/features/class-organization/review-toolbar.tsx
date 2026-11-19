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
import type { OrganizationBoard } from "./model";
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

function filterFields({ board, criteria, change }: ToolbarProps): TableFilterField[] {
  const stages = new Map<string, string>();
  const { origins, destinations } = reviewClassChoices(board);
  const teachers = [
    ...new Set([...destinations, ...origins].map((item) => item.teacher).filter(Boolean)),
  ]
    .sort(collator.compare)
    .map((name) => ({ id: name, label: name }));
  const pastStages = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const lead of board.waitingLeads) {
    stages.set(
      lead.stageId ?? REVIEW_NO_STAGE,
      lead.stage?.name ?? lead.stage?.internalCode ?? "A definir",
    );
    if (lead.stageId && lead.stage) codes.set(lead.stageId, lead.stage.internalCode);
  }
  for (const row of board.placements) {
    if (!row.declinedAt)
      stages.set(row.stageId ?? REVIEW_NO_STAGE, row.stageName ?? row.stageCode ?? "A definir");
    if (row.stageId && row.stageCode) codes.set(row.stageId, row.stageCode);
    if (row.sourceStageId && row.sourceStageCode) codes.set(row.sourceStageId, row.sourceStageCode);
    if (row.sourceStageId)
      pastStages.set(row.sourceStageId, row.sourceStageName ?? row.sourceStageCode ?? "A definir");
  }
  const ordered = (items: Map<string, string>): Option[] =>
    [...items]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => collator.compare(a.label, b.label));
  const choice = (
    key: FilterKey,
    label: string,
    options: Option[],
  ): Extract<TableFilterField, { kind: "options" }> => ({
    id: key,
    label,
    kind: "options",
    presentation: "dropdown",
    selectionMode: "single",
    options,
    selected: criteria[key] ? [criteria[key]] : [],
    onChange: (ids) => change({ [key]: ids[0] ?? null }),
    onClear: () => change({ [key]: null }),
  });
  function stageField(
    key: "estagioVinculo" | "estagioOrigem",
    label: string,
    items: Map<string, string>,
  ): TableFilterField {
    const options = ordered(items).map((option) => {
      const code = codes.get(option.id);
      return code && code !== option.label ? { ...option, description: code } : option;
    });
    return {
      ...choice(key, label, options),
      searchOptions: (query) => {
        const terms = query.trim().split(/\s+/).map(normalizeSearch);
        return options.filter((option) => {
          const text = normalizeSearch(option.label + " " + (codes.get(option.id) ?? ""));
          return terms.every((term) => text.includes(term));
        });
      },
    };
  }
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
      ...choice("destinoVinculo", "Turma de destino", destinations),
      searchOptions: (query: string) => findReviewClasses(destinations, query),
    },
    {
      ...choice("origemVinculo", "Turma de origem", origins),
      searchOptions: (query: string) => findReviewClasses(origins, query),
    },
    {
      ...choice("professorVinculo", "Professor", teachers),
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
    stageField("estagioVinculo", "Estágio de destino", stages),
    stageField("estagioOrigem", "Estágio de origem", pastStages),
  ];
}

export function ReviewToolbar(props: ToolbarProps): ReactElement {
  const { criteria, change, scope, counts, ended } = props;
  const scopeId = useId();
  const [scopeOpen, setScopeOpen] = useState(false);
  const riskCount = Number(criteria.turmasEmRisco) + Number(criteria.reducaoSignificativa);
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
      <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
        <PopoverTrigger render={<Button size="sm" variant="secondary" />}>
          <ListFilter /> Situação do aluno
          {scope !== "all" && ` · ${choices.find((item) => item.value === scope)?.label}`}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          size="lg"
          className={styles.scopePopover}
          aria-label="Situação do aluno"
        >
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
                    ...(!allowsAttention(value) ? { atencaoVinculo: null } : {}),
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
                  Menos de {props.board.semester.formationRiskLimit} alunos previstos.
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
                  {Math.max(2, Math.ceil(props.board.semester.formationRiskLimit / 2))} alunos.
                </small>
              </span>
            </label>
          </div>
        </PopoverContent>
      </Popover>
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
