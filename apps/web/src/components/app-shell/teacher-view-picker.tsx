"use client";

import { useState, type ReactElement } from "react";
import { Button, Input, Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

export function TeacherViewPicker(): ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const profiles = trpc.teacherWorkspace.viewProfiles.useQuery(undefined, { enabled: open });
  const names = profiles.data?.filter(({ name }) =>
    name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setSearch("");
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" className="w-full justify-start" />}>
        Ver como professor
      </PopoverTrigger>
      <PopoverContent align="end" size="menu">
        <PopoverTitle>Ver como professor</PopoverTitle>
        <Input
          aria-label="Buscar professor"
          placeholder="Buscar professor"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-64 overflow-y-auto">
          {profiles.isError ? (
            <p role="alert">Não foi possível carregar os professores.</p>
          ) : profiles.isPending ? (
            <p role="status">Carregando professores…</p>
          ) : !names?.length ? (
            <p role="status">Nenhum professor encontrado.</p>
          ) : (
            names.map(({ id, name }) => (
              <a
                key={id}
                className="block px-2 py-2 hover:bg-muted"
                href={`/professor?docente=${id}`}
              >
                {name}
              </a>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
