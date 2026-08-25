import type { ReactNode } from "react";

import { Button } from "@lazuli/ui";

export type MagicLinkSentProps = {
  email: string;
  onUseAnotherEmail: () => void;
};

/**
 * What the card becomes once a link is on its way. It replaces the form rather
 * than sitting above it: the next step is in the inbox, not on this screen, and
 * a still-visible form invites a second send that only invalidates the first.
 */
export function MagicLinkSent({ email, onUseAnotherEmail }: MagicLinkSentProps): ReactNode {
  return (
    <div className="flex flex-col" role="status">
      <p className="font-mono text-micro uppercase tracking-eyebrow text-marquee-accent">
        Link enviado
      </p>

      {/* The label hugs the sentence it announces; the action stands apart. */}
      <p className="mt-3 text-body leading-relaxed">
        Enviamos um link de acesso para <span className="font-semibold">{email}</span>.
      </p>

      <p className="mt-5 text-caption leading-relaxed text-marquee-muted">
        Abra o email e clique no link para entrar. Se ele não chegar em alguns minutos, confira a
        caixa de spam.
      </p>

      <Button className="mt-8 self-start" onClick={onUseAnotherEmail} size="lg" variant="secondary">
        Usar outro email
      </Button>
    </div>
  );
}
