"use client";

import type { ReactElement, ReactNode } from "react";
import { MapPin, Pencil, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { formatDateOnlyBR, toWhatsAppUrl } from "~/lib/format";
import type { StudentProfile } from "./logic";
import type { RegistrationEditTarget } from "./registration-editor";
import styles from "./student-registration.module.css";

const NOT_INFORMED = "Não informado";

export function RegistrationFactsSections({
  profile,
  onEdit,
}: {
  profile: StudentProfile;
  onEdit: (target: RegistrationEditTarget) => void;
}): ReactElement {
  return (
    <>
      <section className={styles.section}>
        <SectionHeading title="Dados do aluno" icon={UserRound} target="student" onEdit={onEdit} />
        <StudentContactFacts profile={profile} />
      </section>
      <section className={styles.section}>
        <SectionHeading title="Responsável" icon={UsersRound} target="guardian" onEdit={onEdit} />
        {profile.guardian ? (
          <GuardianContact guardian={profile.guardian} />
        ) : (
          <p className={styles.supporting}>Nenhum responsável informado.</p>
        )}
      </section>
      <section className={styles.section}>
        <SectionHeading title="Endereço" icon={MapPin} target="address" onEdit={onEdit} />
        <StudentAddress address={profile.address} />
      </section>
    </>
  );
}

export function RegistrationFactsLoading(): ReactElement {
  return (
    <>
      <section className={styles.section}>
        <SectionHeading title="Dados do aluno" icon={UserRound} target="student" />
        <dl className={styles.facts}>
          <ProfileFact label="Nome completo" wide>
            <InlineSkeleton className="w-48 max-w-full" />
          </ProfileFact>
          <ProfileFact label="Documento">
            <InlineSkeleton className="w-24 max-w-full" />
          </ProfileFact>
          <ProfileFact label="Nascimento">
            <InlineSkeleton className="w-20 max-w-full" />
          </ProfileFact>
          <ProfileFact label="Telefone">
            <InlineSkeleton className="w-24 max-w-full" />
          </ProfileFact>
          <ProfileFact label="E-mail" wide>
            <InlineSkeleton className="w-48 max-w-full" />
          </ProfileFact>
        </dl>
      </section>
      <section className={styles.section}>
        <SectionHeading title="Responsável" icon={UsersRound} target="guardian" />
        <GuardianContactLoading />
      </section>
      <section className={styles.section}>
        <SectionHeading title="Endereço" icon={MapPin} target="address" />
        <div className={styles.addressText}>
          <p>
            <InlineSkeleton className="w-56 max-w-full" />
          </p>
          <p className={styles.supporting}>
            <InlineSkeleton className="w-40 max-w-full" />
          </p>
          <p className={styles.supporting}>
            <InlineSkeleton className="w-24 max-w-full" />
          </p>
        </div>
      </section>
    </>
  );
}

function GuardianContactLoading(): ReactElement {
  return (
    <>
      <div className={styles.guardianName}>
        <p>
          <InlineSkeleton className="w-40 max-w-full" />
        </p>
        <span>
          <InlineSkeleton className="w-12" />
        </span>
      </div>
      <dl className={styles.facts}>
        <ProfileFact label="Documento">
          <InlineSkeleton className="w-24 max-w-full" />
        </ProfileFact>
        <ProfileFact label="Telefone">
          <InlineSkeleton className="w-24 max-w-full" />
        </ProfileFact>
        <ProfileFact label="E-mail" wide>
          <InlineSkeleton className="w-48 max-w-full" />
        </ProfileFact>
      </dl>
    </>
  );
}

function StudentContactFacts({ profile }: { profile: StudentProfile }): ReactElement {
  return (
    <dl className={styles.facts}>
      <ProfileFact label="Nome completo" wide>
        {profile.contact.fullName}
      </ProfileFact>
      <ProfileFact label={profile.contact.documentType ?? "Documento"}>
        {profile.contact.documentNumber ?? NOT_INFORMED}
      </ProfileFact>
      <ProfileFact label="Nascimento">
        {profile.contact.birthDate ? formatDateOnlyBR(profile.contact.birthDate) : NOT_INFORMED}
      </ProfileFact>
      <ProfileFact label="Telefone">
        <PhoneLink phone={profile.contact.phone} />
      </ProfileFact>
      <ProfileFact label="E-mail" wide>
        <EmailLink email={profile.contact.email} />
      </ProfileFact>
    </dl>
  );
}

function GuardianContact({
  guardian,
}: {
  guardian: NonNullable<StudentProfile["guardian"]>;
}): ReactElement {
  return (
    <>
      <div className={styles.guardianName}>
        <p>{guardian.fullName}</p>
        {guardian.relationship && <span>{guardian.relationship}</span>}
      </div>
      <dl className={styles.facts}>
        <ProfileFact label={guardian.documentType ?? "Documento"}>
          {guardian.documentNumber ?? NOT_INFORMED}
        </ProfileFact>
        <ProfileFact label="Telefone">
          <PhoneLink phone={guardian.phone} />
        </ProfileFact>
        <ProfileFact label="E-mail" wide>
          <EmailLink email={guardian.email} />
        </ProfileFact>
      </dl>
    </>
  );
}

function StudentAddress({ address }: { address: StudentProfile["address"] }): ReactElement {
  const street = addressStreetLine(address);
  const city = addressCityLine(address);
  return (
    <div className={styles.addressText}>
      <p>{street || NOT_INFORMED}</p>
      {city && <p className={styles.supporting}>{city}</p>}
      {address?.postalCode && <p className={styles.supporting}>CEP {address.postalCode}</p>}
    </div>
  );
}

function addressStreetLine(address: StudentProfile["address"]): string {
  return [address?.street, address?.number, address?.complement].filter(Boolean).join(", ");
}

function addressCityLine(address: StudentProfile["address"]): string {
  return [address?.neighborhood, [address?.city, address?.state].filter(Boolean).join(" / ")]
    .filter(Boolean)
    .join(" · ");
}

function ProfileFact({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}): ReactElement {
  return (
    <div className={styles.fact} data-wide={wide || undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SectionHeading({
  title,
  icon: Icon,
  target,
  onEdit,
}: {
  title: string;
  icon: LucideIcon;
  target: RegistrationEditTarget;
  onEdit?: (target: RegistrationEditTarget) => void;
}): ReactElement {
  return (
    <div className={styles.sectionHeading}>
      <h3 className={styles.sectionTitle}>
        <Icon aria-hidden="true" />
        {title}
      </h3>
      <Button
        size="icon-compact-responsive"
        variant="ghost"
        data-edit-section={target}
        aria-label={`Editar ${title.toLocaleLowerCase("pt-BR")}`}
        title={`Editar ${title.toLocaleLowerCase("pt-BR")}`}
        disabled={!onEdit}
        onClick={() => onEdit?.(target)}
      >
        <Pencil aria-hidden="true" />
      </Button>
    </div>
  );
}

function EmailLink({ email }: { email: string | null }): ReactElement {
  return (
    <>
      {email ? (
        <a className={styles.contactLink} href={`mailto:${email}`}>
          {email}
        </a>
      ) : (
        NOT_INFORMED
      )}
    </>
  );
}

function PhoneLink({ phone }: { phone: string | null }): ReactElement {
  const url = toWhatsAppUrl(phone);
  return (
    <>
      {url ? (
        <a
          className={styles.contactLink}
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Abrir conversa no WhatsApp"
        >
          {phone}
        </a>
      ) : (
        (phone ?? NOT_INFORMED)
      )}
    </>
  );
}
