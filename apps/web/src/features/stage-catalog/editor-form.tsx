"use client";
import styles from "./workspace.module.css";
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Field,
  FieldError,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lazuli/ui";

export const formText = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const Validation = createContext({ name: "", message: "" });

type FormProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  saveLabel?: string;
  inline?: boolean;
};
export function EditorForm({
  title,
  children,
  onClose,
  onSave,
  saveLabel = "Salvar",
  inline = false,
}: FormProps): React.JSX.Element {
  const { error, invalid, busy, pending, form, formId, submit, clearError } = useEditorSubmission({
    onSave,
    onClose,
  });
  const fields = (
    <form
      ref={form}
      id={formId}
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      onChange={clearError}
      aria-label={title}
      className="grid gap-4"
    >
      <fieldset disabled={busy} className="grid min-w-0 gap-4">
        <Validation.Provider value={{ name: invalid, message: error }}>
          {children}
        </Validation.Provider>
      </fieldset>
      {error && !invalid && (
        <p role="alert" className={styles.fieldAlert}>
          {error}
        </p>
      )}
    </form>
  );
  const actions = (
    <FormActions busy={busy} onClose={onClose} formId={formId} saveLabel={saveLabel} />
  );
  if (inline)
    return (
      <InlineEditor title={title} fields={fields} actions={actions} busy={busy} onClose={onClose} />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          motion="subtle"
          initialFocus={() =>
            form.current?.querySelector<HTMLElement>("input:not([type=hidden]),button") ?? true
          }
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="pt-4">{fields}</div>
          </DialogBody>
          <DialogFooter>{actions}</DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
export function TextField({
  label,
  ...props
}: ComponentProps<typeof Input> & { label: string }): React.JSX.Element {
  const id = useId();
  const validation = useContext(Validation);
  const invalid = !!props.name && validation.name === props.name;
  return (
    <Field invalid={invalid}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} invalid={invalid} size="sm" autoComplete="off" {...props} />
      {invalid && (
        <FieldError role="alert" match={true}>
          {validation.message}
        </FieldError>
      )}
    </Field>
  );
}
const MAX_SEGMENTS = 5;
type Option = { value: string; label: string };
export function Choice({
  name,
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  name?: string;
  options: Option[];
  value: string;
  onChange: (s: string) => void;
}): React.JSX.Element {
  const labelId = useId();
  return (
    <div className="grid min-w-0 gap-1">
      {name && <input type="hidden" name={name} value={value} />}
      <span id={labelId} className={styles.fieldLabel}>
        {label}
      </span>
      {options.length <= MAX_SEGMENTS ? (
        <SegmentedControl
          aria-labelledby={labelId}
          value={value}
          wrap
          size="sm"
          onValueChange={(newValue) => {
            if (newValue !== null) onChange(newValue);
          }}
        >
          {options.map((option) => (
            <SegmentedControlItem key={option.value} value={option.value}>
              {option.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      ) : (
        <Select
          value={value}
          onValueChange={(newValue) => {
            if (newValue !== null) onChange(newValue);
          }}
          items={options}
        >
          <SelectTrigger aria-labelledby={labelId} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function FormActions({
  busy,
  onClose,
  formId,
  saveLabel,
}: {
  busy: boolean;
  onClose: () => void;
  formId: string;
  saveLabel: string;
}): React.JSX.Element {
  return (
    <>
      <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={onClose}>
        Cancelar
      </Button>
      <Button size="sm" type="submit" form={formId} disabled={busy}>
        {busy ? "Salvando…" : saveLabel}
      </Button>
    </>
  );
}
function fieldForMessage(message: string): string {
  if (message.includes("código")) return "code";
  if (message.includes("com este nome")) return "name";
  if (message.includes("páginas")) return "pageEnd";
  return "";
}
type EditorSubmission = {
  error: string;
  invalid: string;
  busy: boolean;
  pending: React.RefObject<boolean>;
  form: React.RefObject<HTMLFormElement | null>;
  formId: string;
  submit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  clearError: () => void;
};
function useEditorSubmission({
  onSave,
  onClose,
}: Pick<FormProps, "onSave" | "onClose">): EditorSubmission {
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const formId = useId();
  function reportError(message: string): void {
    const field = fieldForMessage(message);
    const input = field ? form.current?.elements.namedItem(field) : null;
    if (input instanceof HTMLInputElement) {
      setInvalid(field);
      requestAnimationFrame(() => input.focus());
    }
    setError(message);
  }
  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (pending.current) return;
    const invalidInput = event.currentTarget.querySelector<HTMLInputElement>(
      "input:invalid,select:invalid",
    );
    if (invalidInput) {
      invalidInput.focus();
      setInvalid(invalidInput.name);
      setError(
        invalidInput.validity.valueMissing ? "Preencha este campo." : "Confira o valor informado.",
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setInvalid("");
    try {
      await onSave(new FormData(event.currentTarget));
      onClose();
    } catch (error) {
      reportError(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    error,
    invalid,
    busy,
    pending,
    form,
    formId,
    submit,
    clearError: () => {
      setError("");
      setInvalid("");
    },
  };
}

function InlineEditor({
  title,
  fields,
  actions,
  busy,
  onClose,
}: {
  title: string;
  fields: ReactNode;
  actions: ReactNode;
  busy: boolean;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <section
      aria-label={title}
      className="grid gap-3 rounded-md border border-border-strong bg-card p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose();
      }}
    >
      <h4 className={styles.controlTitle}>{title}</h4>
      {fields}
      <div className="flex justify-end gap-2">{actions}</div>
    </section>
  );
}
