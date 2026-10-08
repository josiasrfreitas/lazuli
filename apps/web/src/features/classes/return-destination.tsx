"use client";

import { useState, type ReactElement } from "react";
import { Field, Label, SearchSelect } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

type Destination = { classId: string; scheduleType: "REGULAR" | "PERSONALIZED" };

export function ReturnDestination({
  value,
  onChange,
}: {
  value: Destination;
  onChange: (value: Destination) => void;
}): ReactElement {
  const [search, setSearch] = useState("");
  const selected = trpc.classes.byId.useQuery(
    { id: value.classId },
    { enabled: Boolean(value.classId) },
  );
  const query = trpc.classes.list.useQuery({ search, statuses: ["ACTIVE"], pageSize: 20 });
  return (
    <Field name="targetClassId">
      <Label>Turma de destino</Label>
      <SearchSelect
        name="targetClassId"
        placeholder="Buscar turma ou professor"
        showSearchIcon
        query={search}
        value={
          selected.data ? { id: selected.data.id, label: selected.data.portalClassName } : null
        }
        options={(query.data?.rows ?? []).map((row) => ({
          id: row.id,
          label: row.portalClassName,
          description: row.teacher.name,
        }))}
        onQueryChange={setSearch}
        onClear={() => {
          onChange({ ...value, classId: "" });
          setSearch("");
        }}
        onSelect={(option) => {
          const row = query.data?.rows.find((item) => item.id === option.id);
          if (row) onChange({ classId: row.id, scheduleType: row.scheduleType });
          setSearch("");
        }}
        loading={query.isFetching}
        failed={query.isError || selected.isError}
        openOnFocus
        emptyMessage="Nenhuma turma encontrada."
      />
    </Field>
  );
}
