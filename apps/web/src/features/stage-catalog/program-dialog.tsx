"use client";
import styles from "./workspace.module.css";
import { DEFAULT_TEACHING_MODALITY } from "@lazuli/domain";
import { useState } from "react";
import type { RouterInputs } from "@lazuli/api";
import { FormSection } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { Choice, EditorForm, TextField, formText } from "./editor-form";
import { stageContext } from "./labels";
import type { StageDetail, ProgramUnit } from "./types";

export type ProgramDialogState =
  | { action: "start" }
  | { action: "unit"; programId: string }
  | { action: "renameUnit" | "hour"; programId: string; unit: ProgramUnit };
export function ProgramDialog({
  stage,
  item,
  onClose,
  onSave,
}: {
  stage: StageDetail;
  item: ProgramDialogState;
  onClose: () => void;
  onSave: (id: string) => void;
}): React.JSX.Element {
  const mutation = trpc.teachingPrograms.editProgram.useMutation();
  const utils = trpc.useUtils();
  const starting = item.action === "start";
  const headings = {
    start: "Iniciar programação",
    unit: "Adicionar unidade",
    renameUnit: "Editar unidade",
    hour: "Nova hora-aula",
  };
  return (
    <EditorForm
      title={headings[item.action]}
      description={stageContext(
        stage,
        "programId" in item
          ? stage.programs.find((program) => program.id === item.programId)
          : undefined,
      )}
      saveLabel={
        starting ? "Criar programação" : item.action === "hour" ? "Criar hora-aula" : "Salvar"
      }
      onClose={onClose}
      onSave={async (data) => {
        const result = await mutation.mutateAsync(programInput({ stageId: stage.id, item }, data));
        await utils.teachingPrograms.invalidate();
        onSave(result.id);
      }}
    >
      <ProgramFields item={item} stage={stage} />
    </EditorForm>
  );
}

function programInput(
  { stageId, item }: { stageId: string; item: ProgramDialogState },
  data: FormData,
): RouterInputs["teachingPrograms"]["editProgram"] {
  const unitTitle = formText(data, "unitTitle"),
    assessmentTitle = formText(data, "assessment");
  switch (item.action) {
    case "start": {
      return {
        action: "start",
        stageId,
        unitTitle,
        assessmentTitle,
        scheduleType: formText(data, "schedule") === "PERSONALIZED" ? "PERSONALIZED" : "REGULAR",
      };
    }
    case "unit": {
      return { action: "unit", stageId, programId: item.programId, unitTitle, assessmentTitle };
    }
    case "renameUnit": {
      return {
        action: "renameUnit",
        stageId,
        programId: item.programId,
        unitId: item.unit.id,
        title: unitTitle,
      };
    }
    case "hour": {
      return {
        action: "hour",
        stageId,
        programId: item.programId,
        unitId: formText(data, "unitId") || item.unit.id,
        title: formText(data, "title"),
        lessonId: formText(data, "lesson") || null,
      };
    }
  }
}
export function ProgramFields({
  item,
  stage,
}: {
  item: ProgramDialogState;
  stage: StageDetail;
}): React.JSX.Element {
  const starting = item.action === "start";
  const addingUnit = starting || item.action === "unit";
  return (
    <>
      {starting && <ScheduleField stage={stage} />}
      {(addingUnit || item.action === "renameUnit") && (
        <TextField
          label={starting ? "Primeira unidade" : "Nome da unidade"}
          name="unitTitle"
          placeholder="Ex.: Unidade 1"
          defaultValue={item.action === "renameUnit" ? item.unit.title : undefined}
          required
          maxLength={180}
        />
      )}
      {addingUnit && (
        <FormSection
          title="Encerramento da unidade"
          description="A prova do livro ocupa a última hora-aula. Você pode distribuir as lições antes dela e ampliar a duração da prova."
        >
          <TextField
            label="Título da prova"
            name="assessment"
            placeholder="Ex.: Prova da unidade 1"
            required
            maxLength={180}
          />
        </FormSection>
      )}
      {item.action === "hour" && <HourFields unit={item.unit} stage={stage} />}
    </>
  );
}

function HourFields({
  unit: initialUnit,
  stage,
}: {
  unit: ProgramUnit;
  stage: StageDetail;
}): React.JSX.Element {
  const units = stage.programs.find((program) =>
    program.units.some((unit) => unit.id === initialUnit.id),
  )?.units ?? [initialUnit];
  const [unitId, setUnitId] = useState(initialUnit.id);
  const unit = units.find((entry) => entry.id === unitId) ?? initialUnit;
  const [type, setType] = useState(stage.lessons.length > 0 ? "lesson" : "assessment");
  const [lesson, setLesson] = useState(stage.lessons[0]?.id ?? "");
  return (
    <>
      <div className="grid grid-cols-2 items-start gap-3">
        <Choice
          name="unitId"
          label="Unidade"
          value={unitId}
          onChange={setUnitId}
          options={units.map((entry) => ({ value: entry.id, label: entry.title }))}
        />
        <Choice
          label="Conteúdo da hora"
          value={type}
          onChange={setType}
          options={[
            ...(stage.lessons.length > 0 ? [{ value: "lesson", label: "Lição do livro" }] : []),
            { value: "assessment", label: "Prova" },
          ]}
        />
      </div>
      {type === "lesson" && (
        <Choice
          name="lesson"
          label="Lição"
          value={lesson}
          onChange={setLesson}
          options={stage.lessons.map((bookLesson) => ({
            value: bookLesson.id,
            label: bookLesson.title,
          }))}
        />
      )}
      <TextField
        key={type + lesson}
        label="Atividade prevista"
        name="title"
        placeholder="Título no livro"
        required
        maxLength={180}
        defaultValue={hourTitle({ stage, lesson, type, unit })}
      />
      <p className={styles.meta}>
        A unidade passa de {unit.teachingHours.length} h para {unit.teachingHours.length + 1} h.{" "}
        {type === "lesson"
          ? "A nova hora entra antes da prova."
          : "A nova hora será usada para a prova."}
      </p>
    </>
  );
}

function ScheduleField({ stage }: { stage: StageDetail }): React.JSX.Element {
  const formats = [
    { value: "REGULAR", label: "Regular" },
    { value: "PERSONALIZED", label: "PPT" },
  ].filter(
    (option) =>
      !stage.programs.some(
        (program) =>
          program.scheduleType === option.value &&
          program.modality.weeklyMinutes === DEFAULT_TEACHING_MODALITY.weeklyMinutes,
      ),
  );
  const [schedule, setSchedule] = useState(formats[0]?.value ?? "REGULAR");
  return (
    <Choice
      name="schedule"
      label="Programação do livro"
      options={formats}
      value={schedule}
      onChange={setSchedule}
    />
  );
}

function hourTitle({
  stage,
  lesson,
  type,
  unit,
}: {
  stage: StageDetail;
  lesson: string;
  type: string;
  unit: ProgramUnit;
}): string | undefined {
  return type === "lesson"
    ? stage.lessons.find((bookLesson) => bookLesson.id === lesson)?.title
    : unit.teachingHours.at(-1)?.activities.at(-1)?.assessment?.title;
}
