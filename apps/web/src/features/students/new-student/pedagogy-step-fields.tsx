import type { JSX as ReactJSX } from "react";
import {
  Field,
  FieldError,
  FormRow,
  FormSection,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { FormFieldLoading } from "~/features/pedagogical-follow-up/form-field-loading";

type SemesterOption = { id: string; name: string } | undefined;

export function PedagogyEntryFields({
  current,
  next,
  semesterId,
  semesterError,
  periodsPending,
  periodsFailed,
  onSemesterChange,
  stage,
}: {
  current: SemesterOption;
  next: SemesterOption;
  semesterId: string;
  semesterError: string;
  periodsPending: boolean;
  periodsFailed: boolean;
  onSemesterChange: (value: string) => void;
  stage: ReactJSX.Element;
}): ReactJSX.Element {
  return (
    <FormSection title="Entrada e percurso">
      <FormRow columns={2}>
        <SemesterField
          current={current}
          next={next}
          semesterId={semesterId}
          semesterError={semesterError}
          pending={periodsPending}
          failed={periodsFailed}
          onChange={onSemesterChange}
        />
      </FormRow>
      {stage}
    </FormSection>
  );
}

function SemesterField({
  current,
  next,
  semesterId,
  semesterError,
  pending,
  failed,
  onChange,
}: {
  current: SemesterOption;
  next: SemesterOption;
  semesterId: string;
  semesterError: string;
  pending: boolean;
  failed: boolean;
  onChange: (value: string) => void;
}): ReactJSX.Element {
  if (pending) return <FormFieldLoading label="Período de entrada" />;
  return (
    <Field name="intake-semester">
      <Label id="intake-semester-label">Período de entrada</Label>
      <SegmentedControl
        size="sm"
        wrap
        value={semesterId || null}
        aria-labelledby="intake-semester-label"
        invalid={Boolean(semesterError)}
        onValueChange={(value) => {
          if (value) onChange(value);
        }}
      >
        <SegmentedControlItem value={current?.id ?? "current"} disabled={!current}>
          Atual{current ? ` · ${current.name}` : ""}
        </SegmentedControlItem>
      </SegmentedControl>
      <FieldError match={Boolean(semesterError)}>{semesterError}</FieldError>
      <SemesterAvailabilityNote current={current} next={next} failed={failed} />
    </Field>
  );
}

function SemesterAvailabilityNote({
  current,
  next,
  failed,
}: {
  current: SemesterOption;
  next: SemesterOption;
  failed: boolean;
}): ReactJSX.Element | null {
  if (failed) return null;
  return (
    <p className="text-caption text-muted-foreground">
      {current
        ? "Para entradas futuras, cadastre um lead e acompanhe o interesse pela turma."
        : "Não há período vigente. Mantenha a pessoa como lead até a entrada."}
    </p>
  );
}

export function PedagogyStageField({
  pending,
  failed,
  query,
  selected,
  hasStage,
  matches,
  onQueryChange,
  onSelect,
  onClear,
}: {
  pending: boolean;
  failed: boolean;
  query: string;
  selected: { id: string; label: string } | null;
  hasStage: boolean;
  matches: { id: string; label: string }[];
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
}): ReactJSX.Element {
  if (pending) return <FormFieldLoading label="Estágio indicado" />;
  return (
    <Field name="intake-stage">
      <Label>Estágio indicado · opcional</Label>
      <SearchSelect
        name="intake-stage"
        placeholder="Buscar por código ou nome do estágio"
        showSearchIcon
        openOnFocus
        query={query}
        value={selected}
        options={matches}
        failed={failed}
        onQueryChange={onQueryChange}
        onSelect={(stage) => onSelect(stage.id)}
        onClear={onClear}
        emptyMessage="Nenhum estágio encontrado."
      />
      {!hasStage && (
        <p className="text-caption text-muted-foreground">Pode ficar para a coordenação definir.</p>
      )}
    </Field>
  );
}
