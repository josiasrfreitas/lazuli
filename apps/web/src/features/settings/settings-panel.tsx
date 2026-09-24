"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";

import { Button } from "@lazuli/ui";

import { SettingsSections } from "./settings-fields";
import { SettingsForm, type SettingsMutation } from "./settings-form";
import { loadedFields, type SettingsRow } from "./settings-model";

function UpdateCredit({ row }: { row: SettingsRow | null }): ReactElement {
  if (row === null) return <p>Ainda não configurado.</p>;
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(row.updatedAt);
  return (
    <p>
      Atualizado em {date}
      <br />
      por {row.updatedByName ?? "autor desconhecido"}.
    </p>
  );
}

type SettingsPanelProps = {
  row: SettingsRow | null;
  mutation: SettingsMutation;
};

export function SettingsPanel({ row, mutation }: SettingsPanelProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const hasEdited = useRef(false);
  useEffect(() => {
    if (!editing && hasEdited.current) editRef.current?.focus();
  }, [editing]);
  return (
    <div className="rounded-md border border-border bg-card">
      {editing ? (
        <SettingsForm
          row={row}
          mutation={mutation}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
        />
      ) : (
        <>
          <SettingsSections fields={loadedFields(row)} readOnly />
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div className="text-caption text-muted-foreground">
              {saved && <p role="status">Ajustes salvos.</p>}
              <UpdateCredit row={row} />
            </div>
            <Button
              ref={editRef}
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11 sm:min-h-0"
              onClick={() => {
                hasEdited.current = true;
                setSaved(false);
                setEditing(true);
              }}
            >
              {row === null ? "Configurar" : "Editar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
