import { useEffect, useState } from "react";
import {
  Alert,
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
import { normalizeSearch } from "@lazuli/domain";
import { studentPedagogyIntakeSchema, type StudentPedagogyIntake } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { NarrativeField } from "~/features/shared/task-form";
import { SlotFields, type SlotDraft } from "~/features/semester-organization/slot-fields";
import { Choices, dateOnly } from "~/features/semester-organization/shared";
import { FormFieldLoading } from "~/features/pedagogical-follow-up/form-field-loading";

export type PedagogyDraft = {
  semesterId: string;
  stageId: string;
  format: "IN_PERSON" | "ONLINE";
  slots: SlotDraft[];
  notes: string;
};
export const emptyPedagogyDraft = (semesterId = ""): PedagogyDraft => ({
  semesterId,
  stageId: "",
  format: "IN_PERSON",
  slots: [],
  notes: "",
});
export function pedagogyIntake(draft: PedagogyDraft): StudentPedagogyIntake {
  if (!draft.semesterId) throw new Error("Escolha o semestre de entrada do aluno.");
  return studentPedagogyIntakeSchema.parse({
    semesterId: draft.semesterId,
    stageId: draft.stageId || null,
    planId: null,
    formats: [draft.format],
    slots: draft.slots,
    notes: draft.notes,
  });
}
export function PedagogyStep({
  draft,
  onChange,
  onSubmit,
}: {
  draft: PedagogyDraft;
  onChange: (draft: PedagogyDraft) => void;
  onSubmit: () => void;
}) {
  const periods = trpc.semesterOrganization.semesters.useQuery();
  const options = trpc.classes.formOptions.useQuery();
  const [error, setError] = useState("");
  const [semesterError, setSemesterError] = useState("");
  const [stageQuery, setStageQuery] = useState("");
  const today = toDateOnlySaoPaulo(new Date());
  const availablePeriods = [...(periods.data ?? [])]
    .filter((period) => !period.deletedAt)
    .sort((left, right) => dateOnly(left.startDate).localeCompare(dateOnly(right.startDate)));
  const current = availablePeriods.find(
    (period) => dateOnly(period.startDate) <= today && dateOnly(period.endDate) >= today,
  );
  const next = availablePeriods.find((period) => dateOnly(period.startDate) > today);
  const currentId = current?.id;
  const nextId = next?.id;
  useEffect(() => {
    if (!periods.data || draft.semesterId === currentId || draft.semesterId === nextId) return;
    const semesterId = currentId ?? nextId ?? "";
    if (draft.semesterId !== semesterId) onChange({ ...draft, semesterId });
  }, [periods.data, currentId, nextId, draft, onChange]);
  const stages = (options.data?.stages ?? []).map((stage) => ({
    id: stage.id,
    label: `${stage.internalCode} · ${stage.name}`,
  }));
  const selectedStage = stages.find((stage) => stage.id === draft.stageId) ?? null;
  const matchingStages = stages.filter((stage) =>
    normalizeSearch(stage.label).includes(normalizeSearch(stageQuery)),
  );
  const set = (patch: Partial<PedagogyDraft>) => {
    onChange({ ...draft, ...patch });
    setError("");
  };
  return (
    <form
      id="new-student-pedagogico"
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          if (
            !draft.semesterId ||
            (draft.semesterId !== currentId && draft.semesterId !== nextId)
          ) {
            setSemesterError("Escolha o semestre atual ou o próximo para a entrada.");
            return;
          }
          pedagogyIntake(draft);
          onSubmit();
        } catch {
          setError("Revise os horários: informe início e fim válidos para cada dia.");
        }
      }}
    >
      {(error || periods.error || options.error) && (
        <Alert variant="warning">{error || periods.error?.message || options.error?.message}</Alert>
      )}
      <FormSection title="Entrada e percurso">
        <FormRow columns={2}>
          {periods.isPending ? (
            <FormFieldLoading label="Semestre de entrada" />
          ) : (
            <Field name="intake-semester">
              <Label id="intake-semester-label">Semestre de entrada</Label>
              <SegmentedControl
                size="sm"
                wrap
                value={draft.semesterId || null}
                aria-labelledby="intake-semester-label"
                invalid={Boolean(semesterError)}
                onValueChange={(semesterId) => {
                  if (!semesterId) return;
                  set({ semesterId });
                  setSemesterError("");
                }}
              >
                <SegmentedControlItem value={currentId ?? "current"} disabled={!current}>
                  Atual{current ? ` · ${current.name}` : ""}
                </SegmentedControlItem>
                <SegmentedControlItem value={nextId ?? "next"} disabled={!next}>
                  Próximo{next ? ` · ${next.name}` : ""}
                </SegmentedControlItem>
              </SegmentedControl>
              <FieldError match={Boolean(semesterError)}>{semesterError}</FieldError>
              {(!current || !next) && !periods.error && (
                <p className="text-caption text-muted-foreground">
                  {!current && !next
                    ? "Cadastre o semestre de entrada em Organização de turmas."
                    : !next
                      ? "O próximo semestre ainda não foi cadastrado."
                      : "Não há semestre em andamento. A entrada será no próximo."}
                </p>
              )}
            </Field>
          )}
          <Choices
            name="intake-format"
            label="Formato"
            value={draft.format}
            onChange={(format) => set({ format: format as PedagogyDraft["format"] })}
            options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
          />
        </FormRow>
        {options.isPending ? (
          <FormFieldLoading label="Estágio indicado" />
        ) : (
          <Field name="intake-stage">
            <Label>Estágio indicado · opcional</Label>
            <SearchSelect
              name="intake-stage"
              placeholder="Buscar por código ou nome do estágio"
              showSearchIcon
              openOnFocus
              query={stageQuery}
              value={selectedStage}
              options={matchingStages}
              failed={Boolean(options.error)}
              onQueryChange={setStageQuery}
              onSelect={(stage) => {
                set({ stageId: stage.id });
                setStageQuery("");
              }}
              onClear={() => {
                set({ stageId: "" });
                setStageQuery("");
              }}
              emptyMessage="Nenhum estágio encontrado."
            />
            {!draft.stageId && (
              <p className="text-caption text-muted-foreground">
                Pode ficar para a coordenação definir.
              </p>
            )}
          </Field>
        )}
      </FormSection>
      {draft.slots.length ? (
        <>
          <SlotFields slots={draft.slots} onChange={(slots) => set({ slots })} />
          <Button
            size="sm"
            variant="ghost"
            className="justify-self-start"
            onClick={() => set({ slots: [] })}
          >
            Deixar disponibilidade para depois
          </Button>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 border-y border-border py-3">
          <p className="text-caption text-muted-foreground">Ainda sem horário combinado.</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => set({ slots: [{ weekday: "MONDAY", startTime: "", endTime: "" }] })}
          >
            Informar disponibilidade
          </Button>
        </div>
      )}
      <NarrativeField
        name="intake-notes"
        label="Preferências e combinados · opcional"
        placeholder="Ex.: prefere o fim da tarde; pode começar em fevereiro"
        rows={2}
        value={draft.notes}
        onChange={(notes) => set({ notes })}
      />
      <p className="text-caption text-muted-foreground">
        O aluno entrará na fila de acomodação do semestre escolhido. A turma será definida em
        Organização de turmas.
      </p>
    </form>
  );
}
