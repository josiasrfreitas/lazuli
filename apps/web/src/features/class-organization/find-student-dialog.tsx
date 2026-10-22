"use client";
import { useState, type JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Button, Input } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { TaskDialog } from "~/features/shared/task-form";
import type { OrganizationDialogProps as Props } from "./dialogs";
import styles from "./organization.module.css";
const STUDENT_PAGE_SIZE = 25;
type StudentsQuery = QueryResult<RouterOutputs["semesterOrganization"]["students"]>;

export function FindStudent({
  board,
  onClose,
  onAction,
}: Pick<Props, "board" | "onClose" | "onAction">): ReactJSX.Element {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const query = trpc.semesterOrganization.students.useQuery({
    semesterId: board.semester.id,
    search,
    page,
    unassigned: true,
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Incluir aluno na organização"
      description={`Alunos cadastrados sem proposta em ${board.semester.name}.`}
      formId="organization-find"
      firstField="organization-student-search"
      submitLabel="Cadastrar novo aluno"
      pending={false}
      onClose={onClose}
      error={query.error?.message}
    >
      <form
        id="organization-find"
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onAction({ kind: "student" });
        }}
      >
        <StudentSearchField search={search} setSearch={setSearch} setPage={setPage} />
        <StudentSearchResults query={query} onAction={onAction} />
        <StudentSearchPagination query={query} page={page} setPage={setPage} />
      </form>
    </TaskDialog>
  );
}

function StudentSearchField({
  search,
  setSearch,
  setPage,
}: {
  search: string;
  setSearch: (value: string) => void;
  setPage: (value: number) => void;
}): ReactJSX.Element {
  return (
    <Input
      id="organization-student-search"
      size="sm"
      placeholder="Buscar por nome"
      value={search}
      onChange={(event) => {
        setSearch(event.target.value);
        setPage(1);
      }}
      aria-label="Buscar aluno"
    />
  );
}

function StudentSearchResults({
  query,
  onAction,
}: {
  query: StudentsQuery;
  onAction: Props["onAction"];
}): ReactJSX.Element {
  return (
    <div className="min-h-48 max-h-80 overflow-auto" aria-busy={query.isFetching}>
      {query.isPending ? (
        <p className={styles.small}>Carregando alunos…</p>
      ) : (
        query.data?.rows.map((student) => (
          <button
            type="button"
            className={styles.queueItem}
            key={student.id}
            onClick={() => onAction({ kind: "placement", studentId: student.id })}
          >
            <span className={styles.person}>
              <strong>{student.name}</strong>
              <span className={styles.small}>
                {student.current
                  .map((current) => `${current.stageCode} · ${current.className}`)
                  .join(" / ") || "Sem turma atual"}
              </span>
            </span>
            <span className="text-caption text-interactive">Incluir</span>
          </button>
        ))
      )}
      {query.data?.rows.length === 0 && (
        <p className={styles.small}>Nenhum aluno encontrado. Você pode cadastrar um novo.</p>
      )}
    </div>
  );
}

function StudentSearchPagination({
  query,
  page,
  setPage,
}: {
  query: StudentsQuery;
  page: number;
  setPage: (value: number) => void;
}): ReactJSX.Element | null {
  if (!query.data || query.data.total <= STUDENT_PAGE_SIZE) return null;
  return (
    <div className={styles.row}>
      <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>
        Anterior
      </Button>
      <span className={styles.small}>Página {page}</span>
      <Button
        size="sm"
        variant="ghost"
        disabled={page * STUDENT_PAGE_SIZE >= query.data.total}
        onClick={() => setPage(page + 1)}
      >
        Próxima
      </Button>
    </div>
  );
}
