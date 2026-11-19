"use client";
import { useState } from "react";
import type { RouterInputs } from "@lazuli/api";
import { FormRow, FormSection } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { Choice, EditorForm, TextField, formText } from "./editor-form";
import styles from "./workspace.module.css";
import type { Directory } from "./types";

export type CatalogDialogState =
  | { action: "createTrack"; lines: Directory["productLines"] }
  | { action: "createStage"; trackId: string; trackName: string }
  | { action: "editStage"; id: string; name: string; internalCode: string }
  | { action: "lesson"; stageId: string; lesson?: { id: string; title: string } }
  | { action: "legacy"; target: "track" | "stage"; id: string; name: string };
type CatalogInput = RouterInputs["teachingPrograms"]["editCatalog"];
export function CatalogDialog({
  item,
  onClose,
  afterSave,
}: {
  item: CatalogDialogState;
  onClose: () => void;
  afterSave?: (id: string) => void;
}): React.JSX.Element {
  const utils = trpc.useUtils();
  const mutation = trpc.teachingPrograms.editCatalog.useMutation();
  const headings = {
    createTrack: "Nova track",
    createStage: "Adicionar estágio",
    editStage: "Editar estágio",
    lesson: item.action === "lesson" && item.lesson ? "Editar lição" : "Adicionar lição",
    legacy: "Marcar como Legacy?",
  };
  return (
    <EditorForm
      title={headings[item.action]}
      saveLabel={item.action === "legacy" ? "Marcar como Legacy" : "Salvar"}
      onClose={onClose}
      onSave={async (data) => {
        const result = await mutation.mutateAsync(catalogInput(item, data));
        await Promise.all([utils.teachingPrograms.invalidate(), utils.classes.invalidate()]);
        afterSave?.(result.id);
      }}
    >
      <CatalogFields item={item} />
    </EditorForm>
  );
}

function catalogInput(item: CatalogDialogState, data: FormData): CatalogInput {
  switch (item.action) {
    case "createTrack": {
      return {
        action: item.action,
        name: formText(data, "name"),
        productLineId: formText(data, "line"),
        ageGroup: formText(data, "age") === "CHILD" ? "CHILD" : "ADULT",
      };
    }
    case "createStage": {
      return {
        action: item.action,
        trackId: item.trackId,
        name: formText(data, "name"),
        internalCode: formText(data, "code"),
      };
    }
    case "editStage": {
      return {
        action: item.action,
        id: item.id,
        name: formText(data, "name"),
        internalCode: formText(data, "code"),
      };
    }
    case "lesson": {
      return {
        action: item.action,
        stageId: item.stageId,
        lessonId: item.lesson?.id,
        title: formText(data, "title"),
      };
    }
    case "legacy": {
      return { action: item.action, target: item.target, id: item.id };
    }
  }
}
export function CatalogFields({ item }: { item: CatalogDialogState }): React.JSX.Element {
  switch (item.action) {
    case "createTrack": {
      return <TrackFields lines={item.lines} />;
    }
    case "createStage":
    case "editStage": {
      return <StageIdentification item={item} />;
    }
    case "lesson": {
      return (
        <TextField
          name="title"
          label="Título da lição"
          placeholder="Ex.: Lição 1 · Greetings"
          required
          maxLength={180}
          defaultValue={item.lesson?.title}
        />
      );
    }
    case "legacy": {
      return (
        <p>
          <strong>{item.name}</strong>
          {item.target === "track"
            ? " e todos os estágios desta track sairão das opções para novas turmas."
            : " sairá das opções para novas turmas."}{" "}
          As turmas em andamento continuam com acesso ao material.
        </p>
      );
    }
  }
}

function TrackFields({ lines }: { lines: Directory["productLines"] }): React.JSX.Element {
  const [line, setLine] = useState(lines[0]?.id ?? "");
  const [age, setAge] = useState("ADULT");
  return (
    <>
      <TextField
        name="name"
        label="Nome da track"
        placeholder="Ex.: English Main"
        required
        maxLength={180}
      />
      <Choice
        name="line"
        label="Linha de produto"
        options={lines.map((line) => ({ value: line.id, label: line.name }))}
        value={line}
        onChange={setLine}
      />
      <Choice
        name="age"
        label="Público"
        options={[
          { value: "ADULT", label: "Adulto" },
          { value: "CHILD", label: "Infantil" },
        ]}
        value={age}
        onChange={setAge}
      />
    </>
  );
}

function StageIdentification({
  item,
}: {
  item: Extract<CatalogDialogState, { action: "createStage" | "editStage" }>;
}): React.JSX.Element {
  return (
    <FormSection title={item.action === "createStage" ? item.trackName : "Identificação"}>
      <div className={styles.identification}>
        <FormRow>
          <TextField
            name="name"
            label="Nome do estágio"
            placeholder="Ex.: Essentials 1"
            required
            maxLength={180}
            defaultValue={item.action === "editStage" ? item.name : ""}
          />
          <TextField
            name="code"
            label="Código"
            placeholder="Ex.: E1"
            required
            maxLength={40}
            defaultValue={item.action === "editStage" ? item.internalCode : ""}
          />
        </FormRow>
      </div>
    </FormSection>
  );
}
