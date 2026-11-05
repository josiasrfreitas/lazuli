import type { ReactElement, ReactNode } from "react";
import {
  SelectionValue,
  Field,
  FieldError,
  Input,
  Label,
  SearchSelect,
  type SearchSelectOption,
} from "@lazuli/ui";
type Props = {
  name: string;
  action?: ReactNode;
  error: string | undefined;
  linked: boolean;
  fromLead: boolean;
  options: SearchSelectOption[];
  loading: boolean;
  failed: boolean;
  emptyMessage: string;
  onChange: (value: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
};
export function IntakeNameField(props: Props): ReactElement {
  return (
    <Field>
      <Label>Nome do aluno</Label>
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <NameControl {...props} />
        </div>
        {props.action && <div className="shrink-0">{props.action}</div>}
      </div>
      {props.error && <FieldError match>{props.error}</FieldError>}
    </Field>
  );
}

function NameControl(props: Props): ReactElement {
  if (props.fromLead)
    return (
      <SelectionValue
        value={props.name}
        onClear={props.onClear}
        clearLabel="Limpar lead e dados preenchidos"
      />
    );
  if (props.linked)
    return (
      <Input
        name="fullName"
        value={props.name}
        invalid={Boolean(props.error)}
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  return (
    <SearchSelect
      name="fullName"
      showSearchIcon
      minQueryLength={1}
      resultsOnly
      placeholder="Digite para buscar leads ou cadastrar um aluno"
      query={props.name}
      value={null}
      options={props.options}
      loading={props.loading}
      failed={props.failed}
      onQueryChange={props.onChange}
      onSelect={(row) => props.onSelect(row.id)}
      onClear={props.onClear}
      invalid={Boolean(props.error)}
      emptyMessage={props.emptyMessage}
    />
  );
}
