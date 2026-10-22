"use client";

import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { StudentAttendanceFrame } from "./student-frame";
import { Button } from "@lazuli/ui";
import { matchAttendanceNames } from "@lazuli/domain";
import { StudentNameField, StudentNameChoices } from "./student-fields";
import { StudentReceipt } from "./receipt";

const PREVIEW_LIFETIME_MINUTES = 20;
const MIN_NAME_SEARCH_LENGTH = 3;

const MILLISECONDS_PER_MINUTE = 60_000;

export function StudentAttendancePreview(): ReactJSX.Element {
  const [expiresAt] = useState(
    () => new Date(Date.now() + PREVIEW_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE),
  );
  const info = {
    sessionId: "00000000-0000-4000-8000-000000000001",
    className: "Essentials 1",
    date: "2026-10-20",
    startTime: "10:00",
    endTime: "11:00",
    format: "ONLINE" as const,
    expiresAt,
  };
  return (
    <StudentAttendanceFrame lesson={info}>
      <PreviewDeclaration />
    </StudentAttendanceFrame>
  );
}

function PreviewDeclaration(): ReactJSX.Element {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [receipt, setReceipt] = useState<Date | null>(null);
  const matches = matchAttendanceNames(
    [{ id: "00000000-0000-4000-8000-000000000002", name: "Ana Beatriz Martins", phone: null }],
    name,
  );
  const selection = selected || matches.exactId || "";
  const canSubmit = matches.options.some(
    (person) => person.id === selection && !person.manualRequired,
  );
  if (receipt)
    return (
      <PreviewReceipt
        receipt={receipt}
        onReset={() => {
          setReceipt(null);
          setName("");
          setSelected("");
        }}
      />
    );
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) submitPreview(setReceipt);
      }}
    >
      <PreviewNameFields
        name={name}
        matches={matches}
        selection={selection}
        onName={setName}
        onSelection={setSelected}
      />
      <Button type="submit" disabled={!canSubmit}>
        Enviar minha presença
      </Button>
      <p className="text-caption text-muted-foreground">
        Prévia: nenhum registro real será enviado.
      </p>
    </form>
  );
}

function PreviewNameFields({
  name,
  matches,
  selection,
  onName,
  onSelection,
}: {
  name: string;
  matches: ReturnType<typeof matchAttendanceNames>;
  selection: string;
  onName: (value: string) => void;
  onSelection: (value: string) => void;
}): ReactJSX.Element {
  return (
    <>
      <StudentNameField
        name={name}
        change={(value) => {
          onName(value);
          onSelection("");
        }}
        error={null}
        disabled={false}
        hint="Digite pelo menos três letras. A busca é automática."
      />
      {name.trim().length >= MIN_NAME_SEARCH_LENGTH && (
        <StudentNameChoices
          matches={matches}
          selected={selection}
          select={onSelection}
          disabled={false}
        />
      )}
    </>
  );
}

function submitPreview(setReceipt: (date: Date) => void): void {
  setReceipt(new Date());
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("lazuli-attendance-preview");
  channel.postMessage("ana-present");
  channel.close();
}

function PreviewReceipt({
  receipt,
  onReset,
}: {
  receipt: Date;
  onReset: () => void;
}): ReactJSX.Element {
  return (
    <div className="grid gap-4">
      <StudentReceipt receipt={{ name: "Ana Beatriz Martins", submittedAt: receipt }} />
      <Button variant="secondary" onClick={onReset}>
        Ver novamente
      </Button>
    </div>
  );
}
