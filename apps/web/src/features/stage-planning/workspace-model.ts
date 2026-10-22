"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { dateLabel, type Planning, type PlannedItem } from "./shared";

export type PlanView = "plan" | "records";
export type PlanFilter = "all" | "upcoming" | "past";
export type PlanMode =
  | { kind: "window" }
  | { kind: "item"; item: PlannedItem | null }
  | { kind: "remove"; item: PlannedItem }
  | null;

export type PlanContentModel = {
  mode: PlanMode;
  setMode: Dispatch<SetStateAction<PlanMode>>;
  history: boolean;
  setHistory: Dispatch<SetStateAction<boolean>>;
  view: PlanView;
  changeView: (next: PlanView) => void;
  filter: PlanFilter;
  changeFilter: (next: PlanFilter) => void;
  search: string;
  changeSearch: (next: string) => void;
  pageCount: number;
  currentPage: number;
  offset: number;
  pageSize: number;
  count: number;
  setPage: Dispatch<SetStateAction<number>>;
  items: PlannedItem[];
  records: Planning["records"];
};

export function usePlanContentModel(data: Planning): PlanContentModel {
  const [mode, setMode] = useState<PlanMode>(null);
  const [history, setHistory] = useState(false);
  const [view, setView] = useState<PlanView>("plan");
  const [filter, setFilter] = useState<PlanFilter>(() =>
    data.plan?.items.some((item) => item.plannedOn >= data.scope.today) ? "upcoming" : "all",
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { items, records } = filteredPlanningRows({ data, filter, search });
  const count = view === "plan" ? items.length : records.length;
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const offset = currentPage * pageSize;
  const changeView = (next: PlanView): void => {
    setView(next);
    setPage(0);
    setHistory(false);
    setSearch("");
  };
  const changeFilter = (next: PlanFilter): void => {
    setFilter(next);
    setPage(0);
  };
  const changeSearch = (next: string): void => {
    setSearch(next);
    setPage(0);
  };
  return {
    mode,
    setMode,
    history,
    setHistory,
    view,
    changeView,
    filter,
    changeFilter,
    search,
    changeSearch,
    pageCount,
    currentPage,
    offset,
    pageSize,
    count,
    setPage,
    items,
    records,
  };
}

function filteredPlanningRows({
  data,
  filter,
  search,
}: {
  data: Planning;
  filter: PlanFilter;
  search: string;
}): { items: PlannedItem[]; records: Planning["records"] } {
  const needle = search.trim().toLocaleLowerCase("pt-BR");
  const items = (data.plan?.items ?? []).filter((item) =>
    matchesPlanItem(item, { filter, today: data.scope.today, needle }),
  );
  const records = data.records.filter((row) =>
    `${row.content.account} ${row.content.reference ?? ""} ${dateLabel(row.date)}`
      .toLocaleLowerCase("pt-BR")
      .includes(needle),
  );
  return { items, records };
}

function matchesPlanItem(
  item: PlannedItem,
  { filter, today, needle }: { filter: PlanFilter; today: string; needle: string },
): boolean {
  const inPeriod =
    filter === "all" || (filter === "upcoming" ? item.plannedOn >= today : item.plannedOn < today);
  const matchesSearch = `${item.title} ${item.reference ?? ""} ${dateLabel(item.plannedOn)}`
    .toLocaleLowerCase("pt-BR")
    .includes(needle);
  return inPeriod && matchesSearch;
}
