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

const count = (value: number, singular: string, plural: string): string =>
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
        <div className={styles.book} data-reading={reading}>
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
                    aria-current={entry.id === lesson.id ? "true" : undefined}
                    onClick={() => openLesson(entry.id)}
                  >
                    <span className={styles.ordinal}>
                      {String(entry.sequence).padStart(2, "0")}
                    </span>
                    <span>{entry.title}</span>
                    <ChevronRight size={15} aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <section aria-labelledby="book-lesson-title" className={styles.reader}>
            <div className={styles.mobileBack}>
              <Button
                size="compact-responsive"
                variant="ghost"
                onClick={() => {
                  setReading(false);
                  requestAnimationFrame(() =>
                    index.current
                      ?.querySelector<HTMLButtonElement>("button[aria-current]")
                      ?.focus(),
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
                <p className={styles.facts}>{count(lesson.pages.length, "página", "páginas")}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-compact-responsive"
                aria-label={"Editar " + lesson.title}
                title="Editar lição"
                onClick={() => openDialog({ action: "lesson", stageId: stage.id, lesson })}
              >
                <Pencil />
              </Button>
            </header>
            <LessonPages
              key={lesson.id}
              lesson={lesson}
              stageId={stage.id}
              pageId={pageId}
              setPage={setPage}
            />
          </section>
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title="O livro ainda não tem lições"
          action={
            <Button size="compact-responsive" onClick={addLesson}>
              <Plus /> Adicionar lição
            </Button>
          }
        />
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
                  {count(page.activities.length, "atividade", "atividades")}
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
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [feedback, setFeedback] = useState("");
  const lock = useRef(false);
  const utils = trpc.useUtils();
  const mutation = trpc.teachingPrograms.editCatalog.useMutation();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<string | null>(null);
  function finish() {
    setEditing(null);
    requestAnimationFrame(() => {
      if (trigger.current) document.getElementById(trigger.current)?.focus();
    });
  }
  function entry(edit: boolean) {
    const value = edit ? draft : newTitle;
    return (
      <form
        className={styles.activityEntry}
        aria-label={edit ? "Editar atividade" : "Adicionar atividade à página"}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!value.trim() || lock.current) return;
          lock.current = true;
          setFeedback("");
          try {
            await mutation.mutateAsync({
              action: "pageActivity",
              stageId,
              lessonId,
              pageId: page.id,
              ...(edit && editing ? { pageActivityId: editing } : {}),
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
            setFeedback(
              error instanceof Error ? error.message : "Não foi possível salvar a atividade.",
            );
          } finally {
            lock.current = false;
          }
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
          onChange={(event) => (edit ? setDraft : setNewTitle)(event.target.value)}
          onKeyDown={(event) => {
            if (edit && event.key === "Escape") {
              event.preventDefault();
              finish();
            }
          }}
        />
        <Button size="sm" type="submit" disabled={mutation.isPending || !value.trim()}>
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
  return (
    <>
      <ol className={styles.activityList}>
        {page.activities.map((activity) => (
          <li key={activity.id}>
            <span className={styles.ordinal}>{String(activity.sequence).padStart(2, "0")}</span>
            {editing === activity.id ? (
              entry(true)
            ) : (
              <>
                <span>{activity.title}</span>
                <Button
                  size="icon-compact-responsive"
                  variant="ghost"
                  id={activity.id + "-book-edit"}
                  aria-label={"Editar " + activity.title}
                  onClick={(event) => {
                    trigger.current = event.currentTarget.id;
                    setDraft(activity.title);
                    setEditing(activity.id);
                    setFeedback("");
                  }}
                >
                  <Pencil />
                </Button>
              </>
            )}
          </li>
        ))}
      </ol>
      {entry(false)}
      <span role="status" className={styles.facts}>
        {feedback}
      </span>
    </>
  );
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
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const match = /^\s*(\d+)\s*(?:[-–—]\s*(\d+))?\s*$/.exec(value);
    const start = Number(match?.[1]),
      end = Number(match?.[2] ?? match?.[1]);
    if (!match || start < 1 || end < start || end > 2147483647 || (page && start !== end)) {
      setMessage(
        page
          ? "Informe o número da página."
          : "Informe uma página ou um intervalo crescente, como 1-15.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (page)
        await mutation.mutateAsync({
          action: "page",
          stageId,
          lessonId,
          pageId: page.id,
          number: start,
        });
      else await mutation.mutateAsync({ action: "pages", stageId, lessonId, start, end });
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
    <form
      className={styles.pageEntry}
      onSubmit={submit}
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
          setValue(event.target.value);
          setMessage("");
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
