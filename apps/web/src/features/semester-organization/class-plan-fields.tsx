import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Checkbox } from "@lazuli/ui";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import type { PendingGroup } from "~/features/class-organization/model";
import { Choices } from "./shared";
import { SlotFields } from "./slot-fields";
import type { ClassPlanModel } from "./class-plan-model";

type Options = RouterOutputs["classes"]["formOptions"] | undefined;
type Person = { id: string; name: string; label: string; lead: boolean };

export function ClassPlanFields({
  group,
  model,
  options,
}: {
  group: PendingGroup | undefined;
  model: ClassPlanModel;
  options: Options;
}): ReactJSX.Element {
  return (
    <form id="semester-plan" noValidate className="grid gap-4 pt-4" onSubmit={model.submit}>
      <TextControl
        name="plan-name"
        label="Nome da turma"
        placeholder="Connect 2 · tarde"
        value={model.name}
        onChange={model.changeName}
        error={model.validation.errors.name}
      />
      <PlanKindFormat model={model} />
      <PlanTeacherStage model={model} options={options} />
      <SlotFields
        slots={model.slots}
        onChange={model.changeSlots}
        error={model.validation.errors.slots}
      />
      {group && <GroupPeople group={group} model={model} />}
      <p className="text-caption text-muted-foreground">
        Novos horários: até 2 horas por semana. Horários herdados podem ser mantidos. O professor
        pode ser definido antes da confirmação.
      </p>
    </form>
  );
}

function PlanKindFormat({ model }: { model: ClassPlanModel }): ReactJSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Choices
        name="plan-kind"
        label="Modalidade"
        value={model.kind}
        options={{ REGULAR: "Regular", PERSONALIZED: "PPT" }}
        onChange={model.changeKind}
      />
      <Choices
        name="plan-format"
        label="Formato"
        value={model.format}
        options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
        onChange={model.changeFormat}
      />
    </div>
  );
}

function PlanTeacherStage({
  model,
  options,
}: {
  model: ClassPlanModel;
  options: Options;
}): ReactJSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectControl
        name="plan-teacher"
        label="Professor"
        value={model.teacher}
        onChange={model.changeTeacher}
        choices={[
          { value: "pending", label: "Definir depois" },
          ...(options?.teachers ?? []).map((row) => ({ value: row.id, label: row.name })),
        ]}
        error={model.validation.errors.teacherId}
      />
      {model.kind === "REGULAR" && (
        <SelectControl
          name="plan-stage"
          label="Estágio compartilhado"
          value={model.stage}
          onChange={model.changeStage}
          choices={(options?.stages ?? []).map((row) => ({
            value: row.id,
            label: `${row.internalCode} · ${row.name}`,
          }))}
          error={model.validation.errors.sharedStageId}
        />
      )}
    </div>
  );
}

function GroupPeople({
  group,
  model,
}: {
  group: PendingGroup;
  model: ClassPlanModel;
}): ReactJSX.Element {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-caption font-medium mb-2">Pessoas para esta turma</legend>
      {groupPeople(group).map((person) => (
        <GroupPerson
          key={person.id}
          person={person}
          checked={model.selected.includes(person.id)}
          onChange={(checked) => model.togglePerson(person.id, checked)}
        />
      ))}
      <p className="text-caption text-muted-foreground">
        A turma e as propostas ficam salvas juntas. Confirme as alocações após combinar os horários;
        leads concluem a matrícula pelo cadastro.
      </p>
    </fieldset>
  );
}

function groupPeople(group: PendingGroup): Person[] {
  return [
    ...group.rows.map((row) => ({
      id: row.id,
      name: row.studentName,
      label: row.sourceClassId ? "Troca de turma" : "Aguardando turma",
      lead: false,
    })),
    ...group.leads.map((lead) => ({
      id: lead.id,
      name: lead.fullName,
      label: "Matrícula a finalizar",
      lead: true,
    })),
  ];
}

function GroupPerson({
  person,
  checked,
  onChange,
}: {
  person: Person;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): ReactJSX.Element {
  return (
    <label className="flex items-center gap-2 text-caption">
      <Checkbox size="sm" checked={checked} onCheckedChange={onChange} />
      <span className="grid gap-1">
        <span>{person.name}</span>
        <span className="flex items-center gap-2">
          <Badge variant={person.lead ? "info" : "neutral"}>
            {person.lead ? "Lead" : "Aluno da escola"}
          </Badge>
          <span className="text-muted-foreground">{person.label}</span>
        </span>
      </span>
    </label>
  );
}
