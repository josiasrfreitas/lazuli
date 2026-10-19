import type { ReactElement, ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { Badge, Button, DetailHeader, DetailFacts, DetailFact } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { statusBadgeVm } from "../view-model";
import type { StudentProfile } from "./logic";
import { StudentContactButton } from "./student-contact";

const MISSING_CONTACT = "Não informado";

export function StudentStatus({ profile }: { profile: StudentProfile }): ReactElement {
  const status = statusBadgeVm(profile.contact.status);
  return <Badge variant={status.variant}>{status.label}</Badge>;
}

export function StudentHeader({
  profile,
  navigation,
}: {
  profile: StudentProfile;
  navigation: ReactNode;
}): ReactElement {
  const status = statusBadgeVm(profile.contact.status);
  return (
    <DetailHeader
      title={profile.contact.fullName}
      metadata={<Badge variant={status.variant}>{status.label}</Badge>}
      actions={navigation}
    />
  );
}

export function StudentContactSummary({
  profile,
  highlightWhatsApp = false,
}: {
  profile: StudentProfile;
  highlightWhatsApp?: boolean;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <StudentContactFacts profile={profile} />
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
        {profile.whatsAppUrl && (
          <Button
            nativeButton={false}
            variant="link"
            size="inline"
            className={
              highlightWhatsApp
                ? "text-warning hover:text-warning focus-visible:text-warning active:text-warning"
                : undefined
            }
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

function StudentContactFacts({ profile }: { profile: StudentProfile }): ReactElement {
  return (
    <DetailFacts>
      <DetailFact label="Nascimento">
        {profile.contact.birthDate ? formatDateOnlyBR(profile.contact.birthDate) : MISSING_CONTACT}
      </DetailFact>
      <DetailFact label="Telefone">
        {profile.contact.phone ? (
          <a
            className="inline-flex min-h-11 items-center hover:text-interactive sm:min-h-0"
            href={`tel:${profile.contact.phone}`}
          >
            {profile.contact.phone}
          </a>
        ) : (
          MISSING_CONTACT
        )}
      </DetailFact>
      <DetailFact label="E-mail">
        {profile.contact.email ? (
          <a
            className="inline-flex min-h-11 items-center break-all text-interactive hover:underline sm:min-h-0"
            href={`mailto:${profile.contact.email}`}
          >
            {profile.contact.email}
          </a>
        ) : (
          MISSING_CONTACT
        )}
      </DetailFact>
      {profile.guardian && (
        <DetailFact
          label={
            profile.guardian.relationship
              ? `Responsável (${profile.guardian.relationship})`
              : "Responsável"
          }
        >
          {profile.guardian.fullName}
        </DetailFact>
      )}
    </DetailFacts>
  );
}
