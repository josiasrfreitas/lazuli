"use client";

import { ArrowUpRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button, Field, FieldError, Input, Label } from "@lazuli/ui";

export type LoginMode =
  | "password"
  | "magic-link"
  | "register"
  | "recover"
  | "reset"
  | "set-password";

type FormErrors = { email?: string | undefined; password?: string | undefined };
const SET_PASSWORD_MODE = "set-password";
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function isCreatingPassword(mode: LoginMode): boolean {
  return mode === "reset" || mode === SET_PASSWORD_MODE;
}

function firstInvalidField(errors: FormErrors): "email" | "password" | null {
  if (errors.email) return "email";
  if (errors.password) return "password";
  return null;
}

function handleLoginFormSubmit({
  event,
  mode,
  pending,
  setErrors,
  onSubmit,
}: {
  event: FormEvent<HTMLFormElement>;
  mode: LoginMode;
  pending: boolean;
  setErrors: (errors: FormErrors) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}): void {
  event.preventDefault();
  if (pending) return;
  const invalid = validateFields(event.currentTarget, mode);
  setErrors(invalid);
  const first = firstInvalidField(invalid);
  if (first) {
    event.currentTarget.querySelector<HTMLInputElement>(`input[name="${first}"]`)?.focus();
    return;
  }
  onSubmit(event);
}

const SUBMIT_LABEL: Record<LoginMode, string> = {
  password: "Entrar",
  "magic-link": "Receber link de acesso",
  register: "Receber link para cadastrar senha",
  recover: "Receber link de recuperação",
  reset: "Salvar nova senha",
  "set-password": "Cadastrar minha senha",
};

export function LoginForm({
  mode,
  pending,
  email,
  setEmail,
  onSubmit,
  onModeChange,
  className,
}: {
  mode: LoginMode;
  pending: boolean;
  email: string;
  setEmail: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onModeChange: (mode: LoginMode) => void;
  className?: string | undefined;
}): ReactNode {
  const [errors, setErrors] = useState<FormErrors>({});
  const submit = (event: FormEvent<HTMLFormElement>): void =>
    handleLoginFormSubmit({ event, mode, pending, setErrors, onSubmit });

  return (
    <form className={className} noValidate onSubmit={submit} aria-busy={pending}>
      {!isCreatingPassword(mode) && (
        <EmailField
          email={email}
          setEmail={setEmail}
          pending={pending}
          error={errors.email}
          onClear={() => setErrors((current) => ({ ...current, email: undefined }))}
        />
      )}
      {(mode === "password" || isCreatingPassword(mode)) && (
        <PasswordField
          creating={isCreatingPassword(mode)}
          disabled={pending}
          error={errors.password}
          onRecover={() => onModeChange("recover")}
          onChange={() => setErrors((current) => ({ ...current, password: undefined }))}
        />
      )}
      <Button size="lg" type="submit" loading={pending} disabled={pending}>
        {SUBMIT_LABEL[mode]}
        <ArrowUpRight aria-hidden="true" />
      </Button>
      <ModeActions mode={mode} pending={pending} onModeChange={onModeChange} />
    </form>
  );
}

function EmailField({
  email,
  setEmail,
  pending,
  error,
  onClear,
}: {
  email: string;
  setEmail: (value: string) => void;
  pending: boolean;
  error: string | undefined;
  onClear: () => void;
}): ReactNode {
  return (
    <Field>
      <Label htmlFor="login-email" className="text-body text-marquee-foreground">
        Email institucional
      </Label>
      <Input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="voce@escola.com.br"
        size="compact-responsive"
        leadingIcon={<Mail aria-hidden="true" />}
        required
        disabled={pending}
        value={email}
        invalid={Boolean(error)}
        aria-describedby={error ? "login-email-error" : undefined}
        onChange={(event) => {
          setEmail(event.target.value);
          onClear();
        }}
      />
      {error && (
        <FieldError id="login-email-error" match>
          {error}
        </FieldError>
      )}
    </Field>
  );
}

function ModeActions({
  mode,
  pending,
  onModeChange,
}: {
  mode: LoginMode;
  pending: boolean;
  onModeChange: (mode: LoginMode) => void;
}): ReactNode {
  if (mode !== "password")
    return (
      <Button
        type="button"
        variant="text"
        disabled={pending}
        onClick={() => onModeChange("password")}
      >
        Voltar para o login
      </Button>
    );
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-caption leading-relaxed text-marquee-muted">
        Ainda não tem senha? Use seu email cadastrado na escola.
      </p>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={pending}
        onClick={() => onModeChange("magic-link")}
      >
        <Mail aria-hidden="true" /> Entrar por link no email
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        disabled={pending}
        onClick={() => onModeChange("register")}
      >
        <KeyRound aria-hidden="true" /> Cadastrar senha
      </Button>
    </div>
  );
}

function PasswordField({
  creating,
  disabled,
  error,
  onChange,
  onRecover,
}: {
  creating: boolean;
  disabled: boolean;
  error: string | undefined;
  onChange: () => void;
  onRecover: () => void;
}): ReactNode {
  const [visible, setVisible] = useState(false);
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="login-password" className="text-body text-marquee-foreground">
          {creating ? "Nova senha" : "Senha"}
        </Label>
        {!creating && (
          <Button
            type="button"
            variant="text"
            size="inline"
            disabled={disabled}
            onClick={onRecover}
          >
            Esqueci minha senha
          </Button>
        )}
      </div>
      <PasswordControl {...{ creating, disabled, error, onChange, visible, setVisible }} />
      {error && (
        <FieldError id="login-password-error" match>
          {error}
        </FieldError>
      )}
      {creating && !error && (
        <p id="password-help" className="text-caption text-muted-foreground">
          Mínimo de 8 caracteres.
        </p>
      )}
    </Field>
  );
}

function passwordDescriptionId(error: string | undefined, creating: boolean): string | undefined {
  if (error) return "login-password-error";
  if (creating) return "password-help";
  return undefined;
}

function PasswordControl({
  creating,
  disabled,
  error,
  onChange,
  visible,
  setVisible,
}: {
  creating: boolean;
  disabled: boolean;
  error: string | undefined;
  onChange: () => void;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}): ReactNode {
  return (
    <div className="relative min-w-0">
      <Input
        id="login-password"
        name="password"
        type={visible ? "text" : "password"}
        autoComplete={creating ? "new-password" : "current-password"}
        placeholder={creating ? "Mínimo de 8 caracteres" : "Sua senha"}
        minLength={creating ? MIN_PASSWORD_LENGTH : undefined}
        maxLength={MAX_PASSWORD_LENGTH}
        required
        disabled={disabled}
        size="compact-responsive"
        leadingIcon={<LockKeyhole aria-hidden="true" />}
        className="pr-11"
        invalid={Boolean(error)}
        onChange={onChange}
        aria-describedby={passwordDescriptionId(error, creating)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-compact-responsive"
        className="absolute right-0 top-0 text-muted-foreground hover:text-foreground"
        disabled={disabled}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}

function validateFields(form: HTMLFormElement, mode: LoginMode): FormErrors {
  const errors: FormErrors = {};
  const email = form.querySelector<HTMLInputElement>('input[name="email"]');
  const password = form.querySelector<HTMLInputElement>('input[name="password"]');
  if (email && (!email.value.trim() || !email.validity.valid))
    errors.email = "Informe um email válido, como voce@escola.com.br.";
  errors.password = passwordValidation(password, mode);
  return errors;
}

function passwordValidation(
  password: HTMLInputElement | null,
  mode: LoginMode,
): string | undefined {
  if (!password) return undefined;
  if (!password.value) return "Informe sua senha.";
  if (isCreatingPassword(mode) && password.value.length < MIN_PASSWORD_LENGTH)
    return "Mínimo de 8 caracteres.";
  if (password.value.length > MAX_PASSWORD_LENGTH) return "A senha é muito longa.";
  return undefined;
}
