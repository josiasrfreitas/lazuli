import type { ReactElement, ReactNode } from "react";
import {
  Button,
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
          {props.linked ? (
            <Input
              name="fullName"
              value={props.name}
              invalid={Boolean(props.error)}
              onChange={(event) => props.onChange(event.target.value)}
            />
          ) : (
            <SearchSelect
              name="fullName"
              showSearchIcon
              minQueryLength={1}
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
          )}
        </div>
        {props.action && <div className="shrink-0">{props.action}</div>}
      </div>
      {props.error && <FieldError match>{props.error}</FieldError>}
      {props.fromLead && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption text-muted-foreground">Dados preenchidos a partir do lead.</p>
          <Button variant="ghost" size="sm" onClick={props.onClear}>
            Trocar lead
          </Button>
        </div>
      )}
    </Field>
  );
}
