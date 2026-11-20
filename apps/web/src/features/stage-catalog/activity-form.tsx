"use client";
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

export function ActivityForm({
  stage,
  programId,
  hour,
  position,
  editing,
  onSaved,
  description,
  close,
  form,
  pending,
}: {
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
}): React.JSX.Element {
  const item = editing ? hour.activities.at(position) : undefined;
  const [deleting, setDeleting] = useState(false);
  const siblings = hour.activities.filter((activity) => activity.id !== item?.id);
  const followsAssessment = position > 0 && hour.activities[position - 1]?.kind === "ASSESSMENT";
  const [mode, setMode] = useState(item && item.pageStart === null ? "text" : "pages");
  const existingDefault =
    item?.pageStart != null ? rangeTitle(String(item.pageStart), String(item.pageEnd ?? "")) : null;
  const [title, setTitle] = useState(
    item?.bookTitle === existingDefault ? "" : (item?.bookTitle ?? ""),
  );
  const [start, setStart] = useState(String(item?.pageStart ?? ""));
  const [end, setEnd] = useState(String(item?.pageEnd ?? ""));
  const matches = bookPageRange(stage.lessons, Number(start), Number(end || start));
  const pageTitle = rangeTitle(start, end);
  const utils = trpc.useUtils();
  const mutation = trpc.teachingPrograms.editProgram.useMutation({
    onError: () => utils.teachingPrograms.detail.invalidate({ id: stage.id }),
  });
  return (
    <EditorFormBody
      compact
      destructive={deleting}
      saveLabel={deleting ? "Confirmar exclusão" : "Salvar"}
      title={deleting ? "Excluir atividade" : editing ? "Editar atividade" : "Inserir atividade"}
      description={description}
      form={form}
      pending={pending}
      onClose={close}
      onSave={async (data) => {
        const minutes = Number(formText(data, "minutes"));
        const others = siblings.map((activity) => ({
          id: activity.id,
          minutes: Number(formText(data, "minutes-" + activity.id)),
        }));
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
        if (minutes + others.reduce((sum, row) => sum + row.minutes, 0) !== TEACHING_HOUR_MINUTES)
          throw new Error("Distribua 60 minutos entre as atividades desta hora-aula.");
        const pages = mode === "pages" ? readPages(data) : { pageStart: null, pageEnd: null };
        const preserve =
          !!item && item.pageStart === pages.pageStart && item.pageEnd === pages.pageEnd;
        const kind = preserve
          ? item.kind
          : item?.kind === "ASSESSMENT" || (!item && followsAssessment)
            ? "ASSESSMENT"
            : "ACTIVITY";
        const savedTitle = title.trim() || (mode === "pages" ? pageTitle : "");
        if (!savedTitle) throw new Error("Informe o título da atividade.");
        await mutation.mutateAsync({
          action: "activity",
          stageId: stage.id,
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
          resolvePages: mode === "pages" && !preserve,
          others,
          lessons:
            preserve && kind === "LESSON"
              ? item.lessons.map((link) => ({
                  id: link.id,
                  part: link.part ?? "",
                  partId: link.bookPart?.id ?? null,
                  pageId: link.bookPage?.id ?? null,
                  pageActivityId: link.pageActivity?.id ?? null,
                }))
              : [],
        });
        await utils.teachingPrograms.detail.invalidate({ id: stage.id });
        onSaved(savedTitle);
      }}
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
            {mode === "pages" && (
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
                    {matches.length ? (
                      <RangePreview matches={matches} />
                    ) : (
                      "Nenhuma página cadastrada nesse intervalo."
                    )}
                  </div>
                )}
              </>
            )}
            <Field>
              <Label htmlFor="scheduled-instructions">Instruções (opcional)</Label>
              <Textarea
                id="scheduled-instructions"
                name="instructions"
                rows={4}
                maxLength={5000}
                defaultValue={item?.instructions ?? ""}
                placeholder="O que o professor deve orientar durante a atividade?"
              />
            </Field>
          </div>
          <aside className={styles.timePanel}>
            <DurationFields siblings={siblings} item={item} />
          </aside>
          {item && (
            <div>
              {siblings.length ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive-ghost"
                  onClick={() => {
                    setDeleting(true);
                    requestAnimationFrame(() =>
                      form.current?.querySelector<HTMLInputElement>("input")?.focus(),
                    );
                  }}
                >
                  Excluir atividade
                </Button>
              ) : (
                <p className={styles.meta}>
                  Para excluir esta atividade, adicione outra à hora-aula.
                </p>
              )}
            </div>
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
  const groups = Map.groupBy(matches, (match) => match.lessonId);
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
              .filter((row) => row.page.activities.length)
              .map(({ page }) => (
                <p key={page.id}>
                  Pág. {page.number} · {page.activities.map((a) => a.title).join(", ")}
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
        String(deleting && siblings.length === 1 ? 60 : activity.durationMinutes),
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
