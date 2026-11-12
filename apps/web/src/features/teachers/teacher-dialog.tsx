"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
  type ReactElement,
} from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  ToastAlert,
  Alert,
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
  FormSection,
  Input,
  Label,
  Switch,
} from "@lazuli/ui";
import { PersonDocumentField } from "~/components/person-document-field";
import { TeacherEmploymentFields } from "./teacher-employment-fields";
import type { TeacherDraft } from "./teacher-form";
import { useTeacherForm } from "./teacher-form";

import { Camera, Paperclip } from "lucide-react";
import { useTeacherDocuments } from "./use-teacher-documents";
import { TeacherDocumentPanel } from "./teacher-document-panel";
import styles from "./teacher-form.module.css";
import documentStyles from "~/features/student-documents/documents.module.css";
type Teacher = RouterOutputs["teachers"]["byId"];
export function TeacherDialog({ teacher, onClose }: TeacherDialogInput): ReactElement {
  const documents = useTeacherDocuments(teacher?.id);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState("");
  const photo = documents.files.find((file) => file.kind === "PHOTO");
  const [attachments, setAttachments] = useState(false);
  const [panelPresent, setPanelPresent] = useState(false);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (attachments) setPanelPresent(true);
    else {
      const timer = setTimeout(() => setPanelPresent(false), 160);
      return () => clearTimeout(timer);
    }
  }, [attachments]);
  useEffect(() => {
    setResizing(true);
    const timer = setTimeout(() => setResizing(false), 240);
    return () => clearTimeout(timer);
  }, [attachments, panelPresent]);
  const panelVisible = attachments || panelPresent;

  const { departed, draft, errors, failure, body, first, pending, change, submit } = useTeacherForm(
    teacher,
    onClose,
    documents.session?.id,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending && !documents.busy) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          initialFocus={first}
          className={`enrollment-dialog-motion ${styles.dialog} ${panelVisible ? "md:max-w-6xl" : "md:max-w-3xl"}`}
          data-resizing={resizing}
        >
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              className="size-14 shrink-0 rounded-full"
              aria-label="Enviar foto do professor"
              disabled={pending || documents.busy}
              onClick={() => photoInput.current?.click()}
            >
              {photo ? (
                <img
                  className={styles.photo}
                  src={`/api/teacher-files/${photo.id}`}
                  alt="Foto do professor"
                />
              ) : (
                <Camera />
              )}
            </Button>
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                documents.setBusy(true);
                setPhotoError("");
                try {
                  await documents.send({ kind: "PHOTO", label: "Foto do professor", file });
                } catch (error) {
                  setPhotoError(
                    error instanceof Error ? error.message : "Não foi possível enviar a foto.",
                  );
                } finally {
                  documents.setBusy(false);
                  event.target.value = "";
                }
              }}
            />
            <DialogHeader className="min-w-0 flex-1">
              <DialogTitle>{teacher ? "Editar professor" : "Novo professor"}</DialogTitle>
              <DialogDescription>
                Cadastre a pessoa para organizar suas turmas e horários.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || documents.busy}
              onClick={() => setAttachments(!attachments)}
            >
              <Paperclip /> Anexos{documents.files.length ? ` (${documents.files.length})` : ""}
            </Button>
          </div>
          {photoError && <ToastAlert variant="destructive">{photoError}</ToastAlert>}
          <div className={styles.layout} data-documents={panelVisible}>
            <TeacherFormBody
              body={body}
              submit={(event) => {
                if (documents.busy) event.preventDefault();
                else submit(event);
              }}
              first={first}
              draft={draft}
              errors={errors}
              change={change}
              departed={departed}
              pending={pending || documents.busy}
              failure={failure}
            />
            {panelVisible && (
              <div
                className={`${documentStyles.sidePanel} ${styles.panelMotion}`}
                data-open={attachments}
                inert={!attachments}
              >
                <TeacherDocumentPanel documents={documents} onClose={() => setAttachments(false)} />
              </div>
            )}
          </div>
          <TeacherFormFooter
            pending={pending || documents.busy}
            onClose={onClose}
            teacher={teacher}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type TeacherFormFooterProps = {
  pending: boolean;
  onClose: () => void;
  teacher:
    | {
        today: string;
        studentCount: number;
        teacherProfile: { cpf: string | null; departureDate: Date | null } | null;
        id: string;
        email: string;
        name: string;
        isEnabled: boolean;
      }
    | undefined;
};
function TeacherFormFooter(props: TeacherFormFooterProps): ReactElement {
  return (
    <DialogFooter>
      <Button
        size="compact-responsive"
        variant="secondary"
        disabled={props.pending}
        onClick={props.onClose}
      >
        Cancelar
      </Button>
      <Button size="compact-responsive" type="submit" form="teacher-form" disabled={props.pending}>
        {teacherSaveLabel(props)}
      </Button>
    </DialogFooter>
  );
}

type TeacherContactFieldsProps = {
  draft: TeacherDraft;
  errors: Record<string, string>;
  change: <Key extends keyof TeacherDraft>(key: Key, value: TeacherDraft[Key]) => void;
};
function TeacherContactFields(props: TeacherContactFieldsProps): ReactElement {
  return (
    <>
      <PersonDocumentField
        requiredCpf
        name="cpf"
        value={props.draft.cpf}
        error={props.errors.cpf}
        onChange={(document) => props.change("cpf", document.documentNumber)}
      />
      <Field>
        <Label htmlFor="teacher-email">E-mail</Label>
        <Input
          id="teacher-email"
          name="email"
          type="email"
          placeholder="nome@exemplo.com"
          autoComplete="off"
          size="compact-responsive"
          value={props.draft.email}
          invalid={Boolean(props.errors.email)}
          onChange={(event) => props.change("email", event.target.value)}
        />
        {props.errors.email && <FieldError match>{props.errors.email}</FieldError>}
      </Field>
    </>
  );
}

type TeacherIdentityFieldsProps = {
  first: RefObject<HTMLInputElement | null>;
  draft: TeacherDraft;
  errors: Record<string, string>;
  change: <Key extends keyof TeacherDraft>(key: Key, value: TeacherDraft[Key]) => void;
};
function TeacherIdentityFields(props: TeacherIdentityFieldsProps): ReactElement {
  return (
    <FormSection title="Dados do professor">
      <div className={styles.personalRow}>
        <Field>
          <Label htmlFor="teacher-name">Nome completo</Label>
          <Input
            ref={props.first}
            id="teacher-name"
            name="name"
            placeholder="Nome completo do professor"
            autoComplete="off"
            size="compact-responsive"
            value={props.draft.name}
            invalid={Boolean(props.errors.name)}
            onChange={(event) => props.change("name", event.target.value)}
          />
          {props.errors.name && <FieldError match>{props.errors.name}</FieldError>}
        </Field>
        <TeacherContactFields draft={props.draft} errors={props.errors} change={props.change} />
      </div>
    </FormSection>
  );
}

type TeacherFormBodyProps = {
  body: RefObject<HTMLDivElement | null>;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  first: RefObject<HTMLInputElement | null>;
  draft: TeacherDraft;
  errors: Record<string, string>;
  change: <Key extends keyof TeacherDraft>(key: Key, value: TeacherDraft[Key]) => void;
  departed: boolean;
  pending: boolean;
  failure: string | null;
};
function TeacherFormBody(props: TeacherFormBodyProps): ReactElement {
  return (
    <DialogBody ref={props.body} className="my-3">
      <form id="teacher-form" noValidate onSubmit={props.submit} className="grid gap-4">
        <TeacherIdentityFields
          first={props.first}
          draft={props.draft}
          errors={props.errors}
          change={props.change}
        />
        <TeacherEmploymentFields draft={props.draft} errors={props.errors} change={props.change} />
        <FormSection
          title="Acesso ao sistema"
          description="O professor pode receber turmas e substituições mesmo sem acesso."
        >
          <Field className="flex items-center gap-3">
            <Switch
              id="teacher-access"
              name="isEnabled"
              disabled={props.departed || props.pending}
              checked={!props.departed && props.draft.isEnabled}
              onCheckedChange={(value) => props.change("isEnabled", value)}
            />
            <Label htmlFor="teacher-access">Habilitar acesso ao sistema</Label>
          </Field>
        </FormSection>
        {props.departed && (
          <Alert variant="neutral">O encerramento da atuação bloqueia o acesso ao sistema.</Alert>
        )}
        {props.failure && <ToastAlert variant="destructive">{props.failure}</ToastAlert>}
      </form>
    </DialogBody>
  );
}

type TeacherDialogInput = {
  teacher?: Teacher;
  onClose: () => void;
};

function teacherSaveLabel(props: TeacherFormFooterProps): string {
  if (props.pending) return "Salvando…";
  return props.teacher ? "Salvar alterações" : "Cadastrar professor";
}
