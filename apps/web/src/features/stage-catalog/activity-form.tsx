"use client";
import type { RouterInputs } from "@lazuli/api";
import { useState } from "react";
import { bookPageRange, TEACHING_HOUR_MINUTES } from "@lazuli/domain";
import { Button, Field, FormSection, Textarea, Label } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { compactPages } from "./labels";
import { Choice, EditorFormBody, TextField, formText } from "./editor-form";

import type { ProgramActivity, StageDetail, TeachingHour } from "./types";
import styles from "./workspace.module.css";

export const activityLabels = {
  LESSON: "Lição",
  INTRODUCTION: "Introdução",
  REVIEW: "Revisão",
  ASSESSMENT: "Prova",
  VIDEO: "Vídeo",
  ACTIVITY: "Atividade",
};

const MAX_INSTRUCTIONS_LENGTH = 5000;

type ActivityFormProps = {
  stage: StageDetail;
  programId: string;
  hour: TeachingHour;
  position: number;
  editing: boolean;
  onSaved: (title: string, deleted?: boolean) => void;
  description: string;
  close: () => void;
  form: React.RefObject<HTMLFormElement | null>;
  pending: React.RefObject<boolean>;
};

export function ActivityForm(props: ActivityFormProps): React.JSX.Element {
  const { editing, description, form, pending, close } = props;
  const [deleting, setDeleting] = useState(false);
  const draft = useActivityDraft(props);
  const { item, siblings, fields } = draft;
  const save = useSaveActivity(props, { ...draft, deleting });
  return (
    <EditorFormBody
      compact
      destructive={deleting}
      saveLabel={deleting ? "Confirmar exclusão" : "Salvar"}
      title={formTitle(deleting, editing)}
      description={description}
      form={form}
      pending={pending}
      onClose={close}
      onSave={save}
    >
      {deleting && item ? (
        <>
          <p>
            Excluir “{item.bookTitle}” desta hora-aula? Distribua os {item.durationMinutes} minutos
            entre as atividades restantes.
          </p>
          <DurationFields deleting siblings={siblings} item={item} />
        </>
      ) : (
        <div className={styles.activityColumns}>
          <ActivityFields {...fields} />
          <aside className={styles.timePanel}>
            <DurationFields siblings={siblings} item={item} />
          </aside>
          {item && (
            <DeleteActivityAction
              hasSiblings={siblings.length > 0}
              onDelete={() => {
                setDeleting(true);
                requestAnimationFrame(() =>
                  form.current?.querySelector<HTMLInputElement>("input")?.focus(),
                );
              }}
            />
          )}
        </div>
      )}
    </EditorFormBody>
  );
}

function rangeTitle(start: string, end: string): string {
  return !end || start === end ? "Página " + start : "Páginas " + start + "–" + end;
}
function RangePreview({
  matches,
}: {
  matches: ReturnType<typeof bookPageRange>;
}): React.JSX.Element {
  const groups = new Map<string, typeof matches>();
  for (const match of matches) {
    const lesson = groups.get(match.lessonId);
    if (lesson) lesson.push(match);
    else groups.set(match.lessonId, [match]);
  }
  return (
    <>
      {Array.from(groups, ([id, rows]) => {
        const numbers = [...new Set(rows.map((row) => row.page.number))];
        return (
          <div key={id}>
            <p>
              {rows[0]!.lessonTitle} · {compactPages(numbers)}
            </p>
            {rows
              .filter((row) => row.page.activities.length > 0)
              .map(({ page }) => (
                <p key={page.id}>
                  Pág. {page.number} ·{" "}
                  {page.activities.map((activity) => activity.title).join(", ")}
                </p>
              ))}
          </div>
        );
      })}
    </>
  );
}
function readPages(data: FormData): Pick<ProgramActivity, "pageStart" | "pageEnd"> {
  const start = formText(data, "pageStart"),
    end = formText(data, "pageEnd");
  if (end && (!start || Number(end) < Number(start)))
    throw new Error("Confira as páginas inicial e final.");
  return { pageStart: start ? Number(start) : null, pageEnd: end ? Number(end) : null };
}
function DurationFields({
  deleting = false,
  siblings,
  item,
}: {
  deleting?: boolean;
  siblings: ProgramActivity[];
  item: ProgramActivity | undefined;
}): React.JSX.Element {
  const [minutes, setMinutes] = useState(String(deleting ? 0 : (item?.durationMinutes ?? "")));
  const [others, setOthers] = useState(() =>
    Object.fromEntries(
      siblings.map((activity) => [
        activity.id,
        String(
          deleting && siblings.length === 1 ? TEACHING_HOUR_MINUTES : activity.durationMinutes,
        ),
      ]),
    ),
  );
  const total =
    Number(minutes) + Object.values(others).reduce((sum, value) => sum + Number(value), 0);
  return (
    <FormSection
      title="Distribuição da hora-aula"
      description={
        !item && siblings.length > 0
          ? "Informe a duração da nova atividade e ajuste as demais para somar 60 minutos."
          : undefined
      }
      action={
        <span aria-live="polite" className={styles.durationTotal}>
          {total} / {TEACHING_HOUR_MINUTES} min
        </span>
      }
    >
      <div className={styles.durationRows}>
        {!deleting && (
          <TextField
            label="Esta atividade (min)"
            name="minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            placeholder="Ex.: 10"
            required
          />
        )}
        {siblings.map((activity) => (
          <TextField
            key={activity.id}
            label={activity.bookTitle + " (min)"}
            name={"minutes-" + activity.id}
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={others[activity.id]}
            onChange={(event) => setOthers({ ...others, [activity.id]: event.target.value })}
            placeholder="Ex.: 20"
            required
          />
        ))}
      </div>
    </FormSection>
  );
}

function formTitle(deleting: boolean, editing: boolean): string {
  if (deleting) return "Excluir atividade";
  return editing ? "Editar atividade" : "Inserir atividade";
}

type ProgramEdit = RouterInputs["teachingPrograms"]["editProgram"];
type ActivityEdit = Extract<ProgramEdit, { action: "activity" }>;
function readDurations(data: FormData, siblings: ProgramActivity[]): ActivityEdit["others"] {
  return siblings.map((activity) => ({
    id: activity.id,
    minutes: Number(formText(data, "minutes-" + activity.id)),
  }));
}
type SaveActivity = Pick<ActivityEdit, "stageId" | "programId" | "position" | "others"> & {
  mode: string;
  item: ProgramActivity | undefined;
  followsAssessment: boolean;
  title: string;
  pageTitle: string;
  hour: TeachingHour;
};
function activityCommand(data: FormData, input: SaveActivity): ActivityEdit {
  const { mode, item, followsAssessment, position, stageId, programId, hour, others } = input;
  const minutes = Number(formText(data, "minutes"));
  if (minutes + others.reduce((sum, row) => sum + row.minutes, 0) !== TEACHING_HOUR_MINUTES)
    throw new Error("Distribua 60 minutos entre as atividades desta hora-aula.");
  const pages = mode === "pages" ? readPages(data) : { pageStart: null, pageEnd: null };
  const preserved = unchangedPages(item, pages);
  const kind = preserved?.kind ?? activityKind(item, followsAssessment);
  const savedTitle = activityTitle(input);
  return {
    action: "activity",
    stageId,
    programId,
    hourId: hour.id,
    expectedChange: hour.lastChange,
    position,
    activityId: item?.id ?? null,
    kind,
    title: savedTitle,
    instructions: formText(data, "instructions") || null,
    durationMinutes: minutes,
    ...pages,
    resolvePages: mode === "pages" && !preserved,
    others,
    lessons: preserveLessons(preserved),
  };
}

function activityKind(
  item: ProgramActivity | undefined,
  followsAssessment: boolean,
): ActivityEdit["kind"] {
  if (item?.kind === "ASSESSMENT" || (!item && followsAssessment)) return "ASSESSMENT";
  return "ACTIVITY";
}
function preserveLessons(item: ProgramActivity | undefined): ActivityEdit["lessons"] {
  if (item?.kind !== "LESSON") return [];
  return item.lessons.map((link) => ({
    id: link.id,
    part: link.part ?? "",
    partId: link.bookPart?.id ?? null,
    pageId: link.bookPage?.id ?? null,
    pageActivityId: link.pageActivity?.id ?? null,
  }));
}
type PageFieldsProps = {
  stage: StageDetail;
  start: string;
  setStart: (value: string) => void;
  end: string;
  setEnd: (value: string) => void;
};
function PageFields({ stage, start, setStart, end, setEnd }: PageFieldsProps): React.JSX.Element {
  const matches = bookPageRange(stage.lessons, { start: Number(start), end: Number(end || start) });
  return (
    <>
      <div className={styles.pages}>
        <TextField
          name="pageStart"
          label="Página inicial"
          type="number"
          min={1}
          required
          placeholder="Ex.: 18"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        <TextField
          name="pageEnd"
          label="Até (opcional)"
          type="number"
          min={Number(start) || 1}
          placeholder="Ex.: 21"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </div>
      {start && (
        <div aria-live="polite" className={styles.meta}>
          {matches.length > 0 ? (
            <RangePreview matches={matches} />
          ) : (
            "Nenhuma página cadastrada nesse intervalo."
          )}
        </div>
      )}
    </>
  );
}
function ActivityFields({
  stage,
  mode,
  setMode,
  title,
  setTitle,
  start,
  setStart,
  end,
  setEnd,
  pageTitle,
  item,
}: PageFieldsProps & {
  mode: string;
  setMode: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  pageTitle: string;
  item: ProgramActivity | undefined;
}): React.JSX.Element {
  return (
    <div className={styles.activityFields}>
      <Choice
        label="Conteúdo da atividade"
        options={[
          { value: "pages", label: "Páginas do livro" },
          { value: "text", label: "Texto livre" },
        ]}
        value={mode}
        onChange={setMode}
      />
      <TextField
        name="title"
        label={mode === "pages" ? "Título da atividade (opcional)" : "Título da atividade"}
        placeholder={mode === "pages" && start ? pageTitle : "Ex.: Conversação em duplas"}
        required={mode === "text"}
        maxLength={180}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      {mode === "pages" && <PageFields {...{ stage, start, setStart, end, setEnd }} />}
      <Field>
        <Label htmlFor="scheduled-instructions">Instruções (opcional)</Label>
        <Textarea
          id="scheduled-instructions"
          name="instructions"
          rows={4}
          maxLength={MAX_INSTRUCTIONS_LENGTH}
          defaultValue={item?.instructions ?? ""}
          placeholder="O que o docente deve orientar durante a atividade?"
        />
      </Field>
    </div>
  );
}
function DeleteActivityAction({
  hasSiblings,
  onDelete,
}: {
  hasSiblings: boolean;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <div>
      {hasSiblings ? (
        <Button type="button" size="sm" variant="destructive-ghost" onClick={onDelete}>
          Excluir atividade
        </Button>
      ) : (
        <p className={styles.meta}>Para excluir esta atividade, adicione outra à hora-aula.</p>
      )}
    </div>
  );
}

type ActivityDraft = {
  item: ProgramActivity | undefined;
  siblings: ProgramActivity[];
  followsAssessment: boolean;
  fields: React.ComponentProps<typeof ActivityFields>;
};
function useActivityDraft({ stage, hour, editing, position }: ActivityFormProps): ActivityDraft {
  const item = editing ? hour.activities.at(position) : undefined;
  const siblings = hour.activities.filter((activity) => activity.id !== item?.id);
  const followsAssessment = position > 0 && hour.activities[position - 1]?.kind === "ASSESSMENT";
  const initial = initialActivityDraft(item);
  const [mode, setMode] = useState(initial.mode);
  const [title, setTitle] = useState(initial.title);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const pageTitle = rangeTitle(start, end);

  return {
    item,
    siblings,
    followsAssessment,
    fields: {
      stage,
      mode,
      setMode,
      title,
      setTitle,
      start,
      setStart,
      end,
      setEnd,
      pageTitle,
      item,
    },
  };
}
type ActivitySaveInput = ActivityDraft & { deleting: boolean };
function useSaveActivity(
  { stage, programId, hour, position, onSaved }: ActivityFormProps,
  input: ActivitySaveInput,
): (data: FormData) => Promise<void> {
  const {
    item,
    siblings,
    followsAssessment,
    deleting,
    fields: { mode, title, pageTitle },
  } = input;
  const utils = trpc.useUtils();
  const mutation = trpc.teachingPrograms.editProgram.useMutation({
    onError: () => utils.teachingPrograms.detail.invalidate({ id: stage.id }),
  });
  return async (data) => {
    const others = readDurations(data, siblings);
    if (deleting && item) {
      await mutation.mutateAsync({
        action: "deleteActivity",
        stageId: stage.id,
        programId,
        hourId: hour.id,
        expectedChange: hour.lastChange,
        activityId: item.id,
        others,
      });
      await utils.teachingPrograms.detail.invalidate({ id: stage.id });
      onSaved(item.bookTitle, true);
      return;
    }
    const command = activityCommand(data, {
      mode,
      item,
      followsAssessment,
      title,
      pageTitle,
      position,
      stageId: stage.id,
      programId,
      hour,
      others,
    });
    await mutation.mutateAsync(command);
    await utils.teachingPrograms.detail.invalidate({ id: stage.id });
    onSaved(command.title);
  };
}

function unchangedPages(
  item: ProgramActivity | undefined,
  pages: Pick<ProgramActivity, "pageStart" | "pageEnd">,
): ProgramActivity | undefined {
  return item && item.pageStart === pages.pageStart && item.pageEnd === pages.pageEnd
    ? item
    : undefined;
}
function activityTitle({ title, mode, pageTitle }: SaveActivity): string {
  const value = title.trim() || (mode === "pages" ? pageTitle : "");
  if (!value) throw new Error("Informe o título da atividade.");
  return value;
}

function initialActivityDraft(item: ProgramActivity | undefined): {
  mode: string;
  title: string;
  start: string;
  end: string;
} {
  if (!item) return { mode: "pages", title: "", start: "", end: "" };
  const start = String(item.pageStart ?? "");
  const end = String(item.pageEnd ?? "");
  const usingPages = item.pageStart !== null;
  const title = usingPages && item.bookTitle === rangeTitle(start, end) ? "" : item.bookTitle;
  return { mode: usingPages ? "pages" : "text", title, start, end };
}
