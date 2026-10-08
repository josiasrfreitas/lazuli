"use client";
import type { ReactElement } from "react";
import { Field, FormRow, FormSection, Input, Label } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { NativeSelect } from "./form-controls";
import type { MembershipMode, useMembershipState } from "./membership-state";

type State = ReturnType<typeof useMembershipState>;
type Options = RouterOutputs["classes"]["formOptions"];
type Props = {
  mode: MembershipMode;
  state: State;
  options: Options;
  scheduleType: "REGULAR" | "PERSONALIZED";
};
function StudentChoice({ mode, state }: Pick<Props, "mode" | "state">): ReactElement {
  const choices =
    mode === "ENTRY"
      ? state.students.map((item) => ({ value: item.id, label: item.fullName }))
      : state.paused.map((item) => ({
          value: item.id,
          label: `${item.student.fullName} · ${item.class.internalCode}`,
        }));
  return (
    <FormSection title={mode === "ENTRY" ? "Aluno" : "Vínculo pausado"}>
      <Field>
        <Label htmlFor="studentSearch">Buscar aluno</Label>
        <Input
          id="studentSearch"
          name="studentSearch"
          autoComplete="off"
          placeholder="Nome, documento ou telefone"
          size="sm"
          value={state.search}
          onChange={(event) => state.setSearch(event.target.value)}
        />
      </Field>
      {state.search.length >= 2 && (
        <NativeSelect
          name="studentId"
          label={mode === "ENTRY" ? "Aluno" : "Pausa anterior"}
          value={state.selectedId}
          onChange={state.setSelectedId}
          choices={choices}
        />
      )}
      {state.search.length >= 2 && choices.length === 0 && !state.searching && (
        <p className="text-caption text-muted-foreground">Nenhum vínculo encontrado.</p>
      )}
    </FormSection>
  );
}
function PlacementFields({ mode, state, options, scheduleType }: Props): ReactElement {
  return (
    <FormSection title="Entrada na turma">
      <FormRow columns={2}>
        <Field>
          <Label htmlFor="entryDate">Data de entrada</Label>
          <Input
            id="entryDate"
            name="entryDate"
            autoComplete="off"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            size="sm"
            value={state.date}
            onChange={(event) => state.setDate(event.target.value)}
          />
        </Field>
        {scheduleType === "PERSONALIZED" && (
          <NativeSelect
            name="stageId"
            label="Etapa individual"
            value={state.stageId}
            onChange={state.setStageId}
            choices={options.stages.map((item) => ({
              value: item.id,
              label: `${item.internalCode} · ${item.name}`,
            }))}
          />
        )}
      </FormRow>
      {mode === "RETURN" && (
        <p className="text-caption text-muted-foreground">
          O retorno inicia uma nova colocação pedagógica e preserva o percurso anterior.
        </p>
      )}
    </FormSection>
  );
}
export function MembershipFields(props: Props): ReactElement {
  return (
    <div className="space-y-5">
      <StudentChoice mode={props.mode} state={props.state} />
      <PlacementFields {...props} />
    </div>
  );
}
