import type { ReactElement } from "react";
import { Button, Field, FieldError, FormRow, FormSection, Input, Label } from "@lazuli/ui";
import type { SettingsModel, Values } from "./settings-model";
const LABELS: Record<keyof Values, string> = {
  latitude: "Latitude",
  longitude: "Longitude",
  radiusMeters: "Raio aceito (m)",
  maxAccuracyMeters: "Precisão máxima (m)",
};
const PLACEHOLDERS: Record<keyof Values, string> = {
  latitude: "Ex.: -9.6000",
  longitude: "Ex.: -35.7500",
  radiusMeters: "Ex.: 100",
  maxAccuracyMeters: "Ex.: 50",
};
export function AttendanceSettingsForm({ model }: { model: SettingsModel }): ReactElement {
  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        model.submit();
      }}
    >
      <SettingsFields model={model} />
      <Button
        type="button"
        variant="secondary"
        disabled={model.location.pending}
        onClick={() => void model.location.locate()}
      >
        {model.location.pending ? "Localizando…" : "Usar minha localização na escola"}
      </Button>
      {(model.error || model.location.error || model.save.error) && (
        <FieldError match>
          {model.error || model.location.error || model.save.error?.message}
        </FieldError>
      )}
      {model.save.isSuccess && (
        <p role="status" className="text-sm text-success">
          Configuração salva para os próximos links.
        </p>
      )}
      <Button type="submit" disabled={model.save.isPending}>
        {model.save.isPending ? "Salvando…" : "Salvar área da escola"}
      </Button>
    </form>
  );
}
function SettingsFields({ model }: { model: SettingsModel }): ReactElement {
  return (
    <FormSection title="Localização e critérios">
      <FormRow>
        {(Object.keys(LABELS) as (keyof Values)[]).map((name) => (
          <Field key={name} name={name}>
            <Label htmlFor={name}>{LABELS[name]}</Label>
            <Input
              id={name}
              name={name}
              type="number"
              step={name.includes("Meters") ? "1" : "any"}
              autoFocus={name === "latitude"}
              required
              placeholder={PLACEHOLDERS[name]}
              value={model.fields[name]}
              onChange={(event) => model.change(name, event.target.value)}
            />
          </Field>
        ))}
      </FormRow>
    </FormSection>
  );
}
