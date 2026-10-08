"use client";
import type { ReactElement } from "react";
import { CalendarDays, Search } from "lucide-react";
import { Field, FormRow, Input, Label, SearchSelect } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { parseDateBR } from "~/lib/masks";
import { SelectControl } from "./form-controls";
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
      ? state.students.map((item) => ({ id: item.id, label: item.fullName }))
      : state.paused.map((item) => ({
          id: item.id,
          label: `${item.student.fullName} · ${item.class.internalCode}`,
        }));
  return (
    <Field name="studentSearch">
      <Label className="flex items-center gap-1.5">
        <Search aria-hidden="true" className="size-3.5" />
        Buscar aluno
      </Label>
      <SearchSelect
        name="studentSearch"
        placeholder="Nome, documento ou telefone"
        query={state.search}
        value={choices.find((choice) => choice.id === state.selectedId) ?? null}
        options={choices}
        onQueryChange={state.setSearch}
        onSelect={(choice) => state.setSelectedId(choice.id)}
        onClear={() => state.setSearch("")}
        loading={state.searching}
        failed={state.searchFailed}
        disabled={state.pending}
        openOnFocus
        emptyMessage="Nenhum aluno encontrado."
      />
    </Field>
  );
}
function PlacementFields({ mode, state, options, scheduleType }: Props): ReactElement {
  return (
    <div className="grid gap-3">
      <FormRow>
        <Field>
          <Label htmlFor="entryDate" className="flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            Data de entrada
          </Label>
          <Input
            id="entryDate"
            name="entryDate"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            size="sm"
            type="date"
            value={parseDateBR(state.date) ?? ""}
            disabled={state.pending}
            onChange={(event) => {
              const [year, month, day] = event.target.value.split("-");
              state.setDate(year && month && day ? `${day}/${month}/${year}` : "");
            }}
            onClick={(event) => event.currentTarget.showPicker?.()}
          />
        </Field>
        {scheduleType === "PERSONALIZED" && (
          <SelectControl
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
    </div>
  );
}
export function MembershipFields(props: Props): ReactElement {
  return (
    <div className="space-y-4">
      <StudentChoice mode={props.mode} state={props.state} />
      <PlacementFields {...props} />
    </div>
  );
}
