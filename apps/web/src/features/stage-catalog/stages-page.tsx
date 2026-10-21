"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { EmptyState, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StageCatalogList } from "./catalog-list";
import { StagePrograms } from "./detail";
import { StageLoading } from "./loading";
import styles from "./catalog.module.css";

export function StagesPage(): ReactJSX.Element {
  const query = trpc.teachingPrograms.catalog.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const stages = query.data ?? [];
  const selected =
    stages.find((stage) => stage.id === selectedId) ??
    stages.find((stage) => stage.internalCode === "F1" && stage._count.teachingPrograms > 0) ??
    stages.find((stage) => stage._count.teachingPrograms > 0) ??
    stages[0];
  const needle = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = stages.filter((stage) =>
    `${stage.name} ${stage.internalCode} ${stage.track.name}`
      .toLocaleLowerCase("pt-BR")
      .includes(needle),
  );
  return (
    <section className={styles.workspace} aria-label="Estágios">
      <div className={styles.canvas}>
        <div className={styles.catalog}>
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
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <StageCatalogList
              state={
                query.isPending
                  ? { kind: "loading" }
                  : query.isError
                    ? { kind: "error" }
                    : filtered.length > 0
                      ? { kind: "data", rows: filtered }
                      : { kind: stages.length > 0 ? "noResults" : "empty" }
              }
              selectedId={selected?.id ?? null}
              onSelect={(stage) => setSelectedId(stage.id)}
              onRetry={() => void query.refetch()}
              footer={
                query.data ? (
                  <p className="px-3 py-2 text-caption text-muted-foreground">
                    {filtered.length} de {stages.length} estágios
                  </p>
                ) : undefined
              }
            />
          </section>
          {query.isPending ? (
            <StageLoading />
          ) : selected ? (
            <StagePrograms key={selected.id} stage={selected} />
          ) : (
            <div className={styles.unavailable}>
              <EmptyState
                title="Programação dos estágios"
                description="Selecione um estágio para consultar suas unidades, lições e provas."
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
