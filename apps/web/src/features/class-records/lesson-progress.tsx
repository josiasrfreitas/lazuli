"use client";
import type { ReactElement } from "react";
import { Button, Checkbox } from "@lazuli/ui";
import { RotateCcw, X } from "lucide-react";
import { recordedActivities } from "@lazuli/domain";
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

function LessonSelection({
  scope,
  prefix,
  value,
  change,
  data,
  items,
}: Props & { data: Planning; items: Step[] }): ReactElement {
  const selected = recordedActivities(value);
  const previous = data.records.find(
    (record) =>
      (record.date < scope.date || (record.date === scope.date && record.time < scope.startTime)) &&
      recordedActivities(record.content).length,
  );
  const update = (next: typeof selected): void => {
    const planItems = next.map((item) => ({
      ...item,
      status: item.status ?? ("PARTIAL" as const),
    }));
    const last = planItems.at(-1);
    change({
      ...value,
      planItems,
      planItemId: last?.id ?? null,
      planItemStatus: last?.status ?? "PARTIAL",
      planItemTitle: last?.title,
    });
  };
  return (
    <div className="grid min-w-0 gap-2">
      <PlanningBand
        items={items}
        date={scope.date}
        actualId={selected.at(-1)?.id ?? previous?.content.planItemId}
        draft={selected.length > 0}
      />
      <SelectControl
        name={`${prefix}-plan-step`}
        label="Adicionar conteúdo trabalhado · opcional"
        value="none"
        choices={[
          { value: "none", label: "Selecione uma atividade…" },
          ...items
            .filter((item) => !selected.some((s) => s.id === item.id))
            .map((item) => ({
              value: item.id,
              label: `${formatDateOnlyBR(item.plannedOn)} · ${item.title}`,
            })),
        ]}
        onChange={(id) => {
          const item = items.find((row) => row.id === id);
          if (item) update([...selected, { id, status: "PARTIAL", title: item.title }]);
        }}
      />
      {selected.length > 0 && (
        <p className="text-caption text-muted-foreground">
          Marque o que foi concluído. Os demais conteúdos ficam em andamento.
        </p>
      )}
      {selected.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-caption">
            <Checkbox
              checked={item.status === "COMPLETED"}
              onCheckedChange={(checked) =>
                update(
                  selected.map((s) =>
                    s.id === item.id ? { ...s, status: checked ? "COMPLETED" : "PARTIAL" } : s,
                  ),
                )
              }
            />
            {items.find((s) => s.id === item.id)?.title ??
              item.title ??
              "Conteúdo registrado anteriormente"}
          </label>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remover ${item.title ?? "conteúdo"} deste registro`}
            onClick={() => update(selected.filter((s) => s.id !== item.id))}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  );
}
