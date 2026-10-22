"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { EmptyState, Input, type DataTableState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StageCatalogList } from "./catalog-list";
import { StagePrograms } from "./detail";
import { StageLoading } from "./loading";
import type { StageSummary } from "./types";
import styles from "./catalog.module.css";

export function StagesPage(): ReactJSX.Element {
  const query = trpc.teachingPrograms.catalog.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const stages = query.data ?? [];
  const selected = selectStage(stages, selectedId);
  const needle = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = stages.filter((stage) =>
    `${stage.name} ${stage.internalCode} ${stage.track.name}`
      .toLocaleLowerCase("pt-BR")
      .includes(needle),
  );
  const state = catalogState({
    pending: query.isPending,
    error: query.isError,
    filtered,
    total: stages.length,
  });
  return (
    <section className={styles.workspace} aria-label="Estágios">
      <div className={styles.canvas}>
        <div className={styles.catalog}>
          <CatalogPane
            state={state}
            selected={selected}
            stages={stages}
            filtered={filtered}
            search={search}
            onSearch={setSearch}
            onSelect={setSelectedId}
            onRetry={() => void query.refetch()}
            hasData={Boolean(query.data)}
          />
          <CatalogDetail pending={query.isPending} selected={selected} />
        </div>
      </div>
    </section>
  );
}

function selectStage(
  stages: readonly StageSummary[],
  selectedId: string | null,
): StageSummary | undefined {
  return (
    stages.find((stage) => stage.id === selectedId) ??
    stages.find((stage) => stage.internalCode === "F1" && stage._count.teachingPrograms > 0) ??
    stages.find((stage) => stage._count.teachingPrograms > 0) ??
    stages[0]
  );
}

function catalogState({
  pending,
  error,
  filtered,
  total,
}: {
  pending: boolean;
  error: boolean;
  filtered: StageSummary[];
  total: number;
}): DataTableState<StageSummary> {
  if (pending) return { kind: "loading" };
  if (error) return { kind: "error" };
  if (filtered.length > 0) return { kind: "data", rows: filtered };
  return { kind: total > 0 ? "noResults" : "empty" };
}

type CatalogPaneProps = {
  state: DataTableState<StageSummary>;
  selected: StageSummary | undefined;
  stages: readonly StageSummary[];
  filtered: StageSummary[];
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
  hasData: boolean;
};

function CatalogPane({
  state,
  selected,
  stages,
  filtered,
  search,
  onSearch,
  onSelect,
  onRetry,
  hasData,
}: CatalogPaneProps): ReactJSX.Element {
  return (
    <section className={styles.catalogList} aria-label="Catálogo de estágios">
      <div className={styles.catalogHeading}>
        <h1>Estágios</h1>
      </div>
      <div className={styles.listTools}>
        <Input
          name="stage-search"
          size="sm"
          placeholder="Buscar track, estágio ou código…"
          aria-label="Buscar track, estágio ou código"
          autoComplete="off"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <StageCatalogList
        state={state}
        selectedId={selected?.id ?? null}
        onSelect={(stage) => onSelect(stage.id)}
        onRetry={onRetry}
        footer={
          hasData ? (
            <p className="px-3 py-2 text-caption text-muted-foreground">
              {filtered.length} de {stages.length} estágios
            </p>
          ) : undefined
        }
      />
    </section>
  );
}

function CatalogDetail({
  pending,
  selected,
}: {
  pending: boolean;
  selected: StageSummary | undefined;
}): ReactJSX.Element {
  if (pending) return <StageLoading />;
  if (selected) return <StagePrograms key={selected.id} stage={selected} />;
  return (
    <div className={styles.unavailable}>
      <EmptyState
        title="Programação dos estágios"
        description="Selecione um estágio para consultar suas unidades, lições e provas."
      />
    </div>
  );
}
