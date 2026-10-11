import type { ReactElement } from "react";
import { Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
export function QrWindowForm({
  minutes,
  change,
  active,
  format,
  submit,
}: {
  minutes: 10 | 20 | 30;
  change: (value: 10 | 20 | 30) => void;
  active: boolean;
  format: "IN_PERSON" | "ONLINE";
  submit: () => void;
}): ReactElement {
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
      <Field>
        <Label>Receber envios por</Label>
        <SegmentedControl
          value={String(minutes)}
          onValueChange={(value) => {
            if (value === "10" || value === "20" || value === "30")
              change(Number(value) as 10 | 20 | 30);
          }}
          aria-label="Validade do link"
        >
          {[10, 20, 30].map((value) => (
            <SegmentedControlItem id={`qr-duration-${value}`} key={value} value={String(value)}>
              {value} min
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Field>
      <p className="text-caption text-muted-foreground">
        O recebimento termina, no máximo, no fim da aula.
        {active ? " Gerar outro link encerra o anterior e preserva os envios já recebidos." : ""}
      </p>
      {format === "IN_PERSON" && (
        <p className="text-caption text-muted-foreground">
          Se você permitir, sua localização será a referência para conferir a distância dos envios.
        </p>
      )}
    </form>
  );
}
