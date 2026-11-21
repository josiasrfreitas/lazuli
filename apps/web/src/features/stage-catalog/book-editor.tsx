"use client";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
} from "lucide-react";
import { Button, EmptyState, Input } from "@lazuli/ui";
import { CatalogDialog, type BookDialogState } from "./catalog-dialog";

import { trpc } from "~/lib/trpc";
import { stageContext } from "./labels";
import type { BookLesson, BookPage, StageDetail } from "./types";
import styles from "./book-editor.module.css";

const count = (value: number, [singular, plural]: [string, string]): string =>
  value + " " + (value === 1 ? singular : plural);

export function BookEditor({
  stage,
  announce,
}: {
  stage: StageDetail;
  announce: (message: string) => void;
}): React.JSX.Element {
  const [lessonId, setLesson] = useState<string | null>(null);

  const [pageId, setPage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<BookDialogState | null>(null);
  const [reading, setReading] = useState(false);
  const index = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const book = stage.lessons;
  const lesson = book.find((row) => row.id === lessonId) ?? book[0];

  function openLesson(id: string): void {
    setLesson(id);
    setReading(true);

    setPage(null);
    requestAnimationFrame(() => {
      if (!index.current?.getClientRects().length) heading.current?.focus();
    });
  }
  function openDialog(item: BookDialogState): void {
    announce("");
    setDialog(item);
  }
  function saved(id: string): void {
    if (!dialog) return;
    const messages = {
      lesson: "Lição salva.",
      part: "Parte salva.",
      page: "Página salva.",
      pageActivity: "Atividade da página salva.",
    };
    requestAnimationFrame(() => announce(messages[dialog.action]));
    if (dialog?.action === "lesson") openLesson(id);
    if (dialog?.action === "page") setPage(id);
  }
  const addLesson = (): void => openDialog({ action: "lesson", stageId: stage.id });
  return (
    <>
      {lesson ? (
        <BookReader
          {...{
            book,
            lesson,
            reading,
            index,
            heading,
            addLesson,
            openLesson,
            openDialog,
            pageId,
            setPage,
          }}
          stageId={stage.id}
          showIndex={() => setReading(false)}
        />
      ) : (
        <BookEmpty addLesson={addLesson} />
      )}
      {dialog && (
        <CatalogDialog
          item={dialog}
          stageLabel={stageContext(stage)}
          onClose={() => setDialog(null)}
          afterSave={saved}
        />
      )}
    </>
  );
}

function LessonPages({
  lesson,
  stageId,
  pageId,
  setPage,
}: {
  lesson: BookLesson;
  stageId: string;
  pageId: string | null;
  setPage: (id: string | null) => void;
}): React.JSX.Element {
  const pages = lesson.pages;
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <section className={styles.pages} aria-label={"Páginas · " + lesson.title}>
      <header className={styles.sectionHead}>
        <h3>Páginas</h3>
        <PageEntry stageId={stageId} lessonId={lesson.id} />
      </header>
      {pages.length === 0 && <p className={styles.empty}>Nenhuma página cadastrada nesta lição.</p>}
      {pages.map((page) => {
        const expanded = page.id === pageId;
        const label = "Página " + page.number;
        return (
          <div className={styles.page} key={page.id}>
            <div className={styles.pageHead}>
              <button
                className={styles.pageToggle}
                type="button"
                aria-expanded={expanded}
                aria-controls={"page-" + page.id}
                onClick={() => setPage(expanded ? null : page.id)}
              >
                <FileText size={17} aria-hidden />
                <strong>{label}</strong>
                <span className={styles.facts}>
                  {count(page.activities.length, ["atividade", "atividades"])}
                </span>
                {expanded ? (
                  <ChevronDown size={16} aria-hidden />
                ) : (
                  <ChevronRight size={16} aria-hidden />
                )}
              </button>
              <Button
                size="icon-compact-responsive"
                variant="ghost"
                aria-label={"Editar página " + page.number}
                title="Editar página"
                onClick={() => setRenaming(page.id)}
              >
                <Pencil />
              </Button>
            </div>
            {renaming === page.id && (
              <PageEntry
                stageId={stageId}
                lessonId={lesson.id}
                page={page}
                close={() => setRenaming(null)}
              />
            )}
            <div id={"page-" + page.id} hidden={!expanded} className={styles.pageBody}>
              <PageActivities page={page} stageId={stageId} lessonId={lesson.id} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
function PageActivities({
  page,
  stageId,
  lessonId,
}: {
  page: BookPage;
  stageId: string;
  lessonId: string;
}): React.JSX.Element {
  const state = usePageActivityEditor({ page, stageId, lessonId });
  const {
    editing,
    draft,
    newTitle,
    feedback,
    finish,
    save,
    saving,
    input,
    setDraft,
    setNewTitle,
    open,
  } = state;
  return (
    <>
      <ol className={styles.activityList}>
        {page.activities.map((activity) => (
          <li key={activity.id}>
            <span className={styles.ordinal}>{String(activity.sequence).padStart(2, "0")}</span>
            {editing === activity.id ? (
              <PageActivityEntry
                edit
                input={input}
                value={draft}
                finish={finish}
                update={setDraft}
                save={() => save({ value: draft, pageActivityId: activity.id })}
                saving={saving}
              />
            ) : (
              <>
                <span>{activity.title}</span>
                <Button
                  size="icon-compact-responsive"
                  variant="ghost"
                  id={activity.id + "-book-edit"}
                  aria-label={"Editar " + activity.title}
                  onClick={(event) => open(activity, event.currentTarget.id)}
                >
                  <Pencil />
                </Button>
              </>
            )}
          </li>
        ))}
      </ol>
      <PageActivityEntry
        input={input}
        value={newTitle}
        finish={finish}
        update={setNewTitle}
        save={() => save({ value: newTitle })}
        saving={saving}
      />
      <span role="status" className={styles.facts}>
        {feedback}
      </span>
    </>
  );
}

type PageActivitiesInput = { page: BookPage; stageId: string; lessonId: string };
type PageActivityEditor = {
  editing: string | null;
  draft: string;
  newTitle: string;
  feedback: string;
  finish: () => void;
  save: (entry: PageActivitySave) => Promise<void>;
  saving: boolean;
  input: React.RefObject<HTMLInputElement | null>;
  setDraft: (value: string) => void;
  setNewTitle: (value: string) => void;
  open: (activity: BookPage["activities"][number], id: string) => void;
};
type PageActivitySave = { value: string; pageActivityId?: string };
function usePageActivityEditor({
  page,
  stageId,
  lessonId,
}: PageActivitiesInput): PageActivityEditor {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [feedback, setFeedback] = useState("");
  const lock = useRef(false);
  const utils = trpc.useUtils();
  const mutation = trpc.teachingPrograms.editCatalog.useMutation();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<string | null>(null);
  function finish(): void {
    setEditing(null);
    requestAnimationFrame(() => {
      if (trigger.current)
        document.querySelector<HTMLElement>(`#${CSS.escape(trigger.current)}`)?.focus();
    });
  }
  async function save({ value, pageActivityId }: PageActivitySave): Promise<void> {
    const edit = pageActivityId !== undefined;
    if (!value.trim() || lock.current) return;
    lock.current = true;
    setFeedback("");
    try {
      await mutation.mutateAsync({
        action: "pageActivity",
        stageId,
        lessonId,
        pageId: page.id,
        pageActivityId,
        title: value.trim(),
      });
      await utils.teachingPrograms.detail.invalidate({ id: stageId });
      if (edit) finish();
      else {
        setNewTitle("");
        input.current?.focus();
      }
      setFeedback(edit ? "Atividade atualizada." : "Atividade adicionada.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar a atividade.");
    } finally {
      lock.current = false;
    }
  }

  function open(activity: BookPage["activities"][number], id: string): void {
    trigger.current = id;
    setDraft(activity.title);
    setEditing(activity.id);
    setFeedback("");
  }
  return {
    editing,
    draft,
    newTitle,
    feedback,
    finish,
    save,
    saving: mutation.isPending,
    input,
    setDraft,
    setNewTitle,
    open,
  };
}

function PageEntry({
  stageId,
  lessonId,
  page,
  close,
}: {
  stageId: string;
  lessonId: string;
  page?: BookPage;
  close?: () => void;
}): React.JSX.Element {
  const [value, setValue] = useState(page ? String(page.number) : "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const utils = trpc.useUtils();
  const mutation = trpc.teachingPrograms.editCatalog.useMutation();
  async function submit(): Promise<void> {
    if (busy) return;
    const range = pageRange(value, Boolean(page));
    if (!range) {
      setMessage(
        page
          ? "Informe o número da página."
          : "Informe uma página ou um intervalo crescente, como 1-15.",
      );
      return;
    }
    const { start, end } = range;
    setBusy(true);
    setMessage("");
    try {
      await mutation.mutateAsync(
        page
          ? { action: "page", stageId, lessonId, pageId: page.id, number: start }
          : { action: "pages", stageId, lessonId, start, end },
      );
      await utils.teachingPrograms.detail.invalidate({ id: stageId });
      setValue("");
      setMessage(
        start === end
          ? "Página " + start + " cadastrada."
          : "Páginas " + start + " a " + end + " cadastradas.",
      );
      close?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar as páginas.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageEntryForm
      {...{ page, value, busy, message, close, submit }}
      update={(next) => {
        setValue(next);
        setMessage("");
      }}
    />
  );
}

type BookIndexProps = {
  index: React.RefObject<HTMLElement | null>;
  addLesson: () => void;
  book: BookLesson[];
  openLesson: (id: string) => void;
};
function BookReader({
  book,
  lesson,
  reading,
  index,
  heading,
  addLesson,
  openLesson,
  openDialog,
  pageId,
  setPage,
  showIndex,
  stageId,
}: BookIndexProps & {
  lesson: BookLesson;
  reading: boolean;
  heading: React.RefObject<HTMLHeadingElement | null>;
  openDialog: (item: BookDialogState) => void;
  pageId: string | null;
  setPage: (value: string | null) => void;
  showIndex: () => void;
  stageId: string;
}): React.JSX.Element {
  return (
    <div className={styles.book} data-reading={reading}>
      <BookIndex {...{ index, addLesson, book, openLesson }} current={lesson.id} />
      <section aria-labelledby="book-lesson-title" className={styles.reader}>
        <div className={styles.mobileBack}>
          <Button
            size="compact-responsive"
            variant="ghost"
            onClick={() => {
              showIndex();
              requestAnimationFrame(() =>
                index.current?.querySelector<HTMLButtonElement>("button[aria-current]")?.focus(),
              );
            }}
          >
            <ArrowLeft /> Índice do livro
          </Button>
        </div>
        <header className={styles.lessonHead}>
          <div>
            <h2 id="book-lesson-title" ref={heading} tabIndex={-1}>
              {lesson.title}
            </h2>
            <p className={styles.facts}>{count(lesson.pages.length, ["página", "páginas"])}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-compact-responsive"
            aria-label={"Editar " + lesson.title}
            title="Editar lição"
            onClick={() => openDialog({ action: "lesson", stageId: stageId, lesson })}
          >
            <Pencil />
          </Button>
        </header>
        <LessonPages
          key={lesson.id}
          lesson={lesson}
          stageId={stageId}
          pageId={pageId}
          setPage={setPage}
        />
      </section>
    </div>
  );
}
function BookIndex({
  index,
  addLesson,
  book,
  openLesson,
  current,
}: BookIndexProps & { current: string }): React.JSX.Element {
  return (
    <nav ref={index} className={styles.index} aria-label="Índice de lições">
      <header className={styles.indexHead}>
        <h2>Índice do livro</h2>
        <Button size="compact-responsive" variant="ghost" onClick={addLesson}>
          <Plus /> Adicionar lição
        </Button>
      </header>
      <ol className={styles.indexList}>
        {book.map((entry) => (
          <li key={entry.id}>
            <button
              className={styles.lessonButton}
              type="button"
              aria-current={entry.id === current ? "true" : undefined}
              onClick={() => openLesson(entry.id)}
            >
              <span className={styles.ordinal}>{String(entry.sequence).padStart(2, "0")}</span>
              <span>{entry.title}</span>
              <ChevronRight size={15} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PageActivityEntry({
  edit = false,
  input,
  value,
  finish,
  update,
  save,
  saving,
}: {
  edit?: boolean;
  input: React.RefObject<HTMLInputElement | null>;
  value: string;
  finish: () => void;
  update: (value: string) => void;
  save: () => Promise<void>;
  saving: boolean;
}): React.JSX.Element {
  return (
    <form
      className={styles.activityEntry}
      aria-label={edit ? "Editar atividade" : "Adicionar atividade à página"}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Input
        size="sm"
        ref={edit ? undefined : input}
        autoFocus={edit}
        name="title"
        aria-label="Título da atividade"
        placeholder="Título da atividade"
        autoComplete="off"
        maxLength={180}
        required
        value={value}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (edit && event.key === "Escape") {
            event.preventDefault();
            finish();
          }
        }}
      />
      <Button size="sm" type="submit" disabled={saving || !value.trim()}>
        {edit ? "Salvar" : "Adicionar"}
      </Button>
      {edit && (
        <Button size="sm" variant="ghost" onClick={finish}>
          Cancelar
        </Button>
      )}
    </form>
  );
}

const MAX_PAGE_NUMBER = 2_147_483_647;
function pageRange(value: string, single: boolean): { start: number; end: number } | null {
  const match = /^\s*(\d+)\s*(?:[-–—]\s*(\d+))?\s*$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (start < 1 || end < start || end > MAX_PAGE_NUMBER || (single && start !== end)) return null;
  return { start, end };
}
function PageEntryForm({
  page,
  value,
  busy,
  message,
  close,
  submit,
  update,
}: {
  page: BookPage | undefined;
  value: string;
  busy: boolean;
  message: string;
  close: (() => void) | undefined;
  submit: () => Promise<void>;
  update: (value: string) => void;
}): React.JSX.Element {
  return (
    <form
      className={styles.pageEntry}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      aria-label={page ? "Renumerar página" : "Adicionar páginas"}
    >
      <Input
        size="sm"
        name="pages"
        type="text"
        autoFocus={!!page}
        autoComplete="off"
        aria-label={page ? "Novo número da página" : "Página ou intervalo"}
        placeholder={page ? "Número" : "Ex.: 1-15"}
        value={value}
        disabled={busy}
        onChange={(event) => {
          update(event.target.value);
        }}
      />
      <Button size="sm" type="submit" disabled={busy}>
        {page ? "Salvar" : "Adicionar páginas"}
      </Button>
      {close && (
        <Button size="sm" variant="ghost" onClick={close}>
          Cancelar
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}

function BookEmpty({ addLesson }: { addLesson: () => void }): React.JSX.Element {
  return (
    <EmptyState
      icon={<BookOpen />}
      title="O livro ainda não tem lições"
      action={
        <Button size="compact-responsive" onClick={addLesson}>
          <Plus /> Adicionar lição
        </Button>
      }
    />
  );
}
