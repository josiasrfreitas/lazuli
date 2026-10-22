"use client";
import type { JSX as ReactJSX } from "react";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { dateOnly, scheduleLabel } from "~/features/semester-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { useMovementModel, type MovementModel, type MovementProps } from "./movement-model";
import styles from "./organization.module.css";

export function MovementForm(props: MovementProps): ReactJSX.Element {
  const model = useMovementModel(props);
  const { rows, decline, board, onClose } = props;
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title={decline ? "Registrar não continuidade" : "Transferir alunos"}
      description={`${rows.length} ${rows.length === 1 ? "aluno" : "alunos"} · ${board.semester.name}`}
      formId="organization-movement"
      firstField={decline ? "movement-reason" : "movement-plan"}
      submitLabel={decline ? "Registrar não continuidade" : "Salvar transferência para revisão"}
      pending={model.pending}
      error={model.error}
      onClose={onClose}
      bodyRef={model.body}
    >
      <MovementFields props={props} model={model} />
    </TaskDialog>
  );
}

function MovementFields({
  props,
  model,
}: {
  props: MovementProps;
  model: MovementModel;
}): ReactJSX.Element {
  return (
    <form className={styles.form} id="organization-movement" noValidate onSubmit={model.submit}>
      <MovementSummary {...props} />
      {props.decline ? (
        <p className={styles.small}>
          Retira a continuidade deste semestre. O vínculo atual e os contratos permanecem sujeitos
          às suas próprias datas e condições.
        </p>
      ) : (
        <MovementDestination model={model} />
      )}
      <NarrativeField
        name="movement-reason"
        label={props.decline ? "Motivo" : "Motivo · opcional"}
        value={model.reason}
        onChange={model.changeReason}
        placeholder="Horário, adaptação ou outro combinado"
        rows={2}
        error={model.errors.reason}
      />
    </form>
  );
}

function MovementSummary({ rows, board }: MovementProps): ReactJSX.Element {
  return (
    <div className={styles.summary}>
      {rows.map((row) => (
        <div className={styles.row} key={row.id}>
          <strong>{row.studentName}</strong>
          <span className={styles.small}>
            {row.stageCode} ·{" "}
            {board.plans.find((plan) => plan.id === row.planId)?.name ?? "Sem turma"}
          </span>
        </div>
      ))}
    </div>
  );
}

function MovementDestination({ model }: { model: MovementModel }): ReactJSX.Element {
  return (
    <>
      <SelectControl
        name="movement-semester"
        label="Semestre de destino"
        value={model.targetSemesterId}
        onChange={model.changeSemester}
        choices={(model.periods.data ?? [])
          .filter((period) => dateOnly(period.endDate) >= toDateOnlySaoPaulo(new Date()))
          .map((period) => ({ value: period.id, label: period.name }))}
      />
      {model.targetError && (
        <p role="alert" className={styles.attention}>
          {model.targetError}
        </p>
      )}
      <SelectControl
        name="movement-plan"
        label="Turma de destino"
        value={model.planId}
        onChange={model.changePlan}
        choices={(model.targetBoard?.plans ?? [])
          .filter((plan) => plan.active)
          .map((plan) => ({
            value: plan.id,
            label: `${plan.name} · ${scheduleLabel(plan.slots)}`,
          }))}
        error={model.errors.planId}
      />
      <div className="w-40">
        <TextControl
          name="movement-date"
          label="Válida a partir de"
          value={model.date}
          onChange={model.changeDate}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          error={model.errors.effectiveDate}
        />
      </div>
      <p className={styles.small}>
        O aluno permanece na turma atual até a vigência. A revisão mostra incompatibilidades antes
        da confirmação.
      </p>
    </>
  );
}
