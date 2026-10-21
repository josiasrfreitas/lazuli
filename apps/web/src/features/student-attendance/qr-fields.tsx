import type { ReactElement } from "react";
import { Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { ONLINE_WINDOW_MINUTES } from "@lazuli/validators";
type Minutes = (typeof ONLINE_WINDOW_MINUTES)[number];
type Props = {
  minutes: Minutes;
  change: (value: Minutes) => void;
  active: boolean;
  format: "IN_PERSON" | "ONLINE";
  submit: () => void;
};
export function QrWindowForm({ minutes, change, active, format, submit }: Props): ReactElement {
  return (
    <form
      id="open-attendance-link"
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {format === "ONLINE" ? (
        <Field>
          <Label>Receber envios por</Label>
          <SegmentedControl
            value={String(minutes)}
            aria-label="Validade do link"
            onValueChange={(value) => {
              const next = ONLINE_WINDOW_MINUTES.find((item) => String(item) === value);
              if (next !== undefined) change(next);
            }}
          >
            {ONLINE_WINDOW_MINUTES.map((value) => (
              <SegmentedControlItem key={value} value={String(value)}>
                {value} min
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </Field>
      ) : (
        <p className="text-sm font-medium">Cada QR presencial recebe envios por 5 minutos.</p>
      )}
      <p className="text-caption text-muted-foreground">
        O recebimento termina, no máximo, no fim da aula.{" "}
        {active && "Gerar outro link encerra o anterior e preserva os envios já recebidos."}
      </p>
      {format === "IN_PERSON" && (
        <p className="text-caption text-muted-foreground">
          O aluno precisa permitir a localização e estar dentro da área da escola. Quem não
          conseguir pode entrar na chamada manual.
        </p>
      )}
    </form>
  );
}
