"use client";

import { ArrowUpRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button, Field, FieldError, Input, Label } from "@lazuli/ui";

export type LoginMode = "password" | "magic-link" | "register" | "recover" | "reset" | "set-password";

type FormErrors = { email?: string | undefined; password?: string | undefined };

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

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) return;
    const invalid = validateFields(event.currentTarget, mode);
    setErrors(invalid);
    const first = invalid.email ? "email" : invalid.password ? "password" : null;
    if (first) {
      event.currentTarget.querySelector<HTMLInputElement>(`input[name="${first}"]`)?.focus();
      return;
    }
    onSubmit(event);
  }

  return (
    <form className={className} noValidate onSubmit={submit} aria-busy={pending}>
      {mode !== "reset" && mode !== "set-password" && (
        <Field>
          <Label htmlFor="login-email" className="text-body text-marquee-foreground">Email institucional</Label>
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
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
          />
          {errors.email && <FieldError id="login-email-error">{errors.email}</FieldError>}
        </Field>
      )}
      {(mode === "password" || mode === "reset" || mode === "set-password") && (
        <PasswordField
          creating={mode === "reset" || mode === "set-password"}
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
      {mode === "password" ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-caption leading-relaxed text-marquee-muted">Ainda não tem senha? Use seu email cadastrado na escola.</p>
          <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={() => onModeChange("magic-link")}>
            <Mail aria-hidden="true" />
            Entrar por link no email
          </Button>
          <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={() => onModeChange("register")}>
            <KeyRound aria-hidden="true" />
            Cadastrar senha
          </Button>
        </div>
      ) : (
        <Button type="button" variant="text" disabled={pending} onClick={() => onModeChange("password")}>
          Voltar para o login
        </Button>
      )}
    </form>
  );
}

function PasswordField({ creating, disabled, error, onChange, onRecover }: {
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
        <Label htmlFor="login-password" className="text-body text-marquee-foreground">{creating ? "Nova senha" : "Senha"}</Label>
        {!creating && (
          <Button type="button" variant="text" size="inline" disabled={disabled} onClick={onRecover}>
            Esqueci minha senha
          </Button>
        )}
      </div>
      <div className="relative min-w-0">
        <Input
          id="login-password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={creating ? "new-password" : "current-password"}
          placeholder={creating ? "Pelo menos 12 caracteres" : "Sua senha"}
          minLength={creating ? 12 : undefined}
          maxLength={128}
          required
          disabled={disabled}
          size="compact-responsive"
          leadingIcon={<LockKeyhole aria-hidden="true" />}
          className="pr-11"
          invalid={Boolean(error)}
          onChange={onChange}
          aria-describedby={error ? "login-password-error" : creating ? "password-help" : undefined}
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
      {error && <FieldError id="login-password-error">{error}</FieldError>}
      {creating && (
        <p id="password-help" className="text-caption text-muted-foreground">
          Use de 12 a 128 caracteres. Pode usar espaços.
        </p>
      )}
    </Field>
  );
}

function validateFields(form: HTMLFormElement, mode: LoginMode): FormErrors {
  const errors: FormErrors = {};
  const email = form.querySelector<HTMLInputElement>('input[name="email"]');
  const password = form.querySelector<HTMLInputElement>('input[name="password"]');
  if (email && (!email.value.trim() || !email.validity.valid)) errors.email = "Informe um email válido, como voce@escola.com.br.";
  if (password && !password.value) errors.password = "Informe sua senha.";
  else if (password && (mode === "reset" || mode === "set-password") && (password.value.length < 12 || password.value.length > 128)) errors.password = "Use de 12 a 128 caracteres para sua nova senha.";
  return errors;
}
