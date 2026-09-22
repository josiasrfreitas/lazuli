import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useSearchParams } from "next/navigation";
import { InlineSkeleton, Input, Tabs, TabsList, TabsTab } from "@lazuli/ui";
import type { FinanceInstallmentsOutput } from "@lazuli/validators";
import { debounce } from "~/lib/debounce";
import { SEARCH_MAX_LENGTH } from "./filters";

const SEARCH_DEBOUNCE_MS = 300;
type ControlsProps = {
  search: string;
  status: string | null;
  counts: FinanceInstallmentsOutput["counts"] | undefined;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
};
function SearchField({
  search,
  onSearch,
}: Pick<ControlsProps, "search" | "onSearch">): ReactElement {
  const [value, setValue] = useState(search);
  const location = useSearchParams().toString();
  const commit = useMemo(() => debounce(onSearch, SEARCH_DEBOUNCE_MS), [onSearch]);
  useEffect(() => {
    setValue(search);
    commit.cancel();
  }, [search, location, commit]);
  useEffect(
    () => () => {
      commit.cancel();
    },
    [commit],
  );
  return (
    <Input
      aria-label="Buscar por pagador ou beneficiário"
      className="w-full sm:w-80"
      type="search"
      placeholder="Buscar por pagador ou beneficiário"
      maxLength={SEARCH_MAX_LENGTH}
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        commit(event.target.value);
      }}
    />
  );
}
export function InstallmentsControls(props: ControlsProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchField key={props.status ?? "todas"} search={props.search} onSearch={props.onSearch} />
      <Tabs
        activeWeight="medium"
        value={props.status ?? "todas"}
        onValueChange={(next) => {
          props.onStatus(String(next));
        }}
      >
        <TabsList>
          {[
            { value: "todas", label: "Todas", count: props.counts?.all },
            { value: "vencidas", label: "Vencidas", count: props.counts?.overdue },
            { value: "pagas", label: "Pagas", count: props.counts?.paid },
          ].map((tab) => (
            <TabsTab key={tab.value} value={tab.value}>
              {tab.label}
              {tab.count === undefined ? (
                <InlineSkeleton className="w-5" />
              ) : (
                <span className="font-numeric text-xs tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
