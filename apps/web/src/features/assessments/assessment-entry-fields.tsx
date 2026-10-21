import type { ReactElement } from "react";
import {
  Field,
  FieldError,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
} from "@lazuli/ui";
import { maskDateBR } from "~/lib/masks";
import { PHASE_LABELS, PHASES, type Phase } from "./shared";
import type { EntryState } from "./assessment-entry.types";
import styles from "./assessment-workspace.module.css";
const MAX_NOTES = 2000;
export function EntryUnitSelector({ state }: { state: EntryState }): ReactElement {
  return (
    <Field>
      <Label id={`${state.id}-unit`}>Unidade</Label>
      <SegmentedControl
        value={state.phase}
        size="sm"
        className="w-full sm:w-fit"
        aria-labelledby={`${state.id}-unit`}
        disabled={state.busy}
        onValueChange={(next) => {
          if (next) state.setPhase(next as Phase);
        }}
      >
        {PHASES.map((item) => (
          <SegmentedControlItem
            key={item}
            value={item}
            className="flex-1 px-1.5 sm:flex-none sm:px-2.5"
          >
            {PHASE_LABELS[item]}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  );
}
export function EntryGradeFields({ state }: { state: EntryState }): ReactElement {
  return (
    <div className={styles.fields}>
      <EntryScore state={state} />
      <EntryDate state={state} />
    </div>
  );
}
function EntryScore({ state }: { state: EntryState }): ReactElement {
  const { id, form, index, grade, busy } = state;
  const error = form.errors[`grades.${index}.score`];
  return (
    <Field>
      <Label htmlFor={`${id}-score`}>Nota</Label>
      <Input
        id={`${id}-score`}
        name={`${id}-score`}
        size="sm"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0–100"
        value={grade.score}
        disabled={busy}
        invalid={Boolean(error)}
        onChange={(event) => form.change(index, { field: "score", value: event.target.value })}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
function EntryDate({ state }: { state: EntryState }): ReactElement {
  const { id, form, index, grade, busy } = state;
  const error = form.errors[`grades.${index}.assessedOn`];
  return (
    <Field>
      <Label htmlFor={`${id}-date`}>Data da avaliação</Label>
      <Input
        id={`${id}-date`}
        name={`${id}-date`}
        size="sm"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={grade.date}
        disabled={busy}
        invalid={Boolean(error)}
        onChange={(event) =>
          form.change(index, { field: "date", value: maskDateBR(event.target.value) })
        }
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
export function EntryRecoveryField({ state }: { state: EntryState }): ReactElement {
  const { id, form, index, grade, busy } = state;
  const error = form.errors[`grades.${index}.reason`];
  return (
    <Field>
      <Label htmlFor={`${id}-reason`}>Recuperação realizada</Label>
      <Input
        id={`${id}-reason`}
        name={`${id}-reason`}
        autoComplete="off"
        size="sm"
        value={grade.reason}
        disabled={busy}
        placeholder="Ex.: revisão orientada e nova prova"
        invalid={Boolean(error)}
        onChange={(event) => form.change(index, { field: "reason", value: event.target.value })}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
export function EntryNotesField({ state }: { state: EntryState }): ReactElement {
  const { id, form, index, grade, busy } = state;
  const error = form.errors[`grades.${index}.notes`];
  return (
    <Field>
      <Label htmlFor={`${id}-notes`}>
        Observações <span className="font-normal text-muted-foreground">(opcional)</span>
      </Label>
      <Textarea
        id={`${id}-notes`}
        name={`${id}-notes`}
        autoComplete="off"
        size="sm"
        rows={2}
        maxLength={MAX_NOTES}
        value={grade.notes}
        disabled={busy}
        placeholder="Registre o que precisa ser acompanhado."
        invalid={Boolean(error)}
        onChange={(event) => form.change(index, { field: "notes", value: event.target.value })}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
export function EntryCorrectionField({ state }: { state: EntryState }): ReactElement {
  const { id, form, busy } = state;
  return (
    <Field>
      <Label htmlFor={`${id}-correction`}>Justificativa da correção</Label>
      <Input
        id={`${id}-correction`}
        name={`${id}-correction`}
        autoComplete="off"
        placeholder="Explique a correção desta nota"
        size="sm"
        value={form.reason}
        disabled={busy}
        onChange={(event) => form.setReason(event.target.value)}
        invalid={Boolean(form.errors.correctionReason)}
      />
      <FieldError match={Boolean(form.errors.correctionReason)}>
        {form.errors.correctionReason}
      </FieldError>
      <p className={styles.hint}>A alteração da nota precisa de nova confirmação da coordenação.</p>
    </Field>
  );
}
