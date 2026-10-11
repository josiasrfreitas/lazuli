"use client";

import { useEffect, useRef, type ReactElement, type RefObject } from "react";
import {
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
  type UseQueryStatesReturn,
} from "nuqs";
import type { InfiniteData } from "@tanstack/react-query";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import { History, LoaderCircle, RefreshCw } from "lucide-react";
import { Button, EmptyState, InlineSkeleton, Input } from "@lazuli/ui";
import { SelectControl } from "~/features/classes/form-controls";
import { trpc } from "~/lib/trpc";
import { ActivityTimeline } from "./activity-timeline";

const areas = ["ALL", "PEDAGOGICAL", "COMMERCIAL", "FINANCIAL", "SCHOOL"] as const;
const periods = ["TODAY", "7", "30", "90", "ALL"] as const;
const areaChoices = [
  { value: "ALL", label: "Todas as áreas" },
  { value: "PEDAGOGICAL", label: "Pedagógico" },
  { value: "COMMERCIAL", label: "Comercial" },
  { value: "FINANCIAL", label: "Financeiro" },
  { value: "SCHOOL", label: "Escola" },
];
const periodChoices = [
  { value: "TODAY", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "ALL", label: "Todo o período" },
];
const PAGE_SIZE = 20;
const queryFields = {
  busca: parseAsString.withDefault(""),
  area: parseAsStringLiteral(areas).withDefault("ALL"),
  periodo: parseAsStringLiteral(periods).withDefault("30"),
  autor: parseAsString.withDefault("all"),
};
type QueryParams = UseQueryStatesReturn<typeof queryFields>;
type ActivityPages = InfiniteData<
  RouterOutputs["activity"]["list"],
  RouterInputs["activity"]["list"]["cursor"]
>;
type ActivityModel = {
  params: QueryParams[0];
  setParams: QueryParams[1];
  query: ReturnType<typeof trpc.activity.list.useInfiniteQuery<ActivityPages>>;
  authors: ReturnType<typeof trpc.activity.actors.useQuery<RouterOutputs["activity"]["actors"]>>;
  refresh: () => void;
};

function useActivityQuery(): ActivityModel {
  const [params, setParams] = useQueryStates(queryFields);
  const query = trpc.activity.list.useInfiniteQuery(
    {
      search: params.busca,
      area: params.area,
      period: params.periodo,
      ...(params.autor === "all" ? {} : { actorId: params.autor }),
      pageSize: PAGE_SIZE,
    },
    { getNextPageParam: (page) => page.nextCursor },
  );
  const authors = trpc.activity.actors.useQuery();
  const utils = trpc.useUtils();
  const refresh = (): void => {
    void utils.activity.list.reset();
    void authors.refetch();
  };
  return { params, setParams, query, authors, refresh };
}

function useLoadOnScroll(input: {
  root: RefObject<HTMLDivElement | null>;
  target: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  load: () => void;
}): void {
  const { root, target, enabled, load } = input;
  useEffect(() => {
    if (!enabled || !target.current || !root.current || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { root: root.current, rootMargin: "0px 0px 240px 0px" },
    );
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [root, target, enabled, load]);
}

export function ActivityPage(): ReactElement {
  const model = useActivityQuery();
  const { query, params } = model;
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  useLoadOnScroll({
    root: scroller,
    target: sentinel,
    enabled: Boolean(query.hasNextPage) && !query.isFetching && !query.isFetchNextPageError,
    load: () => {
      void query.fetchNextPage();
    },
  });
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [params.busca, params.area, params.periodo, params.autor]);
  const refresh = (): void => {
    scroller.current?.scrollTo({ top: 0 });
    model.refresh();
  };
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col">
      <ActivityHeader model={model} refresh={refresh} />
      <div
        ref={scroller}
        className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
        aria-label="Histórico de atividades"
        tabIndex={0}
      >
        <div className="mx-auto w-full max-w-3xl">
          <ActivityFeed query={query} sentinel={sentinel} />
        </div>
      </div>
    </div>
  );
}

function ActivityHeader({
  model,
  refresh,
}: {
  model: ActivityModel;
  refresh: () => void;
}): ReactElement {
  return (
    <div className="shrink-0 space-y-5 border-b border-border p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-semibold text-heading">Log de atividades</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            O dia a dia da escola, com contexto e autoria.
          </p>
        </div>
        <Button
          variant="secondary"
          size="compact-responsive"
          disabled={model.query.isFetching}
          onClick={refresh}
        >
          <RefreshCw />
          Atualizar
        </Button>
      </header>
      <ActivityFilters model={model} />
    </div>
  );
}

function ActivityFilters({ model }: { model: ActivityModel }): ReactElement {
  const { params, setParams, authors } = model;
  return (
    <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-4">
      <div className="col-span-2 lg:col-span-1">
        <Input
          name="activity-search"
          aria-label="Buscar no log"
          autoComplete="off"
          placeholder="Buscar ação, pessoa ou contexto"
          size="compact-responsive"
          value={params.busca}
          onChange={(event) => {
            void setParams({ busca: event.target.value });
          }}
        />
      </div>
      <ActivityPeriodAndArea model={model} />
      <div className="col-span-2 lg:col-span-1">
        <SelectControl
          name="activity-actor"
          label="Realizada por"
          value={params.autor}
          choices={[
            { value: "all", label: "Todas as pessoas" },
            ...(authors.data ?? []).map((actor) => ({ value: actor.id, label: actor.name })),
          ]}
          onChange={(autor) => {
            void setParams({ autor });
          }}
        />
      </div>
    </div>
  );
}

function ActivityPeriodAndArea({ model }: { model: ActivityModel }): ReactElement {
  const { params, setParams } = model;
  return (
    <>
      <SelectControl
        name="activity-period"
        label="Período"
        value={params.periodo}
        choices={periodChoices}
        onChange={(value) => {
          if (periods.includes(value as typeof params.periodo))
            void setParams({ periodo: value as typeof params.periodo });
        }}
      />
      <SelectControl
        name="activity-area"
        label="Área"
        value={params.area}
        choices={areaChoices}
        onChange={(value) => {
          if (areas.includes(value as typeof params.area))
            void setParams({ area: value as typeof params.area });
        }}
      />
    </>
  );
}

function ActivityFeed({
  query,
  sentinel,
}: {
  query: ActivityModel["query"];
  sentinel: RefObject<HTMLDivElement | null>;
}): ReactElement {
  if (query.isPending) return <TimelineLoading />;
  if (!query.data)
    return (
      <EmptyState
        title="Não foi possível carregar o log"
        description="Tente novamente para consultar as atividades."
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  const rows = query.data.pages.flatMap((page) => page.rows);
  if (rows.length === 0)
    return (
      <EmptyState
        icon={<History />}
        title="Nenhuma atividade neste período"
        description="Ajuste os filtros para encontrar outros registros. As próximas ações da equipe aparecerão aqui."
      />
    );
  const total = query.data.pages[0]?.total;
  return (
    <>
      <p className="mb-6 text-caption text-muted-foreground">
        {total} {total === 1 ? "atividade no período" : "atividades no período"} · Mais recentes
        primeiro
      </p>
      <ActivityTimeline rows={rows} />
      <div ref={sentinel} className="flex min-h-20 items-center justify-center py-6">
        <ActivityPagination query={query} />
      </div>
    </>
  );
}

function ActivityPagination({ query }: { query: ActivityModel["query"] }): ReactElement {
  if (query.isFetchingNextPage)
    return (
      <p role="status" className="flex items-center gap-2 text-caption text-muted-foreground">
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin motion-reduce:animate-none"
        />
        Carregando atividades anteriores…
      </p>
    );
  if (!query.hasNextPage)
    return (
      <p role="status" className="text-caption text-muted-foreground">
        Você chegou ao início deste período.
      </p>
    );
  return (
    <div className="grid justify-items-center gap-2">
      {query.isFetchNextPageError && (
        <p role="alert" className="text-caption text-destructive">
          Não foi possível carregar mais atividades.
        </p>
      )}
      <Button variant="ghost" onClick={() => void query.fetchNextPage()}>
        {query.isFetchNextPageError ? "Tentar novamente" : "Carregar atividades anteriores"}
      </Button>
    </div>
  );
}

function TimelineLoading(): ReactElement {
  return (
    <div role="status" className="space-y-8 py-4">
      <span className="sr-only">Carregando atividades</span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-start gap-4">
          <InlineSkeleton className="size-8" />
          <div className="grid flex-1 gap-3">
            <InlineSkeleton className="h-4 w-3/4" />
            <InlineSkeleton className="h-3 w-1/2" />
            <InlineSkeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
