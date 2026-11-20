"use client";
import styles from "./workspace.module.css";
import { useState } from "react";
import { TEACHING_HOUR_MINUTES } from "@lazuli/domain";
import { Button, FormRow, FormSection } from "@lazuli/ui";
import { Plus, X } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { Choice, EditorForm, TextField, formText } from "./editor-form";
import type { ProgramActivity, StageDetail, TeachingHour } from "./types";

export const activityLabels = {
  LESSON: "Lição",
  INTRODUCTION: "Introdução",
  REVIEW: "Revisão",
  ASSESSMENT: "Prova",
  VIDEO: "Vídeo",
  ACTIVITY: "Atividade",
};
type LinkValue = { key: number; id: string; part: string };
export function ActivityForm({
  stage,
  programId,
  hour,
  position,
  editing,
  close,
}: {
  stage: StageDetail;
  programId: string;
  hour: TeachingHour;
  position: number;
  editing: boolean;
  close: () => void;
}): React.JSX.Element {
  const item = editing ? hour.activities.at(position) : undefined;
  const siblings = hour.activities.filter((activity) => activity.id !== item?.id);
  const utils = trpc.useUtils();
  const mutation = trpc.teachingPrograms.editProgram.useMutation({
    onError: () => utils.teachingPrograms.detail.invalidate({ id: stage.id }),
  });
  const [expectedChange] = useState(hour.lastChange);
  return (
    <EditorForm
      inline
      title={editing ? "Editar atividade" : "Inserir atividade"}
      onClose={close}
      onSave={async (data) => {
        const minutes = Number(formText(data, "minutes"));
        const others = siblings.map((activity) => ({
          id: activity.id,
          minutes: Number(formText(data, "minutes-" + activity.id)),
        }));
        if (minutes + others.reduce((sum, row) => sum + row.minutes, 0) !== TEACHING_HOUR_MINUTES)
          throw new Error("Distribua 60 minutos entre as atividades desta hora-aula.");
        const pages = readPages(data);
        const kind = formText(data, "kind") as ProgramActivity["kind"];
        await mutation.mutateAsync({
          action: "activity",
          stageId: stage.id,
          programId,
          hourId: hour.id,
          expectedChange,
          position,
          activityId: item?.id ?? null,
          kind,
          title: formText(data, "title"),
          durationMinutes: minutes,
          ...pages,
          lessons: readLessonReferences(data),
          others,
        });
        await utils.teachingPrograms.invalidate();
      }}
    >
      <TextField
        autoFocus
        name="title"
        label="Atividade do livro"
        placeholder="Título conforme o livro"
        defaultValue={item?.bookTitle}
        required
        maxLength={180}
      />
      <ActivityTypeFields stage={stage} item={item} />
      <BookPages item={item} />
      <DurationFields siblings={siblings} item={item} />
    </EditorForm>
  );
}

function readPages(data: FormData): Pick<ProgramActivity, "pageStart" | "pageEnd"> {
  const start = formText(data, "pageStart"),
    end = formText(data, "pageEnd");
  if (end && (!start || Number(end) < Number(start)))
    throw new Error("Confira as páginas inicial e final.");
  return { pageStart: start ? Number(start) : null, pageEnd: end ? Number(end) : null };
}
function readLessonReferences(data: FormData): { id: string; part: string }[] {
  const parts = data.getAll("lessonPart");
  return data.getAll("lessonId").flatMap((id, index) => {
    const part = parts.at(index);
    return typeof id === "string"
      ? [{ id, part: typeof part === "string" ? part.trim() : "" }]
      : [];
  });
}
function ActivityTypeFields({
  stage,
  item,
}: {
  stage: StageDetail;
  item: ProgramActivity | undefined;
}): React.JSX.Element {
  const [kind, setKind] = useState<ProgramActivity["kind"]>(item?.kind ?? "ACTIVITY");
  const [links, setLinks] = useState<LinkValue[]>(
    () =>
      item?.lessons.map((lesson, index) => ({
        key: index,
        id: lesson.id,
        part: lesson.part ?? "",
      })) ?? [],
  );
  const addReference = (): void =>
    setLinks((current) => [
      ...current,
      {
        key: Math.max(-1, ...current.map((lesson) => lesson.key)) + 1,
        id:
          stage.lessons.find((lesson) => !current.some((link) => link.id === lesson.id))?.id ??
          stage.lessons[0]?.id ??
          "",
        part: "",
      },
    ]);
  const updateLink = (key: number, patch: Partial<LinkValue>): void =>
    setLinks((current) =>
      current.map((lesson) => (lesson.key === key ? { ...lesson, ...patch } : lesson)),
    );
  return (
    <>
      <Choice
        name="kind"
        label="Tipo de atividade"
        options={Object.entries(activityLabels)
          .filter(([key]) => key !== "LESSON" || stage.lessons.length > 0)
          .map(([value, label]) => ({ value, label }))}
        value={kind}
        onChange={(value) => {
          setKind(value as typeof kind);
          if (value === "LESSON" && links.length === 0) addReference();
        }}
      />
      {kind === "LESSON" && (
        <FormSection title="Referências ao livro">
          {links.map((link) => (
            <LessonReference
              key={link.key}
              link={link}
              stage={stage}
              updateLink={updateLink}
              removable={links.length > 1}
              remove={() => setLinks(links.filter((entry) => entry.key !== link.key))}
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant="text"
            className="justify-self-start"
            onClick={addReference}
          >
            <Plus />
            Associar outra lição
          </Button>
        </FormSection>
      )}
    </>
  );
}
function DurationFields({
  siblings,
  item,
}: {
  siblings: ProgramActivity[];
  item: ProgramActivity | undefined;
}): React.JSX.Element {
  const [minutes, setMinutes] = useState(String(item?.durationMinutes ?? ""));
  const [others, setOthers] = useState(() =>
    Object.fromEntries(siblings.map((activity) => [activity.id, String(activity.durationMinutes)])),
  );
  const total =
    Number(minutes) + Object.values(others).reduce((sum, value) => sum + Number(value), 0);
  return (
    <FormSection
      title="Distribuição da hora-aula"
      action={
        <span aria-live="polite" className={styles.caption}>
          {total} / 60 min
        </span>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
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

function BookPages({ item }: { item: ProgramActivity | undefined }): React.JSX.Element {
  return (
    <FormRow columns={2} className="max-w-xs">
      <TextField
        label="Página inicial (opcional)"
        name="pageStart"
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="Ex.: 18"
        defaultValue={item?.pageStart ?? ""}
      />
      <TextField
        label="Página final (opcional)"
        name="pageEnd"
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="Ex.: 21"
        defaultValue={item?.pageEnd ?? ""}
      />
    </FormRow>
  );
}

function LessonReference({
  link,
  stage,
  updateLink,
  removable,
  remove,
}: {
  link: LinkValue;
  stage: StageDetail;
  updateLink: (key: number, patch: Partial<LinkValue>) => void;
  removable: boolean;
  remove: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Choice
        name="lessonId"
        label="Lição"
        value={link.id}
        onChange={(id) => updateLink(link.key, { id })}
        options={stage.lessons.map((lesson) => ({ value: lesson.id, label: lesson.title }))}
      />
      <TextField
        label="Parte (opcional)"
        className="max-w-24"
        name="lessonPart"
        placeholder="Ex.: A"
        maxLength={80}
        value={link.part}
        onChange={(event) => updateLink(link.key, { part: event.target.value })}
      />
      {removable && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Retirar referência"
          onClick={remove}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
