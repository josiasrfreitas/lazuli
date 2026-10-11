import type { ReactElement } from "react";
import { Mail, MessageCircle, UserRound } from "lucide-react";
import { Avatar, Badge, Button } from "@lazuli/ui";
import { formatDateOnlyBR, toWhatsAppUrl } from "~/lib/format";
import { statusBadgeVm } from "../view-model";
import type { StudentProfile } from "./logic";
import { ProfileFact } from "./profile-shared";

export function StudentHeader({ profile }: { profile: StudentProfile }): ReactElement {
  const status = statusBadgeVm(profile.contact.status as Parameters<typeof statusBadgeVm>[0]);
  return (
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-6">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar name={profile.contact.fullName} colorKey={profile.id} size="lg" />
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
              Perfil do aluno
            </span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
            {profile.contact.fullName}
          </h1>
        </div>
      </div>
      {profile.whatsAppUrl && (
        <Button
          nativeButton={false}
          render={<a href={profile.whatsAppUrl} target="_blank" rel="noreferrer" />}
        >
          <MessageCircle aria-hidden="true" />
          Conversar no WhatsApp
        </Button>
      )}
    </header>
  );
}
export function StudentContact({ profile }: { profile: StudentProfile }): ReactElement {
  return (
    <aside
      aria-label="Cadastro e contato"
      className="grid gap-6 rounded-xl border border-border bg-card p-5"
    >
      <section className="grid gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <UserRound aria-hidden="true" className="size-4 text-muted-foreground" />
          Dados do aluno
        </h2>
        <dl className="grid gap-4">
          <ProfileFact label="Nascimento">
            {profile.contact.birthDate
              ? formatDateOnlyBR(profile.contact.birthDate)
              : "Não informado"}
          </ProfileFact>
          <ProfileFact label="Telefone">{profile.contact.phone ?? "Não informado"}</ProfileFact>
          <ProfileFact label="E-mail">
            {profile.contact.email ? (
              <a
                className="text-interactive hover:underline"
                href={`mailto:${profile.contact.email}`}
              >
                {profile.contact.email}
              </a>
            ) : (
              "Não informado"
            )}
          </ProfileFact>
          {profile.address && (
            <ProfileFact label="Endereço">
              {[
                profile.address.street,
                profile.address.number,
                profile.address.neighborhood,
                profile.address.city,
                profile.address.state,
              ]
                .filter(Boolean)
                .join(", ") || "Não informado"}
            </ProfileFact>
          )}
        </dl>
      </section>
      {profile.guardian && <GuardianContact guardian={profile.guardian} />}
      {profile.notes && (
        <section className="grid gap-2 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">Observações do cadastro</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {profile.notes}
          </p>
        </section>
      )}
    </aside>
  );
}
function GuardianContact({
  guardian,
}: {
  guardian: NonNullable<StudentProfile["guardian"]>;
}): ReactElement {
  const whatsapp = toWhatsAppUrl(guardian.phone);
  return (
    <section className="grid gap-3 border-t border-border pt-4">
      <h2 className="text-sm font-semibold">Responsável</h2>
      <div>
        <p className="text-sm font-medium">{guardian.fullName}</p>
        {guardian.relationship && (
          <p className="text-caption text-muted-foreground">{guardian.relationship}</p>
        )}
      </div>
      {guardian.phone && <p className="text-sm">{guardian.phone}</p>}
      <div className="flex flex-wrap gap-2">
        {whatsapp && (
          <Button
            nativeButton={false}
            size="sm"
            variant="secondary"
            render={<a href={whatsapp} target="_blank" rel="noreferrer" />}
          >
            <MessageCircle aria-hidden="true" />
            WhatsApp
          </Button>
        )}
        {guardian.email && (
          <Button
            nativeButton={false}
            size="sm"
            variant="ghost"
            render={<a href={`mailto:${guardian.email}`} />}
          >
            <Mail aria-hidden="true" />
            E-mail
          </Button>
        )}
      </div>
    </section>
  );
}
