import type { FormEvent, ReactNode } from "react";

import { Button, Field, Input, Label } from "@lazuli/ui";

import { marqueeActionClass } from "~/components/marquee/marquee-layout";

export type LoginPending = "none" | "magic-link" | "google";

export type LoginFormProps = {
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: LoginPending;
};

/**
 * The magic-link half of the card. `Field` wires the label and any validation
 * message to the control, so the marquee styling here is only about colour and
 * corners — the accessible plumbing comes from the primitive.
 */
export function LoginForm({ email, onEmailChange, onSubmit, pending }: LoginFormProps): ReactNode {
  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <Field>
        <Label className="font-mono text-micro uppercase tracking-eyebrow text-marquee-muted">
          Email institucional
        </Label>
        <Input
          autoComplete="email"
          /* text-body (16px): anything smaller makes iOS Safari zoom into the
             field on focus, and this is the product's front door. */
          className="h-control-lg rounded-none border-marquee-border bg-marquee-foreground/[0.03] text-body text-marquee-foreground placeholder:text-marquee-muted focus-visible:border-marquee-accent"
          disabled={pending !== "none"}
          name="email"
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="voce@escola.com.br"
          required
          type="email"
          value={email}
        />
      </Field>

      <Button className={marqueeActionClass} loading={pending === "magic-link"} type="submit">
        Receber link de acesso
      </Button>
    </form>
  );
}
