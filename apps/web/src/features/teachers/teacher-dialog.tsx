"use client";
import type { FormEvent, RefObject, ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
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
  FormRow,
  FormSection,
  Input,
  Label,
  Switch,
} from "@lazuli/ui";
import { PersonDocumentField } from "~/components/person-document-field";
import { useTeacherForm } from "./teacher-form";

type Teacher = RouterOutputs["teachers"]["byId"];
export function TeacherDialog({ teacher, onClose }: TeacherDialogInput): ReactElement {
  const { departed, draft, errors, failure, body, first, pending, change, submit } = useTeacherForm(
    teacher,
    onClose,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent initialFocus={first}>
          <DialogHeader>
            <DialogTitle>{teacher ? "Editar professor" : "Novo professor"}</DialogTitle>
            <DialogDescription>
              Cadastre a pessoa para organizar suas turmas e horários.
            </DialogDescription>
          </DialogHeader>
          <TeacherFormBody
            body={body}
            submit={submit}
            first={first}
            draft={draft}
            errors={errors}
            change={change}
            departed={departed}
            pending={pending}
            failure={failure}
          />
          <TeacherFormFooter pending={pending} onClose={onClose} teacher={teacher} />
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
  draft: { name: string; email: string; cpf: string; isEnabled: boolean };
  errors: Record<string, string>;
  change: <Key extends "email" | "name" | "isEnabled" | "cpf">(
    key: Key,
    value: { name: string; email: string; cpf: string; isEnabled: boolean }[Key],
  ) => void;
};
function TeacherContactFields(props: TeacherContactFieldsProps): ReactElement {
  return (
    <FormRow columns={3}>
      <PersonDocumentField
        requiredCpf
        name="cpf"
        value={props.draft.cpf}
        error={props.errors.cpf}
        onChange={(document) => props.change("cpf", document.documentNumber)}
      />
      <Field className="sm:col-span-2">
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
    </FormRow>
  );
}

type TeacherIdentityFieldsProps = {
  first: RefObject<HTMLInputElement | null>;
  draft: { name: string; email: string; cpf: string; isEnabled: boolean };
  errors: Record<string, string>;
  change: <Key extends "email" | "name" | "isEnabled" | "cpf">(
    key: Key,
    value: { name: string; email: string; cpf: string; isEnabled: boolean }[Key],
  ) => void;
};
function TeacherIdentityFields(props: TeacherIdentityFieldsProps): ReactElement {
  return (
    <FormSection title="Dados do professor">
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
    </FormSection>
  );
}

type TeacherFormBodyProps = {
  body: RefObject<HTMLDivElement | null>;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  first: RefObject<HTMLInputElement | null>;
  draft: { name: string; email: string; cpf: string; isEnabled: boolean };
  errors: Record<string, string>;
  change: <Key extends "email" | "name" | "isEnabled" | "cpf">(
    key: Key,
    value: { name: string; email: string; cpf: string; isEnabled: boolean }[Key],
  ) => void;
  departed: boolean;
  pending: boolean;
  failure: string | null;
};
function TeacherFormBody(props: TeacherFormBodyProps): ReactElement {
  return (
    <DialogBody ref={props.body} className="my-5">
      <form id="teacher-form" noValidate onSubmit={props.submit} className="grid gap-5">
        <TeacherIdentityFields
          first={props.first}
          draft={props.draft}
          errors={props.errors}
          change={props.change}
        />
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
        {props.failure && <Alert variant="destructive">{props.failure}</Alert>}
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
