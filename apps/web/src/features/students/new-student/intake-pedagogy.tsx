import type { ComponentProps } from "react";
import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import { Alert, Button } from "@lazuli/ui";
import { InterestChoice } from "~/features/admissions/candidate-fields";
import { IntakeStageSelect } from "~/features/admissions/intake-fields";
import { IntakeClasses } from "./intake-classes";

export type IntakeFilters = {
  stageId: string | null;
  format: "IN_PERSON" | "ONLINE";
  scheduleType: "REGULAR" | "PERSONALIZED";
};

type Props = {
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
}: Props) {
  const waitingPlacement = lead?.englishExperience === "SOME" && !lead.stageId;
  const change = (patch: Partial<IntakeFilters>) => onFiltersChange({ ...filters, ...patch });
  if (enrollment)
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
  return (
    <>
      <div className="grid shrink-0 gap-2 border-b border-border pb-3">
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
              disabled={lead?.englishExperience === "SOME"}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-caption text-muted-foreground">
            Regular: início do semestre · PPT: entrada durante o período.
          </p>
          {onCaptureLead && (
            <Button variant="ghost" size="sm" onClick={onCaptureLead}>
              Já estudou inglês? Cadastrar lead para nivelamento
            </Button>
          )}
        </div>
        {waitingPlacement && (
          <Alert variant="warning">
            O estágio depende da prova. Você pode seguir para o contrato e resolver o nivelamento
            depois.{" "}
            <Link
              className="underline"
              href={`/interessados/${lead.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir nivelamento em outra aba
            </Link>
          </Alert>
        )}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {waitingPlacement ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-caption text-muted-foreground">
            As turmas ficam disponíveis após a definição do estágio no nivelamento.
          </p>
        ) : filters.stageId ? (
          <IntakeClasses {...classes} />
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-caption text-muted-foreground">
            Escolha o estágio para ver as turmas e os horários.
          </p>
        )}
      </div>
    </>
  );
}
