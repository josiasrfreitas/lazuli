"use client";
import { useSearchDraft } from "~/lib/use-search-draft";

import { useEffect, useRef, type ReactElement, type RefObject } from "react";
import {
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
  type UseQueryStatesReturn,
} from "nuqs";
import { activityListSchema, z } from "@lazuli/validators";
import type { InfiniteData } from "@tanstack/react-query";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import { CalendarDays, History, Layers, RefreshCw, Search, UserRound } from "lucide-react";
import {
  Button,
  EmptyState,
  InlineSkeleton,
  Input,
  PencilLoader,
  TimelineSkeleton,
  TableFilters,
  type TableFilterField,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ActivityTimeline } from "./activity-timeline";

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
const PAGE_SIZE = 25;
const queryFields = {
  busca: parseAsString.withDefault(""),
  area: parseAsString.withDefault(""),
  periodo: parseAsStringLiteral(periods).withDefault("30"),
  autor: parseAsString.withDefault(""),
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
      areas: selectedValues(params.area, activityListSchema.shape.areas.unwrap().element),
      period: params.periodo,
      actorIds: selectedValues(params.autor, activityListSchema.shape.actorIds.unwrap().element),
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
      <ActivityHeader model={model} refresh={refresh} />
      <div
        ref={scroller}
        className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
        aria-label="Histórico de atividades"
        tabIndex={0}
      >
        <div className="mx-auto w-full max-w-5xl">
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
    <div className="shrink-0 space-y-3 border-b border-border px-4 py-3 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-h2 font-semibold text-heading">Log de atividades</h1>
          <ActivityCount query={model.query} />
        </div>
        <Button
          variant="ghost"
          size="compact-responsive"
          aria-label="Atualizar atividades"
          disabled={model.query.isFetching}
          onClick={refresh}
        >
          <RefreshCw aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Atualizar</span>
        </Button>
      </header>
      <ActivityFilters model={model} />
    </div>
  );
}

function ActivityFilters({ model }: { model: ActivityModel }): ReactElement {
  const { params, setParams } = model;
  const [search, setSearch] = useSearchDraft(params.busca, (busca) => {
    void setParams({ busca });
  });
  const fields = activityFilterFields(model);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-icon"
          />
          <Input
            className="pl-9"
            name="activity-search"
            type="search"
            aria-label="Buscar no log"
            autoComplete="off"
            placeholder="Buscar ação, pessoa ou contexto"
            size="compact-responsive"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <TableFilters
          fields={fields}
          onClearAll={() => void setParams({ periodo: "ALL", area: null, autor: null })}
        />
      </div>
    </div>
  );
}

function selectedValues<T>(value: string, schema: z.ZodType<T>): T[] {
  return [...new Set(value.split(","))].flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

function activityFilterFields({ params, setParams, authors }: ActivityModel): TableFilterField[] {
  return [
    {
      id: "periodo",
      label: "Período",
      icon: CalendarDays,
      promoted: true,
      kind: "options",
      selectionMode: "single",
      options: periodChoices
        .filter(({ value }) => value !== "ALL")
        .map(({ value, label }) => ({ id: value, label })),
      selected: params.periodo === "ALL" ? [] : [params.periodo],
      onChange: (values) => {
        const value = values[0] ?? "ALL";
        if (periods.includes(value as typeof params.periodo))
          void setParams({ periodo: value as typeof params.periodo });
      },
      onClear: () => void setParams({ periodo: "ALL" }),
    },
    {
      id: "area",
      label: "Área",
      icon: Layers,
      promoted: true,
      kind: "options",
      options: areaChoices
        .filter(({ value }) => value !== "ALL")
        .map(({ value, label }) => ({ id: value, label })),
      selected: selectedValues(params.area, activityListSchema.shape.areas.unwrap().element),
      onChange: (values) => void setParams({ area: values.join(",") || null }),
      onClear: () => void setParams({ area: null }),
    },
    {
      id: "autor",
      label: "Realizada por",
      icon: UserRound,
      kind: "options",
      options: (authors.data ?? []).map((actor) => ({ id: actor.id, label: actor.name })),
      selected: selectedValues(params.autor, activityListSchema.shape.actorIds.unwrap().element),
      onChange: (values) => void setParams({ autor: values.join(",") || null }),
      onClear: () => void setParams({ autor: null }),
    },
  ];
}

function ActivityFeed({
  query,
  sentinel,
}: {
  query: ActivityModel["query"];
  sentinel: RefObject<HTMLDivElement | null>;
}): ReactElement {
  if (query.isPending) return <TimelineSkeleton layout="alternating" />;
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
  return (
    <>
      <ActivityTimeline rows={rows} />
      <div ref={sentinel} className="flex min-h-20 items-center justify-center py-6">
        <ActivityPagination query={query} />
      </div>
    </>
  );
}

function ActivityPagination({ query }: { query: ActivityModel["query"] }): ReactElement {
  if (query.isFetchingNextPage) return <PencilLoader label="Carregando atividades anteriores" />;
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

function ActivityCount({ query }: { query: ActivityModel["query"] }): ReactElement | null {
  const total = query.data?.pages[0]?.total;
  if (query.isPending) return <InlineSkeleton className="w-36" />;
  if (total === undefined) return null;
  return (
    <p className="text-caption text-muted-foreground" aria-live="polite">
      <span className="font-numeric tabular-nums">{total.toLocaleString("pt-BR")}</span>{" "}
      {total === 1 ? "atividade" : "atividades"} · Mais recentes primeiro
    </p>
  );
}
