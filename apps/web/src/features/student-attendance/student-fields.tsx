import type { ReactElement } from "react";
import { Check, UserRound } from "lucide-react";
import { Button, Field, FieldError, Input, Label } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
type Matches = RouterOutputs["studentAttendance"]["search"];
export function StudentNameField({
  name,
  change,
  error,
  disabled,
}: {
  name: string;
  change: (value: string) => void;
  error: string | null;
  disabled: boolean;
}): ReactElement {
  return (
    <Field>
      <Label htmlFor="student-name">Seu nome</Label>
      <Input
        autoFocus
        id="student-name"
        name="studentName"
        value={name}
        onChange={(event) => change(event.target.value)}
        placeholder="Ex.: Ana Beatriz Martins"
        autoComplete="off"
        size="compact-responsive"
        maxLength={120}
        disabled={disabled}
        invalid={Boolean(error)}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
export function StudentNameChoices({
  matches,
  selected,
  select,
  disabled,
}: {
  matches: Matches;
  selected: string;
  select: (id: string) => void;
  disabled: boolean;
}): ReactElement {
  if (matches.refine)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Há vários nomes parecidos. Digite mais uma parte do seu nome.
      </p>
    );
  if (!matches.options.length)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Seu nome não apareceu nesta turma. Confira o nome e o link com o professor.
      </p>
    );
  return (
    <section className="grid gap-3" aria-label="Escolha seu cadastro">
      <p className="text-sm font-medium">
        {matches.exactId ? "Confira seu nome antes de enviar." : "Qual destes é você?"}
      </p>
      <div className="grid gap-2">
        {matches.options.map((person) => (
          <div key={person.id} className="grid gap-1">
            <Button
              size="compact-responsive"
              type="button"
              variant={person.id === selected ? "secondary" : "ghost"}
              aria-pressed={person.id === selected}
              disabled={disabled || person.manualRequired}
              onClick={() => select(person.id)}
            >
              <UserRound aria-hidden="true" />
              <span className="min-w-0 whitespace-normal text-left">
                {person.name}
                {person.phoneHint ? ` · telefone final ${person.phoneHint}` : ""}
              </span>
              {person.id === selected && <Check aria-hidden="true" />}
            </Button>
            {person.manualRequired && (
              <p className="text-caption text-muted-foreground">
                Há cadastros iguais. Peça ao professor para identificar e registrar sua presença.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
