"use client";
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
export function TeacherDialog({ teacher, onClose }: { teacher?: Teacher; onClose: () => void }) {
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
          <DialogBody ref={body} className="my-5">
            <form id="teacher-form" noValidate onSubmit={submit} className="grid gap-5">
              <FormSection title="Dados do professor">
                <Field>
                  <Label htmlFor="teacher-name">Nome completo</Label>
                  <Input
                    ref={first}
                    id="teacher-name"
                    name="name"
                    placeholder="Nome completo do professor"
                    autoComplete="off"
                    size="compact-responsive"
                    value={draft.name}
                    invalid={Boolean(errors.name)}
                    onChange={(event) => change("name", event.target.value)}
                  />
                  {errors.name && <FieldError match>{errors.name}</FieldError>}
                </Field>
                <FormRow columns={3}>
                  <PersonDocumentField
                    requiredCpf
                    name="cpf"
                    value={draft.cpf}
                    error={errors.cpf}
                    onChange={(document) => change("cpf", document.documentNumber)}
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
                      value={draft.email}
                      invalid={Boolean(errors.email)}
                      onChange={(event) => change("email", event.target.value)}
                    />
                    {errors.email && <FieldError match>{errors.email}</FieldError>}
                  </Field>
                </FormRow>
              </FormSection>
              <FormSection
                title="Acesso ao sistema"
                description="O professor pode receber turmas e substituições mesmo sem acesso."
              >
                <Field className="flex items-center gap-3">
                  <Switch
                    id="teacher-access"
                    name="isEnabled"
                    disabled={departed || pending}
                    checked={!departed && draft.isEnabled}
                    onCheckedChange={(value) => change("isEnabled", value)}
                  />
                  <Label htmlFor="teacher-access">Habilitar acesso ao sistema</Label>
                </Field>
              </FormSection>
              {departed && (
                <Alert variant="neutral">
                  O encerramento da atuação bloqueia o acesso ao sistema.
                </Alert>
              )}
              {failure && <Alert variant="destructive">{failure}</Alert>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button
              size="compact-responsive"
              variant="secondary"
              disabled={pending}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button size="compact-responsive" type="submit" form="teacher-form" disabled={pending}>
              {pending ? "Salvando…" : teacher ? "Salvar alterações" : "Cadastrar professor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
