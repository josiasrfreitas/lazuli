"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
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
import { maskPhoneBR } from "~/lib/masks";
import { PersonDocumentField } from "~/components/person-document-field";
import { TeacherEmploymentFields } from "./teacher-employment-fields";
import type { TeacherDraft } from "./teacher-form";
import { useTeacherForm } from "./teacher-form";

import { Camera, Paperclip, KeyRound } from "lucide-react";
import { useTeacherDocuments } from "./use-teacher-documents";
import { TeacherDocumentPanel } from "./teacher-document-panel";
import styles from "./teacher-form.module.css";
const PANEL_EXIT_DELAY_MS = 160;
type TeacherDocuments = ReturnType<typeof useTeacherDocuments>;
type Teacher = RouterOutputs["teachers"]["byId"];
export function TeacherDialog({ teacher, onClose }: TeacherDialogInput): ReactElement {
  const documents = useTeacherDocuments(teacher?.id);
  const { photoInput, photoError, changePhoto } = useTeacherPhotoInput(documents);
  const [attachments, setAttachments] = useState(false);
  const panelVisible = useAttachmentPresence(attachments);

  const { departed, draft, errors, failure, body, first, pending, change, submit } = useTeacherForm(
    { teacher, onClose, documentSessionId: documents.session?.id },
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
          className="md:max-w-3xl data-[documents]:md:max-w-7xl"
          data-teacher-form-dialog
          data-documents={panelVisible || undefined}
        >
          <TeacherDialogHeader
            teacher={teacher}
            documents={documents}
            pending={pending || documents.busy}
            photoInput={photoInput}
            onPhotoChange={changePhoto}
            onToggleAttachments={() => setAttachments(!attachments)}
          />
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
              <div className={`${styles.panelMotion}`} data-open={attachments} inert={!attachments}>
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
      <Field>
        <Label htmlFor="teacher-phone">Telefone</Label>
        <Input
          id="teacher-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="(00) 00000-0000"
          size="compact-responsive"
          value={props.draft.phone}
          invalid={Boolean(props.errors.phone)}
          onChange={(event) => props.change("phone", maskPhoneBR(event.target.value))}
        />
        {props.errors.phone && <FieldError match>{props.errors.phone}</FieldError>}
      </Field>
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
    <div className="grid gap-2">
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
        <PersonDocumentField
          requiredCpf
          name="cpf"
          value={props.draft.cpf}
          error={props.errors.cpf}
          onChange={(document) => props.change("cpf", document.documentNumber)}
        />
      </div>
      <div className={styles.personalRow}>
        <TeacherContactFields draft={props.draft} errors={props.errors} change={props.change} />
      </div>
    </div>
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
    <DialogBody ref={props.body} className="my-2">
      <form id="teacher-form" noValidate onSubmit={props.submit} className="grid gap-3">
        <TeacherIdentityFields
          first={props.first}
          draft={props.draft}
          errors={props.errors}
          change={props.change}
        />
        <TeacherEmploymentFields draft={props.draft} errors={props.errors} change={props.change} />
        <FormSection
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="size-4" aria-hidden="true" />
              Acesso ao sistema
            </span>
          }
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

function useAttachmentPresence(attachments: boolean): boolean {
  const [panelPresent, setPanelPresent] = useState(false);
  useEffect(() => {
    if (attachments) setPanelPresent(true);
    else {
      const timer = setTimeout(() => setPanelPresent(false), PANEL_EXIT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [attachments]);
  return attachments || panelPresent;
}
function useTeacherPhotoInput(documents: TeacherDocuments): {
  photoInput: RefObject<HTMLInputElement | null>;
  photoError: string;
  changePhoto: (event: ChangeEvent<HTMLInputElement>) => void;
} {
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState("");
  const changePhoto = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    documents.setBusy(true);
    setPhotoError("");
    void documents
      .send({ kind: "PHOTO", label: "Foto do professor", file })
      .catch((error: Error) => {
        setPhotoError(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
      })
      .finally(() => {
        documents.setBusy(false);
        input.value = "";
      });
  };
  return { photoInput, photoError, changePhoto };
}
type TeacherDialogHeaderProps = {
  teacher: Teacher | undefined;
  documents: TeacherDocuments;
  pending: boolean;
  photoInput: RefObject<HTMLInputElement | null>;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleAttachments: () => void;
};
function TeacherDialogHeader({
  teacher,
  documents,
  pending,
  photoInput,
  onPhotoChange,
  onToggleAttachments,
}: TeacherDialogHeaderProps): ReactElement {
  return (
    <div className={styles.header}>
      <TeacherPhotoControl
        documents={documents}
        pending={pending}
        photoInput={photoInput}
        onPhotoChange={onPhotoChange}
      />
      <DialogHeader className="min-w-0 flex-1">
        <DialogTitle>{teacher ? "Editar professor" : "Novo professor"}</DialogTitle>
        <DialogDescription>
          Cadastre a pessoa para organizar suas turmas e horários.
        </DialogDescription>
      </DialogHeader>
      <Button variant="ghost" size="sm" disabled={pending} onClick={onToggleAttachments}>
        <Paperclip /> Anexos{documents.files.length > 0 ? ` (${documents.files.length})` : ""}
      </Button>
    </div>
  );
}
function TeacherPhotoControl({
  documents,
  pending,
  photoInput,
  onPhotoChange,
}: Pick<
  TeacherDialogHeaderProps,
  "documents" | "pending" | "photoInput" | "onPhotoChange"
>): ReactElement {
  const photo = documents.files.find((file) => file.kind === "PHOTO");
  return (
    <>
      <Button
        variant="secondary"
        size="icon-sm"
        className="size-14 shrink-0 rounded-full"
        aria-label="Enviar foto do professor"
        disabled={pending}
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
        onChange={onPhotoChange}
      />
    </>
  );
}
