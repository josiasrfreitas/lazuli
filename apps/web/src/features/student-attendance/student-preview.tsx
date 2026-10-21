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
  if (receipt)
    return (
      <div className="grid gap-4">
        <StudentReceipt receipt={{ name: "Ana Beatriz Martins", submittedAt: receipt }} />
        <Button
          variant="secondary"
          onClick={() => {
            setReceipt(null);
            setName("");
            setSelected("");
          }}
        >
          Ver novamente
        </Button>
      </div>
    );
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!matches.options.some((person) => person.id === selection && !person.manualRequired))
          return;
        setReceipt(new Date());
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("lazuli-attendance-preview");
          channel.postMessage("ana-present");
          channel.close();
        }
      }}
    >
      <StudentNameField
        name={name}
        change={(value) => {
          setName(value);
          setSelected("");
        }}
        error={null}
        disabled={false}
        hint="Digite pelo menos três letras. A busca é automática."
      />
      {name.trim().length >= MIN_NAME_SEARCH_LENGTH && (
        <StudentNameChoices
          matches={matches}
          selected={selection}
          select={setSelected}
          disabled={false}
        />
      )}
      <Button
        type="submit"
        disabled={
          !matches.options.some((person) => person.id === selection && !person.manualRequired)
        }
      >
        Enviar minha presença
      </Button>
      <p className="text-caption text-muted-foreground">
        Prévia: nenhum registro real será enviado.
      </p>
    </form>
  );
}
