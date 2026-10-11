"use client";
import { useState, type ReactElement } from "react";
import { Button, Field, Label, SearchSelect, type SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

export function StudentLink({
  studentId,
  name,
  onChange,
}: {
  studentId: string | null;
  name: string;
  onChange: (id: string | null) => void;
}): ReactElement {
  const [open, setOpen] = useState(Boolean(studentId));
  const [search, setSearch] = useState(name);
  const [selected, setSelected] = useState<SearchSelectOption | null>(
    studentId ? { id: studentId, label: name } : null,
  );
  const results = trpc.students.search.useQuery(
    { query: search || name || " " },
    { enabled: open && Boolean(search.trim() || name.trim()) },
  );
  if (!open)
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Vincular um aluno já cadastrado
      </Button>
    );
  return (
    <Field>
      <Label>Cadastro existente (opcional)</Label>
      <SearchSelect
        name="studentId"
        placeholder="Buscar aluno por nome ou documento"
        query={search}
        value={selected}
        options={(results.data ?? []).map((row) => ({ id: row.id, label: row.fullName }))}
        loading={results.isFetching}
        failed={results.isError}
        onQueryChange={setSearch}
        onSelect={(row) => {
          setSelected(row);
          onChange(row.id);
        }}
        onClear={() => {
          setSelected(null);
          onChange(null);
        }}
        openOnFocus
      />
      <p className="text-caption text-muted-foreground">
        O vínculo aproveita o cadastro na matrícula.
      </p>
    </Field>
  );
}
