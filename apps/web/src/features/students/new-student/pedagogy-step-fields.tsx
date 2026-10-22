import type { JSX as ReactJSX } from "react";
import {
  Button,
  Field,
  FieldError,
  FormRow,
  FormSection,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { SlotFields, type SlotDraft } from "~/features/semester-organization/slot-fields";
import { Choices } from "~/features/semester-organization/shared";
import { FormFieldLoading } from "~/features/pedagogical-follow-up/form-field-loading";

type SemesterOption = { id: string; name: string } | undefined;

export function PedagogyEntryFields({
  current,
  next,
  semesterId,
  semesterError,
  periodsPending,
  periodsFailed,
  format,
  onSemesterChange,
  onFormatChange,
  stage,
}: {
  current: SemesterOption;
  next: SemesterOption;
  semesterId: string;
  semesterError: string;
  periodsPending: boolean;
  periodsFailed: boolean;
  format: "IN_PERSON" | "ONLINE";
  onSemesterChange: (value: string) => void;
  onFormatChange: (value: "IN_PERSON" | "ONLINE") => void;
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
        <Choices
          name="intake-format"
          label="Formato"
          value={format}
          onChange={(value) => onFormatChange(value as "IN_PERSON" | "ONLINE")}
          options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
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
  if (pending) return <FormFieldLoading label="Semestre de entrada" />;
  return (
    <Field name="intake-semester">
      <Label id="intake-semester-label">Semestre de entrada</Label>
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
        <SegmentedControlItem value={next?.id ?? "next"} disabled={!next}>
          Próximo{next ? ` · ${next.name}` : ""}
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
  if ((current && next) || failed) return null;
  return (
    <p className="text-caption text-muted-foreground">
      {semesterAvailabilityMessage(current, next)}
    </p>
  );
}

function semesterAvailabilityMessage(current: SemesterOption, next: SemesterOption): string {
  if (!current && !next) return "Cadastre o semestre de entrada em Organização de turmas.";
  if (next) return "Não há semestre em andamento. A entrada será no próximo.";
  return "O próximo semestre ainda não foi cadastrado.";
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

export function PedagogyAvailability({
  slots,
  onChange,
}: {
  slots: SlotDraft[];
  onChange: (slots: SlotDraft[]) => void;
}): ReactJSX.Element {
  if (slots.length > 0)
    return (
      <>
        <SlotFields slots={slots} onChange={onChange} />
        <Button
          size="sm"
          variant="ghost"
          className="justify-self-start"
          onClick={() => onChange([])}
        >
          Deixar disponibilidade para depois
        </Button>
      </>
    );
  return (
    <div className="flex items-center justify-between gap-3 border-y border-border py-3">
      <p className="text-caption text-muted-foreground">Ainda sem horário combinado.</p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onChange([{ weekday: "MONDAY", startTime: "", endTime: "" }])}
      >
        Informar disponibilidade
      </Button>
    </div>
  );
}
