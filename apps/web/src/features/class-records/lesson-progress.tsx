"use client";
import { Button, Checkbox, PencilLoader } from "@lazuli/ui";
import { RotateCcw } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { PlanningBand } from "~/features/stage-planning/planning-band";
import { formatDateOnlyBR } from "~/lib/format";
import type { ContentDraft } from "./content-fields";

export type LessonPlanningScope = {
  classId: string;
  progressId?: string;
  date: string;
  startTime: string;
};

export function LessonProgress({
  scope,
  prefix,
  value,
  change,
}: {
  scope: LessonPlanningScope;
  prefix: string;
  value: ContentDraft;
  change: (value: ContentDraft) => void;
}) {
  const query = trpc.planning.detail.useQuery({
    classId: scope.classId,
    ...(scope.progressId ? { progressId: scope.progressId } : {}),
  });
  if (query.isPending) return <PencilLoader size="sm" label="Consultando planejamento" />;
  if (query.error)
    return (
      <div className="text-caption text-muted-foreground">
        Planejamento indisponível. Você pode registrar a aula.
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          <RotateCcw aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    );
  if (!query.data) return null;
  const items = query.data.plan?.items ?? [];
  if (!items.length)
    return (
      <p className="text-caption text-muted-foreground">
        Sem etapas planejadas. O relato e as páginas registram o avanço desta aula.
      </p>
    );
  const previous = query.data.records.find(
    (record) =>
      (record.date < scope.date || (record.date === scope.date && record.time < scope.startTime)) &&
      record.content.planItemId,
  );
  const selected = items.find((item) => item.id === value.planItemId);
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
        choices={[
          { value: "none", label: "Sem etapa vinculada" },
          ...(value.planItemId && !selected
            ? [
                {
                  value: value.planItemId,
                  label: value.planItemTitle ?? "Etapa registrada anteriormente",
                },
              ]
            : []),
          ...items.map((item) => ({
            value: item.id,
            label: `${formatDateOnlyBR(item.plannedOn)} · ${item.title}`,
          })),
        ]}
        onChange={(id) => {
          const item = items.find((row) => row.id === id);
          change({
            ...value,
            planItemId: item?.id ?? null,
            planItemStatus: "PARTIAL",
            planItemTitle: item?.title,
            ...(item ? { kind: item.kind } : {}),
          });
        }}
      />
      {value.planItemId && (
        <label className="flex w-fit items-center gap-2 text-caption">
          <Checkbox
            checked={value.planItemStatus === "COMPLETED"}
            onCheckedChange={(checked) =>
              change({ ...value, planItemStatus: checked ? "COMPLETED" : "PARTIAL" })
            }
          />
          Concluí esta etapa
        </label>
      )}
    </div>
  );
}
