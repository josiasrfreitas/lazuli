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
  DialogDescription,
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
  compact?: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  saveLabel?: string;
  description?: string | undefined;
};
export function EditorForm(props: FormProps): React.JSX.Element {
  const pending = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent motion="subtle" initialFocus={() => firstFormField(form.current) ?? true}>
          <EditorFormBody {...props} form={form} pending={pending} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export function firstFormField(form: HTMLFormElement | null): HTMLElement | undefined {
  return (
    form?.querySelector<HTMLElement>("input:not([type=hidden]),button:not([disabled])") ?? undefined
  );
}
type SubmissionRefs = {
  form: React.RefObject<HTMLFormElement | null>;
  pending: React.RefObject<boolean>;
};
export function EditorFormBody({
  title,
  description,
  children,
  onClose,
  onSave,
  saveLabel = "Salvar",
  compact = false,
  form,
  pending,
}: FormProps & SubmissionRefs): React.JSX.Element {
  const { error, invalid, busy, formId, submit, clearError } = useEditorSubmission({
    onSave,
    onClose,
    form,
    pending,
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
      className="grid"
    >
      <fieldset disabled={busy} className={compact ? "grid min-w-0 gap-2" : "grid min-w-0 gap-4"}>
        <Validation.Provider value={{ name: invalid, message: error }}>
          {children}
        </Validation.Provider>
      </fieldset>
    </form>
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogBody>
        <div className={styles.formBody} data-compact={compact || undefined}>
          {fields}
        </div>
      </DialogBody>
      {error && !invalid && (
        <p role="alert" className={styles.fieldAlert}>
          {error}
        </p>
      )}
      <DialogFooter className="flex-row justify-end">
        <FormActions busy={busy} onClose={onClose} formId={formId} saveLabel={saveLabel} />
      </DialogFooter>
    </>
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
  hideLabel = false,
  options,
  value,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  name?: string;
  options: Option[];
  value: string;
  onChange: (s: string) => void;
}): React.JSX.Element {
  const labelId = useId();
  return (
    <div className="grid min-w-0 gap-1">
      {name && <input type="hidden" name={name} value={value} />}
      <span id={labelId} className={hideLabel ? "sr-only" : styles.fieldLabel}>
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
      <Button
        size="compact-responsive"
        variant="ghost"
        type="button"
        disabled={busy}
        onClick={onClose}
      >
        Cancelar
      </Button>
      <Button size="compact-responsive" type="submit" form={formId} disabled={busy}>
        {busy ? "Salvando…" : saveLabel}
      </Button>
    </>
  );
}
function fieldForMessage(message: string): string {
  if (message.includes("código")) return "code";
  if (message.includes("com este nome")) return "name";
  if (message.includes("60 minutos")) return "minutes";
  if (message.includes("parte com esse título")) return "title";
  if (message.includes("página já existe")) return "number";
  if (message.includes("páginas")) return "pageEnd";
  return "";
}
type EditorSubmission = {
  error: string;
  invalid: string;
  busy: boolean;
  formId: string;
  submit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  clearError: () => void;
};
function useEditorSubmission({
  onSave,
  onClose,
  form,
  pending,
}: Pick<FormProps, "onSave" | "onClose"> & SubmissionRefs): EditorSubmission {
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState("");
  const [busy, setBusy] = useState(false);
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
    formId,
    submit,
    clearError: () => {
      setError("");
      setInvalid("");
    },
  };
}
