const WORKSHOP_AUTHOR = "Agora · Você";
export type RecordStatus = "OPEN" | "IN_PROGRESS" | "CONCLUDED";
export type Entry = { title: string; body: string; date: string };
export type Case = {
  id: string;
  title: string;
  objective: string;
  nextStep: string;
  teacher: string;
  due: string;
  status: RecordStatus;
  occurrenceIds: string[];
  history: Entry[];
};
export type Occurrence = {
  id: string;
  title: string;
  body: string;
  response: string;
  lesson: string;
  category: string;
  notes: Entry[];
};
export type WorkshopState = { cases: Case[]; occurrences: Occurrence[] };
export type ActionKind =
  | "occurrence"
  | "create"
  | "note"
  | "start"
  | "conclude"
  | "reopen"
  | "assign"
  | "link"
  | "complement";
export type Draft = {
  title: string;
  body: string;
  nextStep: string;
  teacher: string;
  due: string;
  occurrenceIds: string[];
  lesson: string;
  category: string;
  response: string;
};
export const ACTION_LABELS: Record<ActionKind, string> = {
  occurrence: "Registrar ocorrência",
  create: "Abrir intervenção",
  note: "Registrar evolução",
  start: "Iniciar atuação",
  conclude: "Concluir intervenção",
  reopen: "Reabrir intervenção",
  assign: "Alterar responsável",
  link: "Vincular ocorrências",
  complement: "Complementar relato",
};
export const STATUS_LABELS: Record<RecordStatus, string> = {
  OPEN: "A iniciar",
  IN_PROGRESS: "Em andamento",
  CONCLUDED: "Concluída",
};
const INITIAL_STATE: WorkshopState = {
  cases: [
    {
      id: "writing",
      title: "Ganhar autonomia na escrita",
      teacher: "Beatriz Albuquerque",
      objective: "Organizar pequenas frases com mais segurança, sem depender do modelo no quadro.",
      nextStep: "Retomar o texto com apoio de palavras-chave e comparar com a primeira versão.",
      due: "15/10/2026",
      status: "IN_PROGRESS",
      occurrenceIds: ["writing-lesson"],
      history: [
        {
          title: "Primeiro retorno",
          date: "12 out · Beatriz Albuquerque",
          body: "Conseguiu escrever três frases com palavras-chave. Ainda pede confirmação antes de entregar.",
        },
        {
          title: "Atuação iniciada",
          date: "08 out · Beatriz Albuquerque",
          body: "Combinamos dez minutos de escrita orientada ao final da aula.",
        },
      ],
    },
    {
      id: "participation",
      title: "Participar das atividades em dupla",
      teacher: "Beatriz Albuquerque",
      objective: "Ajudar a aluna a participar com segurança das conversas em dupla.",
      nextStep: "Observar participação na próxima atividade oral.",
      due: "09/10/2026",
      status: "OPEN",
      occurrenceIds: [],
      history: [],
    },
    {
      id: "adaptation",
      title: "Adaptação à nova turma",
      teacher: "Rafael Lima",
      objective: "Acolher a aluna na transição para o novo grupo.",
      nextStep: "",
      due: "25/09/2026",
      status: "CONCLUDED",
      occurrenceIds: [],
      history: [
        {
          title: "Intervenção concluída",
          date: "25 set · Rafael Lima",
          body: "A aluna está integrada ao grupo e participa das atividades sem apoio adicional.",
        },
      ],
    },
  ],
  occurrences: [
    {
      id: "writing-lesson",
      title: "Dificuldade para iniciar o texto",
      lesson: "07/10/2026 · Connect 1",
      category: "Aprendizagem",
      body: "Na atividade de escrita, aguardou o modelo no quadro antes de começar. Com apoio individual, conseguiu organizar as primeiras frases.",
      response: "Retomei as instruções com um exemplo e propus começar com palavras-chave.",
      notes: [],
    },
    {
      id: "oral-lesson",
      title: "Pouca participação na conversa",
      lesson: "12/10/2026 · Connect 1",
      category: "Participação",
      body: "Preferiu observar a dupla durante a atividade oral, mesmo conhecendo o vocabulário.",
      response: "Convidei a aluna a ensaiar uma resposta comigo antes de falar com a colega.",
      notes: [],
    },
  ],
};
export function initialWorkshopState(): WorkshopState {
  return structuredClone(INITIAL_STATE);
}
export type WorkshopAction = { kind: ActionKind; id: string; draft: Draft; newId: string };
function createCase({ draft, newId, kind }: WorkshopAction): Case {
  return {
    id: newId,
    title: draft.title,
    objective: draft.body,
    nextStep: draft.nextStep,
    teacher: draft.teacher,
    due: draft.due,
    status: "OPEN",
    occurrenceIds: draft.occurrenceIds,
    history: [{ title: ACTION_LABELS[kind], body: draft.body, date: WORKSHOP_AUTHOR }],
  };
}
function updateCase(row: Case, { kind, id, draft }: WorkshopAction): Case {
  if (row.id !== id) return row;
  let status = row.status;
  if (kind === "conclude") status = "CONCLUDED";
  if (kind === "start") status = "IN_PROGRESS";
  if (kind === "reopen") status = "OPEN";
  return {
    ...row,
    status,
    history: [
      { title: ACTION_LABELS[kind], body: draft.body, date: WORKSHOP_AUTHOR },
      ...row.history,
    ],
    ...(kind === "assign" ? { teacher: draft.teacher } : {}),
    ...(kind === "link" ? { occurrenceIds: draft.occurrenceIds } : {}),
    ...(["note", "start", "reopen"].includes(kind)
      ? { nextStep: draft.nextStep, due: draft.due }
      : {}),
  };
}
export function isOverdue(row: Case): boolean {
  return (
    row.status !== "CONCLUDED" &&
    Boolean(row.due) &&
    row.due.split("/").toReversed().join("-") < "2026-10-13"
  );
}
export function applyWorkshopAction(state: WorkshopState, action: WorkshopAction): WorkshopState {
  const { kind, id, draft, newId } = action;
  if (kind === "occurrence")
    return {
      ...state,
      occurrences: [
        {
          id: newId,
          title: draft.title,
          body: draft.body,
          lesson: draft.lesson,
          category: draft.category,
          response: draft.response,
          notes: [],
        },
        ...state.occurrences,
      ],
    };
  if (kind === "create") return { ...state, cases: [createCase(action), ...state.cases] };
  if (kind === "complement")
    return {
      ...state,
      occurrences: state.occurrences.map((row) =>
        row.id === id
          ? {
              ...row,
              notes: [
                { title: ACTION_LABELS[kind], body: draft.body, date: WORKSHOP_AUTHOR },
                ...row.notes,
              ],
            }
          : row,
      ),
    };
  return { ...state, cases: state.cases.map((row) => updateCase(row, action)) };
}
