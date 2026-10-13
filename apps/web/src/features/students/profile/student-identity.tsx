import type { ReactElement, ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { statusBadgeVm } from "../view-model";
import type { StudentProfile } from "./logic";
import { StudentContactButton } from "./student-contact";

export function StudentHeader({
  profile,
  navigation,
}: {
  profile: StudentProfile;
  navigation: ReactNode;
}): ReactElement {
  const status = statusBadgeVm(profile.contact.status);
  return (
    <header className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 pb-2">
      <div className="mr-auto flex min-w-0 flex-wrap items-center gap-3">
        <h1 className="break-words font-display text-2xl font-medium tracking-tight text-heading sm:text-3xl">
          {profile.contact.fullName}
        </h1>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      {navigation}
    </header>
  );
}

export function StudentContactSummary({ profile }: { profile: StudentProfile }): ReactElement {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-1">
        <IdentityFact label="Nascimento">
          {profile.contact.birthDate
            ? formatDateOnlyBR(profile.contact.birthDate)
            : "Não informado"}
        </IdentityFact>
        <IdentityFact label="Telefone">
          {profile.contact.phone ? (
            <a
              className="inline-flex min-h-11 items-center hover:text-interactive sm:min-h-0"
              href={`tel:${profile.contact.phone}`}
            >
              {profile.contact.phone}
            </a>
          ) : (
            "Não informado"
          )}
        </IdentityFact>
        <IdentityFact label="E-mail">
          {profile.contact.email ? (
            <a
              className="inline-flex min-h-11 items-center break-all text-interactive hover:underline sm:min-h-0"
              href={`mailto:${profile.contact.email}`}
            >
              {profile.contact.email}
            </a>
          ) : (
            "Não informado"
          )}
        </IdentityFact>
        {profile.guardian && (
          <IdentityFact
            label={
              profile.guardian.relationship
                ? `Responsável (${profile.guardian.relationship})`
                : "Responsável"
            }
          >
            {profile.guardian.fullName}
          </IdentityFact>
        )}
      </dl>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
        {profile.whatsAppUrl && (
          <Button
            nativeButton={false}
            variant="link"
            size="inline"
            aria-label="WhatsApp do aluno"
            render={<a href={profile.whatsAppUrl} target="_blank" rel="noreferrer" />}
          >
            <MessageCircle aria-hidden="true" /> WhatsApp
          </Button>
        )}
        <StudentContactButton profile={profile} />
      </div>
    </div>
  );
}
function IdentityFact({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-base sm:text-sm">{children}</dd>
    </div>
  );
}
