"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  initialWorkshopState,
  type ActionKind,
  type WorkshopState,
  type Case,
  type Occurrence,
} from "./model";
type Direction = "timeline" | "dossier" | "focus";
type Selection = { type: "case" | "occurrence"; id: string };
type Action = { kind: ActionKind; id: string };
type OpenAction = (kind: ActionKind, id?: string) => void;
export const DIRECTIONS: { id: Direction; title: string; description: string; tradeoff: string }[] =
  [
    {
      id: "timeline",
      title: "Linha do tempo",
      description:
        "A história da aluna organiza o trabalho. Relatos e intervenções são abertos no próprio fluxo.",
      tradeoff: "Bom para reconstruir o contexto; históricos extensos pedem busca e filtros.",
    },
    {
      id: "dossier",
      title: "Mesa de acompanhamento",
      description:
        "Escolha um registro à esquerda e trabalhe no detalhe sem perder a lista de vista.",
      tradeoff: "Bom para alternar entre casos; no celular, lista e detalhe viram duas etapas.",
    },
    {
      id: "focus",
      title: "Próximo passo",
      description:
        "O que precisa de atenção vem primeiro. Cada intervenção apresenta o combinado e a próxima ação.",
      tradeoff:
        "Bom para a rotina de revisão; o histórico fica em segundo plano, mas sempre acessível.",
    },
  ];
type Controller = {
  direction: Direction;
  setDirection: Dispatch<SetStateAction<Direction>>;
  state: WorkshopState;
  setState: Dispatch<SetStateAction<WorkshopState>>;
  selection: Selection | null;
  setSelection: Dispatch<SetStateAction<Selection | null>>;
  action: Action | null;
  setAction: Dispatch<SetStateAction<Action | null>>;
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  notice: string;
  setNotice: Dispatch<SetStateAction<string>>;
  chosen: Direction | null;
  setChosen: Dispatch<SetStateAction<Direction | null>>;
};
export type WorkshopView = Controller & {
  option: (typeof DIRECTIONS)[number];
  activeCount: number;
  open: OpenAction;
  selectedCase: Case | undefined;
  selectedOccurrence: Occurrence | undefined;
  cases: Case[];
  occurrences: Occurrence[];
};
export function useWorkshop(): WorkshopView {
  const [direction, setDirection] = useState<Direction>("timeline");
  const [state, setState] = useState(initialWorkshopState);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [chosen, setChosen] = useState<Direction | null>(null);
  return buildView({
    direction,
    setDirection,
    state,
    setState,
    selection,
    setSelection,
    action,
    setAction,
    filter,
    setFilter,
    search,
    setSearch,
    notice,
    setNotice,
    chosen,
    setChosen,
  });
}
function buildView(vm: Controller): WorkshopView {
  const { direction, state, selection, filter, search, setAction } = vm;
  const option = DIRECTIONS.find((item) => item.id === direction)!;
  const activeCount = state.cases.filter((row) => row.status !== "CONCLUDED").length;
  const open: OpenAction = (kind, id = "") => setAction({ kind, id });
  const selectedCase = state.cases.find(
    (row) => selection?.type === "case" && row.id === selection.id,
  );
  const selectedOccurrence = state.occurrences.find(
    (row) => selection?.type === "occurrence" && row.id === selection.id,
  );
  const cases = state.cases.filter(
    (row) =>
      (filter === "all" ||
        (filter === "closed" ? row.status === "CONCLUDED" : row.status !== "CONCLUDED")) &&
      row.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
  );
  const occurrences = state.occurrences.filter((row) =>
    row.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
  );
  return { ...vm, option, activeCount, open, selectedCase, selectedOccurrence, cases, occurrences };
}
