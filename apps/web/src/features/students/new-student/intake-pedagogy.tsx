import type { JSX as ReactJSX } from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, ArrowUpRight } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Button, EmptyState } from "@lazuli/ui";
import { InterestChoice } from "~/features/admissions/candidate-fields";
import { IntakeStageSelect } from "~/features/admissions/intake-fields";
import { IntakeClasses } from "./intake-classes";
import type { LeadRegistration } from "~/features/admissions/lead-capture-dialog";

export type IntakeFilters = {
  stageId: string | null;
  format: "IN_PERSON" | "ONLINE";
  scheduleType: "REGULAR" | "PERSONALIZED";
};

type Props = {
  draftRegistration?: LeadRegistration | null | undefined;
  filters: IntakeFilters;
  onFiltersChange: (filters: IntakeFilters) => void;
  lead:
    | Pick<RouterOutputs["admissions"]["byId"], "id" | "englishExperience" | "stageId">
    | undefined;
  enrollment: RouterOutputs["students"]["pendingActions"]["enrollment"] | undefined;
  classes: ComponentProps<typeof IntakeClasses>;
  onCaptureLead: (() => void) | undefined;
};

export function IntakePedagogy({
  filters,
  onFiltersChange,
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
    <>
      <IntakeFilterPanel
        filters={filters}
        onFiltersChange={onFiltersChange}
        lead={lead}
        draftRegistration={draftRegistration}
        onCaptureLead={onCaptureLead}
        waitingPlacement={waitingPlacement}
      />
      <IntakeClassChoices
        filters={filters}
        classes={classes}
        waitingPlacement={waitingPlacement}
        lead={lead}
        draftRegistration={draftRegistration}
        onCaptureLead={onCaptureLead}
      />
    </>
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

function IntakeFilterPanel({
  filters,
  onFiltersChange,
  lead,
  draftRegistration,
  onCaptureLead,
  waitingPlacement,
}: Pick<Props, "filters" | "onFiltersChange" | "lead" | "draftRegistration" | "onCaptureLead"> & {
  waitingPlacement: boolean;
}): ReactJSX.Element {
  return (
    <div className="grid shrink-0 gap-2 border-b border-border pb-3">
      <IntakeFilterFields
        filters={filters}
        onFiltersChange={onFiltersChange}
        lead={lead}
        waitingPlacement={waitingPlacement}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-caption text-muted-foreground">
          Regular: início do semestre · PPT: entrada durante o período.
        </p>
        {onCaptureLead && (
          <Button variant="ghost" size="sm" onClick={onCaptureLead}>
            {draftRegistration
              ? "Editar lead e nivelamento em rascunho"
              : "Já estudou inglês? Cadastrar lead para nivelamento"}
          </Button>
        )}
      </div>
    </div>
  );
}

function IntakeFilterFields({
  filters,
  onFiltersChange,
  lead,
  waitingPlacement,
}: Pick<Props, "filters" | "onFiltersChange" | "lead"> & {
  waitingPlacement: boolean;
}): ReactJSX.Element {
  const change = (patch: Partial<IntakeFilters>): void => onFiltersChange({ ...filters, ...patch });
  return (
    <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[auto_auto_minmax(12rem,1fr)]">
      <InterestChoice
        label="Modalidade"
        value={filters.scheduleType}
        options={{ REGULAR: "Regular", PERSONALIZED: "PPT" }}
        onChange={(value) => change({ scheduleType: value as IntakeFilters["scheduleType"] })}
      />
      <InterestChoice
        label="Formato"
        value={filters.format}
        options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
        onChange={(value) => change({ format: value as IntakeFilters["format"] })}
      />
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <IntakeStageSelect
          value={filters.stageId}
          onChange={(stageId) => change({ stageId })}
          initialOnly={!lead || lead.englishExperience === "NONE"}
          disabled={waitingPlacement || lead?.englishExperience === "SOME"}
        />
      </div>
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
  if (!waitingPlacement && filters.stageId)
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
