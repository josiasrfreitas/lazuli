import type { ReactElement } from "react";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import {
  Field,
  FieldError,
  InlineSkeleton,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { NarrativeField } from "~/features/shared/task-form";
import { RecordState } from "~/features/class-records/shared";
import { PurposeField } from "./form-fields";
import { CoverageFields } from "./coverage-fields";
import { purposes } from "./shared";
import { changeMeetingKind, type ScheduleModel } from "./schedule-model";
import styles from "./schedule-dialog.module.css";
export function ScheduleDetails({ model }: { model: ScheduleModel }): ReactElement {
  return (
    <>
      <div className={styles.context}>
        {!model.props.student && !model.props.previous && <ScheduleStudent model={model} />}
        <div className={styles.choices}>
          <SchedulePurpose model={model} />
          <ScheduleKind model={model} />
        </div>
        {model.draft.student && (
          <RecordState
            pending={false}
            error={model.queries.options.error}
            retry={() => void model.queries.options.refetch()}
          />
        )}
      </div>
      <div className={styles.details}>
        {model.draft.purpose === "MAKEUP" && (
          <div className={styles.coverage}>
            <ScheduleMakeupSources model={model} />
          </div>
        )}
        <ScheduleEnrollmentNotices model={model} />
        <ScheduleNotes model={model} />
      </div>
    </>
  );
}
function ScheduleStudent({ model }: { model: ScheduleModel }): ReactElement {
  const { draft, queries, validation } = model;
  return (
    <Field>
      <Label>Aluno</Label>
      <SearchSelect
        showSearchIcon
        name="appointment-student"
        placeholder="Buscar pelo nome"
        query={draft.search}
        value={draft.student}
        options={(queries.results.data ?? []).map((row) => ({ id: row.id, label: row.fullName }))}
        onQueryChange={(value) => model.edit({ search: value })}
        onSelect={(next) =>
          model.edit({ student: next, teacherSelection: undefined, coverages: [] }, "studentId")
        }
        onClear={() => model.edit({ student: null, teacherSelection: undefined, coverages: [] })}
        loading={queries.results.isFetching}
        invalid={Boolean(validation.errors.studentId)}
      />
      <FieldError match={Boolean(validation.errors.studentId)}>
        {validation.errors.studentId}
      </FieldError>
    </Field>
  );
}
function SchedulePurpose({ model }: { model: ScheduleModel }): ReactElement {
  if (model.props.previous)
    return (
      <p className="text-caption text-muted-foreground">
        {purposes[model.draft.purpose]} · O agendamento anterior será preservado como reagendado.
      </p>
    );
  return (
    <PurposeField
      value={model.draft.purpose}
      onChange={(value) => {
        model.edit({ purpose: value }, "purpose");
        model.validation.clear("coverages");
      }}
    />
  );
}
function ScheduleKind({ model }: { model: ScheduleModel }): ReactElement {
  return (
    <div className={styles.choiceGroup}>
      <Field>
        <Label id="appointment-kind-label">
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="size-4" aria-hidden="true" /> Tipo de encontro
          </span>
        </Label>
        <SegmentedControl
          size="sm"
          wrap
          aria-labelledby="appointment-kind-label"
          value={model.draft.kind}
          onValueChange={(value) => {
            if (value === "CLASS" || value === "INDEPENDENT") changeMeetingKind(model, value);
          }}
        >
          <SegmentedControlItem id="appointment-kind" value="INDEPENDENT">
            Horário individual
          </SegmentedControlItem>
          <SegmentedControlItem value="CLASS">Participação em turma</SegmentedControlItem>
        </SegmentedControl>
      </Field>
    </div>
  );
}
function ScheduleMakeupSources({ model }: { model: ScheduleModel }): ReactElement {
  if (model.eligibility.noMakeupSources)
    return (
      <div className="flex items-start gap-3 text-caption" role="status">
        <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="grid gap-1">
          <p className="font-medium">Nenhuma falta com saldo para repor</p>
          <p className="text-muted-foreground">Escolha outra finalidade para este atendimento.</p>
        </div>
      </div>
    );
  if (!model.draft.student)
    return (
      <p className="text-caption text-muted-foreground">
        Selecione o aluno para consultar as faltas disponíveis.
      </p>
    );
  return (
    <CoverageFields
      key={model.draft.student.id}
      compact
      sources={model.queries.options.data?.absences ?? []}
      loading={model.queries.options.isPending}
      value={model.draft.coverages}
      onChange={(value) => model.edit({ coverages: value }, "coverages")}
      error={model.validation.errors.coverages}
    />
  );
}
function ScheduleEnrollmentNotices({ model }: { model: ScheduleModel }): ReactElement {
  const { draft, queries, eligibility } = model;
  return (
    <>
      {draft.purpose === "PPT_COMPLEMENT" && draft.student && queries.options.isPending && (
        <div
          role="status"
          aria-label="Carregando matrícula PPT"
          className="flex items-center gap-2 text-caption text-muted-foreground"
        >
          <InlineSkeleton className="h-4 w-24" />
          Consultando matrícula ativa…
        </div>
      )}
      {eligibility.noCurrentEnrollment && (
        <p role="status" className="text-sm text-muted-foreground">
          Este aluno está sem matrícula vigente. Organize a matrícula antes de agendar um
          atendimento.
        </p>
      )}
      {!eligibility.noCurrentEnrollment && eligibility.noPptEnrollment && (
        <p role="status" className="text-caption text-muted-foreground">
          O aluno não possui matrícula PPT ativa. Escolha outra finalidade.
        </p>
      )}
      {eligibility.enrollmentDateError && (
        <p role="alert" className="text-caption text-destructive">
          {eligibility.enrollmentDateError}
        </p>
      )}
    </>
  );
}
function ScheduleNotes({ model }: { model: ScheduleModel }): ReactElement {
  const { draft, validation } = model;
  return (
    <div className={styles.notes}>
      <div
        className={styles.noteFields}
        data-reschedule={Boolean(model.props.previous) || undefined}
      >
        <NarrativeField
          rows={2}
          name="plannedContent"
          label="O que trabalhar · opcional"
          value={draft.planned}
          onChange={(value) => model.edit({ planned: value }, "plannedContent")}
          placeholder="Conteúdo, objetivo ou referência para o professor"
          error={validation.errors.plannedContent}
        />
        <NarrativeField
          rows={2}
          name="appointment-notes"
          label="Observação · opcional"
          value={draft.notes}
          onChange={(value) => model.edit({ notes: value }, "notes")}
          placeholder="Combinados com o aluno ou responsável"
          error={validation.errors.notes}
        />
        {model.props.previous && (
          <NarrativeField
            rows={2}
            name="reschedule-reason"
            label="Motivo do reagendamento"
            value={draft.reason}
            onChange={(value) => model.edit({ reason: value }, "reason")}
            placeholder="O que mudou no combinado"
            error={validation.errors.reason}
          />
        )}
      </div>
    </div>
  );
}
