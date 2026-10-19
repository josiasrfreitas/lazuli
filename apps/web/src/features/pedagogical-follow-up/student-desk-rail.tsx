import { useEffect, useState, type ReactElement } from "react";
import { Badge, Button, Input, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { dateLabel, QueryState } from "./shared";
import type { FollowUpSelection, SelectFollowUp } from "./student-navigation";
import { DeskEmptyList } from "./student-desk-empty";
import { DeskRowsLoading } from "./student-desk-loading";
import styles from "./student-desk.module.css";
type Props = {
  studentId: string;
  selected: FollowUpSelection | null;
  select: SelectFollowUp;
  clear: () => void;
};
export function StudentDeskRail(props: Props): ReactElement {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FollowUpSelection["kind"]>("occurrence");
  const activeTab = props.selected?.kind ?? tab;
  const querySearch = useDeskSearch(search);
  const occurrences = trpc.occurrences.list.useQuery({
    studentId: props.studentId,
    search: querySearch,
    page: 1,
  });
  const interventions = trpc.interventions.list.useQuery({
    studentId: props.studentId,
    search: querySearch,
    page: 1,
  });
  return (
    <aside className={styles.rail} aria-label="Registros do aluno">
      <Tabs
        value={activeTab}
        variant="underline"
        className="h-full min-h-0 gap-0"
        onValueChange={(value: string) => {
          if (value !== "occurrence" && value !== "intervention") return;
          setTab(value);
          setSearch("");
          props.clear();
        }}
      >
        <div className={styles.railToolbar}>
          <TabsList aria-label="Tipo de registro">
            <TabsTab value="occurrence">
              Ocorrências
              {occurrences.data && (
                <span className={styles.tabCount}>{occurrences.data.total}</span>
              )}
            </TabsTab>
            <TabsTab value="intervention">
              Intervenções
              {interventions.data && (
                <span className={styles.tabCount}>{interventions.data.total}</span>
              )}
            </TabsTab>
          </TabsList>
          <DeskFilters activeTab={activeTab} search={search} setSearch={setSearch} />
        </div>
        <TabsPanel value="intervention" className="min-h-0 flex-1 overflow-hidden">
          <InterventionList key={`interventions:${querySearch}`} {...props} search={querySearch} />
        </TabsPanel>
        <TabsPanel value="occurrence" className="min-h-0 flex-1 overflow-hidden">
          <OccurrenceList key={`occurrences:${querySearch}`} {...props} search={querySearch} />
        </TabsPanel>
      </Tabs>
    </aside>
  );
}

function DeskFilters({
  activeTab,
  search,
  setSearch,
}: {
  activeTab: FollowUpSelection["kind"];
  search: string;
  setSearch: (value: string) => void;
}): ReactElement {
  return (
    <div className={styles.filters}>
      <Input
        size="sm"
        name="follow-up-search"
        aria-label="Buscar no acompanhamento"
        placeholder={activeTab === "occurrence" ? "Buscar ocorrência" : "Buscar intervenção"}
        autoComplete="off"
        maxLength={160}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </div>
  );
}

function InterventionList({
  studentId,
  selected,
  select,
  search,
}: Props & { search: string }): ReactElement {
  const [page, setPage] = useState(1);
  const query = trpc.interventions.list.useQuery({ studentId, search, page });
  return (
    <section className={styles.group} aria-label="Intervenções">
      <div className={styles.listScroll} tabIndex={0} role="region" aria-label="Lista de registros">
        {query.isPending && <DeskRowsLoading />}
        <QueryState
          pending={false}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.data?.rows.map((row) => (
          <button
            type="button"
            key={row.id}
            className={styles.recordButton}
            aria-pressed={selected?.kind === "intervention" && selected.id === row.id}
            onClick={() => select({ kind: "intervention", id: row.id })}
          >
            <strong title={row.title}>{row.title}</strong>
            <small>
              {row.responsible.name}
              {` · ${dateLabel(row.performedOn)}`}
            </small>
          </button>
        ))}
        {query.data?.total === 0 && (
          <DeskEmptyList filtered={Boolean(search)} kind="intervention" />
        )}
      </div>
      {query.data && (
        <DeskPagination
          page={page}
          total={query.data.total}
          pageSize={query.data.pageSize}
          onPage={setPage}
          label="intervenções"
        />
      )}
    </section>
  );
}
function OccurrenceList({
  studentId,
  selected,
  select,
  search,
}: Props & { search: string }): ReactElement {
  const [page, setPage] = useState(1);
  const query = trpc.occurrences.list.useQuery({ studentId, search, page });
  return (
    <section className={styles.group} aria-label="Ocorrências">
      <div className={styles.listScroll} tabIndex={0} role="region" aria-label="Lista de registros">
        {query.isPending && <DeskRowsLoading />}
        <QueryState
          pending={false}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.data?.rows.map((row) => (
          <button
            type="button"
            key={row.id}
            className={styles.recordButton}
            aria-pressed={selected?.kind === "occurrence" && selected.id === row.id}
            onClick={() => select({ kind: "occurrence", id: row.id })}
          >
            <strong title={row.title}>{row.title}</strong>
            <span className={styles.recordMeta}>
              <Badge variant="neutral">{row.classSession.class.portalClassName}</Badge>
              <small>
                {dateLabel(row.classSession.date)} · {row.recordedBy.name}
              </small>
            </span>
          </button>
        ))}
        {query.data?.total === 0 && <DeskEmptyList filtered={Boolean(search)} kind="occurrence" />}
      </div>
      {query.data && (
        <DeskPagination
          page={page}
          total={query.data.total}
          pageSize={query.data.pageSize}
          onPage={setPage}
          label="ocorrências"
        />
      )}
    </section>
  );
}
function DeskPagination({
  page,
  total,
  pageSize,
  onPage,
  label,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  label: string;
}): ReactElement | null {
  const pages = Math.ceil(total / pageSize);
  if (pages === 0) return null;
  return (
    <nav className={styles.pagination} aria-label={`Páginas de ${label}`}>
      <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span>
        {page} de {pages}
      </span>
      <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Próxima
      </Button>
    </nav>
  );
}

const SEARCH_DELAY_MS = 300;
function useDeskSearch(value: string): string {
  const [search, setSearch] = useState(value);
  useEffect(() => {
    const timeout = globalThis.setTimeout(() => setSearch(value), SEARCH_DELAY_MS);
    return () => globalThis.clearTimeout(timeout);
  }, [value]);
  return search;
}
