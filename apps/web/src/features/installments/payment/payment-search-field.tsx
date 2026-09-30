import type { ReactElement } from "react";
import { Search } from "lucide-react";
import { Field, Input, Label } from "@lazuli/ui";

export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <Field>
      <Label className="sr-only">Buscar por pagador ou aluno</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          name="search"
          autoComplete="off"
          placeholder="Nome do pagador ou aluno"
          size="sm"
          className="h-11 pl-9 text-base sm:h-control-sm sm:text-control"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Field>
  );
}
