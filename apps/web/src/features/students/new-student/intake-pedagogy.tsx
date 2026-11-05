import { useState, type JSX as ReactJSX } from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, ArrowUpRight, BookOpen, UserRound } from "lucide-react";
import { normalizeSearch } from "@lazuli/domain";
import type { RouterOutputs } from "@lazuli/api";
import {
  Button,
  EmptyState,
  Field,
  Label,
  SearchSelect,
  type SearchSelectOption,
} from "@lazuli/ui";
import { InterestChoice } from "~/features/admissions/candidate-fields";
import { IntakeStageSelect } from "~/features/admissions/intake-fields";
import { IntakeClasses } from "./intake-classes";
import type { LeadRegistration } from "~/features/admissions/lead-capture-dialog";

export type IntakeFilters = {
  stageId: string | null;
  format: "IN_PERSON" | "ONLINE";
  scheduleType: "REGULAR" | "PERSONALIZED";
  entryPeriod: "CURRENT" | "NEXT";
};

type Props = {
  draftRegistration?: LeadRegistration | null | undefined;
  filters: IntakeFilters;
  lead:
    | Pick<RouterOutputs["admissions"]["byId"], "id" | "englishExperience" | "stageId">
    | undefined;
  enrollment: RouterOutputs["students"]["pendingActions"]["enrollment"] | undefined;
  classes: ComponentProps<typeof IntakeClasses>;
  onCaptureLead: (() => void) | undefined;
};

export function IntakePedagogy({
  filters,
  lead,
  enrollment,
  classes,
  onCaptureLead,
  draftRegistration,
}: Props): ReactJSX.Element {
  const waitingPlacement =
    draftRegistration?.lead.englishExperience === "SOME" ||
    (lead?.englishExperience === "SOME" && !lead.stageId);
  if (enrollment) return <ExistingEnrollmentSummary enrollment={enrollment} />;
  return (
    <IntakeClassChoices
      filters={filters}
      classes={classes}
      waitingPlacement={waitingPlacement}
      lead={lead}
      draftRegistration={draftRegistration}
      onCaptureLead={onCaptureLead}
    />
  );
}

function ExistingEnrollmentSummary({
  enrollment,
}: {
  enrollment: NonNullable<Props["enrollment"]>;
}): ReactJSX.Element {
  return (
    <section className="grid gap-2 rounded-lg border border-border p-5">
      <h2 className="font-display text-xl font-medium">{enrollment.class.portalClassName}</h2>
      <p className="text-sm">
        {enrollment.class.format === "ONLINE" ? "Online" : "Presencial"} ·{" "}
        {enrollment.class.sharedStage?.name ?? "PPT"}
      </p>
      <p className="text-caption text-muted-foreground">A turma deste aluno já está definida.</p>
    </section>
  );
}

type ControlsProps = Pick<Props, "filters" | "lead" | "draftRegistration" | "onCaptureLead"> & {
  onFiltersChange: (filters: IntakeFilters) => void;
  teacherSelection: SearchSelectOption | null;
  teacherChoices: RouterOutputs["students"]["intakeOptions"]["classes"];
  onTeacherChange: (teacher: SearchSelectOption | null) => void;
};

export function IntakePedagogyControls({
  filters,
  onFiltersChange,
  lead,
  draftRegistration,
  onCaptureLead,
  teacherSelection,
  teacherChoices,
  onTeacherChange,
}: ControlsProps): ReactJSX.Element {
  const waitingPlacement =
    draftRegistration?.lead.englishExperience === "SOME" ||
    (lead?.englishExperience === "SOME" && !lead.stageId);
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
      <div className="w-44 min-w-0 shrink-0">
        <IntakeStageSelect
          value={filters.stageId}
          onChange={(stageId) => onFiltersChange({ ...filters, stageId })}
          initialOnly={!lead || lead.englishExperience === "NONE"}
          disabled={waitingPlacement || lead?.englishExperience === "SOME"}
          labelIcon={<BookOpen className="size-4" aria-hidden="true" />}
        />
      </div>
      <TeacherSearch value={teacherSelection} choices={teacherChoices} onChange={onTeacherChange} />
      <IntakeFilterFields filters={filters} onFiltersChange={onFiltersChange} />
      {onCaptureLead && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCaptureLead}
          aria-label={
            draftRegistration ? "Revisar lead e nivelamento" : "Cadastrar lead para nivelamento"
          }
          title={draftRegistration ? "Revisar nivelamento" : "Cadastrar lead para nivelamento"}
        >
          <ClipboardCheck aria-hidden="true" />
          <span className="hidden min-[75rem]:inline">
            {draftRegistration ? "Revisar nivelamento" : "Nivelamento"}
          </span>
        </Button>
      )}
    </div>
  );
}

function IntakeFilterFields({
  filters,
  onFiltersChange,
}: Pick<ControlsProps, "filters" | "onFiltersChange">): ReactJSX.Element {
  const change = (patch: Partial<IntakeFilters>): void => onFiltersChange({ ...filters, ...patch });
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <div className="w-fit shrink-0">
        <InterestChoice
          label="Modalidade"
          value={filters.scheduleType}
          options={{ REGULAR: "Regular", PERSONALIZED: "PPT" }}
          onChange={(value) => change({ scheduleType: value as IntakeFilters["scheduleType"] })}
        />
      </div>
      <div className="w-fit shrink-0">
        <InterestChoice
          label="Formato"
          value={filters.format}
          options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
          onChange={(value) => change({ format: value as IntakeFilters["format"] })}
        />
      </div>
      <div className="w-fit shrink-0">
        <InterestChoice
          label="Entrada"
          value={filters.entryPeriod}
          options={{ CURRENT: "Neste período", NEXT: "Próximo período" }}
          onChange={(value) => change({ entryPeriod: value as IntakeFilters["entryPeriod"] })}
        />
      </div>
    </div>
  );
}

function TeacherSearch({
  value,
  choices,
  onChange,
}: {
  value: SearchSelectOption | null;
  choices: ControlsProps["teacherChoices"];
  onChange: (teacher: SearchSelectOption | null) => void;
}): ReactJSX.Element {
  const [query, setQuery] = useState("");
  const teachers = [
    ...new Map(
      choices
        .filter((choice) => choice.teacherId)
        .map((choice) => [choice.teacherId!, { id: choice.teacherId!, label: choice.teacherName }]),
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const needle = normalizeSearch(query);
  return (
    <div className="w-48 min-w-0 shrink-0">
      <Field>
        <Label>
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-4" aria-hidden="true" /> Professor
          </span>
        </Label>
        <SearchSelect
          name="teacherId"
          placeholder="Buscar professor"
          showSearchIcon
          value={value}
          query={query}
          options={teachers.filter((teacher) => normalizeSearch(teacher.label).includes(needle))}
          onQueryChange={setQuery}
          onSelect={(teacher) => {
            onChange(teacher);
            setQuery("");
          }}
          onClear={() => onChange(null)}
          emptyMessage="Nenhum professor nas turmas disponíveis."
        />
      </Field>
    </div>
  );
}

function PlacementPending({
  lead,
  draftRegistration,
  onCaptureLead,
}: Pick<Props, "lead" | "draftRegistration" | "onCaptureLead">): ReactJSX.Element {
  return (
    <EmptyState
      icon={<ClipboardCheck />}
      title="Vamos concluir o nivelamento"
      description="Aluno registrado já com certa experiência em inglês. Conclua o nivelamento para seguir com o cadastro pedagógico."
      action={
        lead ? (
          <Button
            variant="secondary"
            size="sm"
            nativeButton={false}
            render={<Link href={`/interessados/${lead.id}`} target="_blank" rel="noreferrer" />}
          >
            Ir para o nivelamento <ArrowUpRight aria-hidden="true" />
            <span className="sr-only"> (abre em outra aba)</span>
          </Button>
        ) : (
          <div className="grid justify-items-center gap-3">
            <p className="max-w-sm text-caption text-muted-foreground">
              {draftRegistration?.placement
                ? `A prova será agendada em ${draftRegistration.placement.date.split("-").toReversed().join("/")} às ${draftRegistration.placement.startTime} ao concluir o cadastro.`
                : "Salve o cadastro para concluir o nivelamento."}
            </p>
            {onCaptureLead && (
              <Button variant="secondary" size="sm" onClick={onCaptureLead}>
                Revisar nivelamento
              </Button>
            )}
          </div>
        )
      }
    />
  );
}

function IntakeClassChoices({
  filters,
  classes,
  waitingPlacement,
  lead,
  draftRegistration,
  onCaptureLead,
}: Pick<Props, "filters" | "classes" | "lead" | "draftRegistration" | "onCaptureLead"> & {
  waitingPlacement: boolean;
}): ReactJSX.Element {
  if (filters.entryPeriod === "NEXT" || (!waitingPlacement && filters.stageId))
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <IntakeClasses {...classes} />
      </div>
    );
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        {waitingPlacement ? (
          <PlacementPending
            lead={lead}
            draftRegistration={draftRegistration}
            onCaptureLead={onCaptureLead}
          />
        ) : (
          <EmptyState
            icon={<CalendarDays />}
            title="Vamos encontrar a turma"
            description="Escolha o estágio acima para explorar as turmas e os horários disponíveis."
          />
        )}
      </div>
    </div>
  );
}
