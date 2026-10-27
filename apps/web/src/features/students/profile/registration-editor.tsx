"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  Alert,
  Button,
  Field,
  Input,
  Label,
  Textarea,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { studentUpdateContactInputSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { maskDateBR, maskPhoneBR, parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";
import type { StudentProfile } from "./logic";
import styles from "./student-registration.module.css";

export type RegistrationEditTarget = "student" | "guardian" | "address" | "notes";
type EditorProps = {
  profile: StudentProfile;
  target: RegistrationEditTarget;
  onCancel: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
};
type EditorModel = {
  form: RefObject<HTMLFormElement | null>;
  values: Record<string, string>;
  errors: Record<string, string>;
  failure: string;
  saving: boolean;
  change: (key: string, value: string) => void;
  save: () => Promise<void>;
};
const TITLES = {
  student: "Dados do aluno",
  guardian: "Responsável",
  address: "Endereço",
  notes: "Observações",
};
const ADDRESS_FIELDS = [
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
  "postalCode",
] as const;
const FIELDS: Record<string, [string, string]> = {
  fullName: ["Nome completo", "Nome completo"],
  birthDate: ["Nascimento", "dd/mm/aaaa"],
  documentNumber: ["Número do documento", "Número do CPF ou RG"],
  phone: ["Telefone", "(82) 99999-9999"],
  email: ["E-mail", "nome@exemplo.com"],
  relationship: ["Parentesco", "Ex.: mãe, pai, avó"],
  street: ["Rua", "Nome da rua"],
  number: ["Número", "123"],
  complement: ["Complemento", "Apto., bloco…"],
  neighborhood: ["Bairro", "Nome do bairro"],
  city: ["Cidade", "Nome da cidade"],
  state: ["UF", "AL"],
  postalCode: ["CEP", "00000-000"],
};
function initialValues(
  profile: StudentProfile,
  target: RegistrationEditTarget,
): Record<string, string> {
  if (target === "notes") return { notes: profile.notes ?? "" };
  if (target === "address") return initialAddressValues(profile);
  return initialPersonValues(profile, target);
}

function initialAddressValues(profile: StudentProfile): Record<string, string> {
  return Object.fromEntries(ADDRESS_FIELDS.map((key) => [key, profile.address?.[key] ?? ""]));
}

function initialPersonValues(
  profile: StudentProfile,
  target: "student" | "guardian",
): Record<string, string> {
  const person = target === "guardian" ? profile.guardian : profile.contact;
  const common = { ...initialContactValues(person), documentNumber: person?.documentNumber ?? "" };
  if (target === "guardian")
    return { ...common, relationship: profile.guardian?.relationship ?? "" };
  return {
    ...common,
    birthDate: profile.contact.birthDate ? formatDateOnlyBR(profile.contact.birthDate) : "",
  };
}

function initialContactValues(
  person: StudentProfile["guardian"] | StudentProfile["contact"],
): Record<string, string> {
  return {
    fullName: person?.fullName ?? "",
    phone: person?.phone ?? "",
    email: person?.email ?? "",
    documentType: person?.documentType ?? "",
  };
}

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}

function contactInput({
  profile,
  target,
  person,
}: {
  profile: StudentProfile;
  target: RegistrationEditTarget;
  person: Record<string, string | null>;
}):
  | Record<string, string | null>
  | { guardian: { mode: "update" | "create"; input: Record<string, string | null> } }
  | { address: Record<string, string | null> } {
  if (target === "guardian")
    return { guardian: { mode: profile.guardian ? "update" : "create", input: person } };
  if (target === "address") return { address: person };
  return person;
}

type EditorValidation = {
  errors: Record<string, string>;
  parsed: ReturnType<typeof studentUpdateContactInputSchema.safeParse> | null;
};

function validateFieldValues(
  values: Record<string, string>,
  person: Record<string, string | null>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if ("fullName" in values && !values.fullName?.trim())
    errors.fullName = "Informe o nome completo.";
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(values.email))
    errors.email = "Informe um e-mail válido.";
  if (values.birthDate) {
    const birthDate = parseDateBR(values.birthDate);
    if (birthDate) person.birthDate = birthDate;
    else errors.birthDate = "Informe uma data válida.";
  }
  if (values.documentNumber && !values.documentType) errors.documentType = "Escolha CPF ou RG.";
  return errors;
}

function validateEditorValues({
  profile,
  target,
  values,
}: {
  profile: StudentProfile;
  target: RegistrationEditTarget;
  values: Record<string, string>;
}): EditorValidation {
  const person = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, emptyToNull(value)]),
  );
  const errors = validateFieldValues(values, person);
  const parsed =
    target === "notes"
      ? null
      : studentUpdateContactInputSchema.safeParse(contactInput({ profile, target, person }));
  if (parsed && !parsed.success)
    for (const issue of parsed.error.issues) errors[String(issue.path.at(-1))] ??= issue.message;
  return { errors, parsed };
}
type SaveArgs = EditorProps & {
  values: Record<string, string>;
  saving: boolean;
  form: RefObject<HTMLFormElement | null>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
  setFailure: Dispatch<SetStateAction<string>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
};

function useEditorSave(args: SaveArgs): () => Promise<void> {
  const contact = trpc.students.updateContact.useMutation();
  const notes = trpc.students.updateNotes.useMutation();
  const utils = trpc.useUtils();
  return async () => {
    if (args.saving) return;
    const validation = validateEditorValues({
      profile: args.profile,
      target: args.target,
      values: args.values,
    });
    if (Object.keys(validation.errors).length > 0) {
      args.setErrors(validation.errors);
      requestAnimationFrame(() => {
        const invalid = args.form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        (invalid?.querySelector<HTMLElement>("button:not(:disabled)") ?? invalid)?.focus();
      });
      return;
    }
    args.setSaving(true);
    args.onBusyChange(true);
    args.setFailure("");
    try {
      if (args.target === "notes")
        await notes.mutateAsync({
          id: args.profile.id,
          notes: emptyToNull(args.values.notes ?? ""),
        });
      else if (validation.parsed?.success)
        await contact.mutateAsync({ id: args.profile.id, input: validation.parsed.data });
      await Promise.all([
        utils.students.byId.invalidate({ id: args.profile.id }),
        utils.students.list.invalidate(),
      ]);
      args.onDirtyChange(false);
      args.onSaved();
    } catch (error) {
      args.setFailure(
        error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      args.setSaving(false);
      args.onBusyChange(false);
    }
  };
}

function useEditorModel(props: EditorProps): EditorModel {
  const [initial] = useState(() => initialValues(props.profile, props.target));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")?.focus();
  }, []);
  function change(key: string, value: string): void {
    const next = { ...values, [key]: value };
    setValues(next);
    setErrors((current) => ({ ...current, [key]: "" }));
    setFailure("");
    props.onDirtyChange(Object.keys(next).some((field) => next[field] !== initial[field]));
  }
  const save = useEditorSave({ ...props, values, saving, form, setErrors, setFailure, setSaving });
  return { form, values, errors, failure, saving, change, save };
}

export function RegistrationEditor(props: EditorProps): ReactElement {
  const { target, onCancel } = props;
  const { form, values, errors, failure, saving, change, save } = useEditorModel(props);
  return (
    <form
      ref={form}
      className={styles.editor}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h3 className={styles.sectionTitle}>Editar {TITLES[target].toLocaleLowerCase("pt-BR")}</h3>
      <EditorFields
        target={target}
        saving={saving}
        values={values}
        errors={errors}
        onChange={change}
      />
      {failure && <Alert variant="destructive">{failure}</Alert>}
      <div className={styles.editActions}>
        <Button variant="ghost" type="button" disabled={saving} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}

type EditorFieldsProps = {
  target: RegistrationEditTarget;
  saving: boolean;
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

function editorFieldNames(target: RegistrationEditTarget): string[] {
  if (target === "address") return [...ADDRESS_FIELDS];
  if (target === "notes") return [];
  return [
    "fullName",
    target === "student" ? "birthDate" : "relationship",
    "phone",
    "documentType",
    "documentNumber",
    "email",
  ];
}

function EditorFields(props: EditorFieldsProps): ReactElement {
  return (
    <fieldset disabled={props.saving} className={styles.editFields}>
      <legend className="sr-only">{TITLES[props.target]}</legend>
      {editorFieldNames(props.target).map((key) =>
        key === "documentType" ? (
          <DocumentTypeField key={key} {...props} />
        ) : (
          <EditorTextField key={key} name={key} {...props} />
        ),
      )}
      {props.target === "notes" && <EditorNotesField {...props} />}
    </fieldset>
  );
}

function DocumentTypeField({ values, errors, onChange }: EditorFieldsProps): ReactElement {
  return (
    <Field className="registration-edit-field">
      <Label id="registration-document-type">Documento</Label>
      <SegmentedControl
        size="sm"
        aria-labelledby="registration-document-type"
        aria-describedby={errors.documentType ? "registration-error-documentType" : undefined}
        value={values.documentType || null}
        invalid={Boolean(errors.documentType)}
        onValueChange={(value) => onChange("documentType", value ?? "")}
      >
        <SegmentedControlItem value="CPF">CPF</SegmentedControlItem>
        <SegmentedControlItem value="RG">RG</SegmentedControlItem>
      </SegmentedControl>
      {errors.documentType && (
        <p id="registration-error-documentType" className={styles.fieldError}>
          {errors.documentType}
        </p>
      )}
    </Field>
  );
}

function editorInputMode(name: string): "tel" | "numeric" | "email" | "text" {
  if (name === "phone") return "tel";
  if (name === "birthDate" || name === "postalCode") return "numeric";
  if (name === "email") return "email";
  return "text";
}

function normalizeEditorValue(name: string, value: string): string {
  if (name === "phone") return maskPhoneBR(value);
  if (name === "birthDate") return maskDateBR(value);
  return value;
}

function EditorTextField({
  name,
  values,
  errors,
  onChange,
}: EditorFieldsProps & { name: string }): ReactElement {
  return (
    <Field
      className="registration-edit-field"
      data-wide={name === "fullName" || name === "email" || name === "street"}
    >
      <Label htmlFor={`registration-${name}`}>{FIELDS[name]![0]}</Label>
      <Input
        id={`registration-${name}`}
        name={name}
        autoComplete="off"
        size="sm"
        placeholder={FIELDS[name]![1]}
        value={values[name] ?? ""}
        invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `registration-error-${name}` : undefined}
        inputMode={editorInputMode(name)}
        onChange={(event) => onChange(name, normalizeEditorValue(name, event.target.value))}
      />
      {errors[name] && (
        <p id={`registration-error-${name}`} className={styles.fieldError}>
          {errors[name]}
        </p>
      )}
    </Field>
  );
}

function EditorNotesField({ values, onChange }: EditorFieldsProps): ReactElement {
  return (
    <Field className="registration-edit-field" data-wide="true">
      <Label htmlFor="registration-notes">Observações</Label>
      <Textarea
        id="registration-notes"
        name="notes"
        autoComplete="off"
        placeholder="Informações relevantes para o cadastro"
        value={values.notes ?? ""}
        onChange={(event) => onChange("notes", event.target.value)}
      />
    </Field>
  );
}
