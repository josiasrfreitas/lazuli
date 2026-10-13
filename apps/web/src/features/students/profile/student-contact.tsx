import type { ReactElement } from "react";
import { Mail, MessageCircle, UserRound } from "lucide-react";
import {
  Button,
  Sheet,
  SheetBackdrop,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "@lazuli/ui";
import { formatDateOnlyBR, toWhatsAppUrl } from "~/lib/format";
import type { StudentProfile } from "./logic";
import { ProfileFact } from "./profile-shared";

export function StudentContactButton({ profile }: { profile: StudentProfile }): ReactElement {
  return (
    <Sheet>
      <SheetTrigger
        aria-label="Cadastro completo"
        title="Cadastro completo"
        render={<Button variant="link" size="inline" />}
      >
        <UserRound aria-hidden="true" />
        <span>Cadastro completo</span>
      </SheetTrigger>
      <SheetPortal>
        <SheetBackdrop />
        <SheetContent closeLabel="Fechar cadastro">
          <SheetHeader>
            <SheetTitle>Cadastro e contato</SheetTitle>
            <SheetDescription>{profile.contact.fullName}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="grid gap-6 py-5">
              <StudentContactFacts profile={profile} />
              {profile.guardian && <GuardianContact guardian={profile.guardian} />}
              {profile.notes && (
                <section className="grid gap-2 border-t border-border pt-4">
                  <h3 className="text-base font-semibold">Observações do cadastro</h3>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {profile.notes}
                  </p>
                </section>
              )}
            </div>
          </SheetBody>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}

function StudentContactFacts({ profile }: { profile: StudentProfile }): ReactElement {
  return (
    <dl className="grid gap-4">
      <ProfileFact label="Nascimento">
        {profile.contact.birthDate ? formatDateOnlyBR(profile.contact.birthDate) : "Não informado"}
      </ProfileFact>
      <ProfileFact label="Telefone">{profile.contact.phone ?? "Não informado"}</ProfileFact>
      <ProfileFact label="E-mail">
        {profile.contact.email ? (
          <a className="text-interactive hover:underline" href={`mailto:${profile.contact.email}`}>
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
            profile.address.complement,
            profile.address.neighborhood,
            profile.address.city,
            profile.address.state,
            profile.address.postalCode,
          ]
            .filter(Boolean)
            .join(", ") || "Não informado"}
        </ProfileFact>
      )}
    </dl>
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
      <h3 className="text-base font-semibold">Responsável</h3>
      <div>
        <p className="font-medium">{guardian.fullName}</p>
        {guardian.relationship && (
          <p className="text-caption text-muted-foreground">{guardian.relationship}</p>
        )}
      </div>
      {guardian.phone && <p className="text-sm">{guardian.phone}</p>}
      {guardian.email && (
        <p className="break-all text-sm text-muted-foreground">{guardian.email}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {whatsapp && (
          <Button
            nativeButton={false}
            size="compact-responsive"
            variant="secondary"
            render={<a href={whatsapp} target="_blank" rel="noreferrer" />}
          >
            <MessageCircle aria-hidden="true" /> WhatsApp do responsável
          </Button>
        )}
        {guardian.email && (
          <Button
            nativeButton={false}
            size="compact-responsive"
            variant="ghost"
            render={<a href={`mailto:${guardian.email}`} />}
          >
            <Mail aria-hidden="true" /> E-mail
          </Button>
        )}
      </div>
    </section>
  );
}
