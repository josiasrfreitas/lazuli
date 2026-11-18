"use client";
import { useState, type ReactElement } from "react";
import { Check, ChevronDown, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import {
  Button,
  Field,
  FieldError,
  FormRow,
  FormSection,
  Input,
  Label,
  SearchSelect,
} from "@lazuli/ui";
import { SchoolLocationMap } from "./location-map";
import { useSchoolAddressSearch } from "./location-search";
import { numericValue, type Values } from "./settings-values";
import type { SettingsModel } from "./settings-model";
import styles from "./settings.module.css";

const RADIUS_PRESETS = [50, 100, 200];
const MIN_RADIUS = 10;
const MAX_RADIUS = 1000;
const LABELS: Record<Exclude<keyof Values, "addressLabel">, string> = {
  latitude: "Latitude",
  longitude: "Longitude",
  radiusMeters: "Raio",
  maxAccuracyMeters: "Precisão GPS",
};
const PLACEHOLDERS: Record<Exclude<keyof Values, "addressLabel">, string> = {
  latitude: "Ex.: -9,6000",
  longitude: "Ex.: -35,7500",
  radiusMeters: "Ex.: 100",
  maxAccuracyMeters: "Ex.: 50",
};

export function AttendanceSettingsForm({ model }: { model: SettingsModel }): ReactElement {
  const search = useSchoolAddressSearch({
    label: model.fields.addressLabel,
    onSelect: model.setPoint,
    onClear: model.clearPoint,
  });
  const busy = model.save.isPending || model.locating || search.resolving;
  const value = numericValue(model.fields.radiusMeters);
  const radius =
    Number.isInteger(value) && value >= MIN_RADIUS && value <= MAX_RADIUS ? value : null;
  return (
    <form
      ref={model.formRef}
      className={styles.workspace}
      noValidate
      aria-label="Localização da escola"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) model.submit();
      }}
    >
      <div className={styles.controls}>
        <header className={styles.introduction}>
          <div className={styles.titleIcon}>
            <MapPin aria-hidden="true" />
          </div>
          <h2>Localização da escola</h2>
        </header>
        <FormSection title="Endereço da escola">
          <div className={styles.searchRow}>
            <Field name="schoolAddress">
              <Label className="sr-only">Buscar endereço da escola</Label>
              <SearchSelect
                size="sm"
                name="schoolAddress"
                placeholder="Rua, número e cidade"
                showSearchIcon
                value={search.selected}
                query={search.query}
                options={search.options}
                onQueryChange={search.change}
                onSelect={(option) => void search.select(option)}
                onClear={search.clear}
                minQueryLength={3}
                loading={search.loading}
                failed={search.failed}
                disabled={busy}
                invalid={Boolean(model.errors.latitude)}
                emptyMessage="Nenhum endereço encontrado. Tente incluir a cidade."
              />
              <FieldError match={Boolean(search.error || model.errors.latitude)}>
                {search.error || model.errors.latitude}
              </FieldError>
            </Field>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Usar localização atual"
              title={model.locating ? "Localizando…" : "Usar localização atual"}
              disabled={busy}
              onClick={() => void model.locate()}
            >
              <LocateFixed aria-hidden="true" />
            </Button>
          </div>
          {model.point && (
            <div className={styles.selectedAddress}>
              <Check aria-hidden="true" />
              <p>{model.fields.addressLabel || "Ponto definido no mapa"}</p>
            </div>
          )}
          {model.locationError && (
            <p role="alert" className="text-caption text-destructive">
              {model.locationError}
            </p>
          )}
        </FormSection>
        <FormSection title="Área de presença">
          <div className={styles.areaFields}>
            <SettingInput model={model} name="radiusMeters" disabled={busy} unit="m" />
            <SettingInput model={model} name="maxAccuracyMeters" disabled={busy} unit="m" />
          </div>
          <div className={styles.presets} aria-label="Sugestões de raio">
            {RADIUS_PRESETS.map((preset) => (
              <Button
                type="button"
                variant={radius === preset ? "secondary" : "ghost"}
                aria-pressed={radius === preset}
                size="sm"
                key={preset}
                disabled={busy}
                onClick={() => model.change("radiusMeters", String(preset))}
              >
                {preset} m
              </Button>
            ))}
          </div>
          <p className="text-caption text-muted-foreground">
            Precisão GPS: margem de erro aceita na localização do aluno.
          </p>
        </FormSection>
        <AdvancedSettings model={model} disabled={busy} />
        <div className={styles.applicationNote}>
          <ShieldCheck aria-hidden="true" />
          <p>Novos links presenciais usam esta área.</p>
        </div>
      </div>
      <SchoolLocationMap
        point={model.point}
        radius={radius}
        disabled={busy}
        onPoint={model.setPoint}
        focusVersion={model.mapFocusVersion}
      />
      <footer className={styles.footer}>
        <div className={styles.feedback} aria-live="polite">
          {model.save.error ? (
            <p role="alert" className="text-caption text-destructive">
              {model.save.error.message}
            </p>
          ) : (
            <SaveFeedback model={model} />
          )}
        </div>
        <div className={styles.footerActions}>
          {model.dirty && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={model.reset}>
              Descartar alterações
            </Button>
          )}
          <Button type="submit" size="sm" disabled={busy || !model.dirty}>
            {model.save.isPending ? "Salvando…" : "Salvar localização"}
          </Button>
        </div>
      </footer>
    </form>
  );
}

function SaveFeedback({ model }: { model: SettingsModel }): ReactElement {
  if (model.save.isSuccess)
    return (
      <p className="text-caption text-success">
        <Check aria-hidden="true" />
        Localização salva.
      </p>
    );
  return (
    <p className="text-caption text-muted-foreground">
      {model.dirty
        ? "Alterações ainda não salvas"
        : "Ajuste o ponto e confira a área antes de salvar."}
    </p>
  );
}

function AdvancedSettings({
  model,
  disabled,
}: {
  model: SettingsModel;
  disabled: boolean;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const invalid = Boolean(model.errors.latitude || model.errors.longitude);
  return (
    <details
      className={styles.advanced}
      open={expanded || invalid}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        Opções avançadas
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className={styles.advancedBody}>
        <FormSection title="Coordenadas da entrada">
          <FormRow>
            <SettingInput model={model} name="latitude" disabled={disabled} />
            <SettingInput model={model} name="longitude" disabled={disabled} />
          </FormRow>
        </FormSection>
      </div>
    </details>
  );
}

function SettingInput({
  model,
  name,
  disabled,
  unit,
}: {
  model: SettingsModel;
  name: Exclude<keyof Values, "addressLabel">;
  disabled: boolean;
  unit?: string;
}): ReactElement {
  return (
    <Field name={name}>
      <Label htmlFor={`school-${name}`}>
        {LABELS[name]}
        {unit && <span className="text-muted-foreground"> ({unit})</span>}
      </Label>
      <Input
        id={`school-${name}`}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        size="sm"
        required
        disabled={disabled}
        placeholder={PLACEHOLDERS[name]}
        value={model.fields[name]}
        invalid={Boolean(model.errors[name])}
        onChange={(event) => model.change(name, event.target.value)}
      />
      <FieldError match={Boolean(model.errors[name])}>{model.errors[name]}</FieldError>
    </Field>
  );
}
