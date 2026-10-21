"use client";
import type { ReactElement } from "react";
import { Button, Checkbox } from "@lazuli/ui";
import { RotateCcw } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { QueryLoading } from "~/components/query-loading";
import { SelectControl } from "~/features/classes/form-controls";
import { PlanningBand } from "~/features/stage-planning/planning-band";
import type { Planning } from "~/features/stage-planning/shared";
import { formatDateOnlyBR } from "~/lib/format";
import type { ContentDraft } from "./content-fields";
export type LessonPlanningScope = {
  classId: string;
  progressId?: string;
  date: string;
  startTime: string;
};
type Props = {
  scope: LessonPlanningScope;
  prefix: string;
  value: ContentDraft;
  change: (value: ContentDraft) => void;
};
type Step = NonNullable<Planning["plan"]>["items"][number];
export function LessonProgress(props: Props): ReactElement | null {
  const query = trpc.planning.detail.useQuery({
    classId: props.scope.classId,
    ...(props.scope.progressId ? { progressId: props.scope.progressId } : {}),
  });
  if (query.isPending) return <QueryLoading label="Consultando planejamento" />;
  if (query.error)
    return (
      <div className="text-caption text-muted-foreground">
        Planejamento indisponível. Você pode registrar a aula.
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          <RotateCcw aria-hidden />
          Tentar novamente
        </Button>
      </div>
    );
  if (!query.data) return null;
  const items = query.data.plan?.items ?? [];
  if (items.length === 0)
    return (
      <p className="text-caption text-muted-foreground">
        Sem etapas planejadas. O relato e as páginas registram o avanço desta aula.
      </p>
    );
  return <LessonSelection {...props} data={query.data} items={items} />;
}
function stepChoices(items: Step[], value: ContentDraft): { value: string; label: string }[] {
  const retired = value.planItemId && !items.some((item) => item.id === value.planItemId);
  return [
    { value: "none", label: "Sem etapa vinculada" },
    ...(retired
      ? [
          {
            value: value.planItemId!,
            label: value.planItemTitle ?? "Etapa registrada anteriormente",
          },
        ]
      : []),
    ...items.map((item) => ({
      value: item.id,
      label: `${formatDateOnlyBR(item.plannedOn)} · ${item.title}`,
    })),
  ];
}
function LessonSelection({
  scope,
  prefix,
  value,
  change,
  data,
  items,
}: Props & { data: Planning; items: Step[] }): ReactElement {
  const previous = data.records.find(
    (record) =>
      (record.date < scope.date || (record.date === scope.date && record.time < scope.startTime)) &&
      record.content.planItemId,
  );
  const select = (id: string): void => {
    if (id === value.planItemId) return;
    const item = items.find((row) => row.id === id);
    change({
      ...value,
      planItemId: item?.id ?? null,
      planItemStatus: "PARTIAL",
      planItemTitle: item?.title,
      ...(item ? { kind: item.kind } : {}),
    });
  };
  return (
    <div className="grid min-w-0 gap-2">
      <PlanningBand
        items={items}
        date={scope.date}
        actualId={value.planItemId ?? previous?.content.planItemId}
        draft={Boolean(value.planItemId)}
      />
      <SelectControl
        name={`${prefix}-plan-step`}
        label="Etapa trabalhada · opcional"
        value={value.planItemId ?? "none"}
        choices={stepChoices(items, value)}
        onChange={select}
      />
      <StepCompletion value={value} change={change} />
    </div>
  );
}

function StepCompletion({ value, change }: Pick<Props, "value" | "change">): ReactElement | null {
  if (!value.planItemId) return null;
  return (
    <label className="flex w-fit items-center gap-2 text-caption">
      <Checkbox
        checked={value.planItemStatus === "COMPLETED"}
        onCheckedChange={(checked) =>
          change({ ...value, planItemStatus: checked ? "COMPLETED" : "PARTIAL" })
        }
      />
      Concluí esta etapa
    </label>
  );
}
