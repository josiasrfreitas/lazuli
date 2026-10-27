"use client";

import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { MapPin, NotebookPen, Pencil, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { formatDateOnlyBR, toWhatsAppUrl } from "~/lib/format";
import { statusBadgeVm } from "../view-model";
import type { StudentProfile } from "./logic";
import { RegistrationDocuments } from "./registration-documents";
import { RegistrationEditor, type RegistrationEditTarget } from "./registration-editor";
import styles from "./student-registration.module.css";

const NOT_INFORMED = "Não informado";

type RegistrationViewModel = {
  profile: StudentProfile;
  editTarget: RegistrationEditTarget | null;
  setEditTarget: Dispatch<SetStateAction<RegistrationEditTarget | null>>;
  setEditBusy: Dispatch<SetStateAction<boolean>>;
  dirty: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
  discard: "close" | "edit" | null;
  setDiscard: Dispatch<SetStateAction<"close" | "edit" | null>>;
  setUploadBusy: Dispatch<SetStateAction<boolean>>;
  setOpen: Dispatch<SetStateAction<boolean>>;
  mobileSection: string;
  setMobileSection: Dispatch<SetStateAction<string>>;
  detailsId: string;
  documentsId: string;
  title: RefObject<HTMLHeadingElement | null>;
  details: RefObject<HTMLDivElement | null>;
  finishEdit: () => void;
};
type RegistrationDialogModel = RegistrationViewModel & {
  open: boolean;
  editBusy: boolean;
  uploadBusy: boolean;
};

function finishRegistrationEdit({
  editTarget,
  setEditTarget,
  setDirty,
  details,
}: Pick<RegistrationViewModel, "editTarget" | "setEditTarget" | "setDirty" | "details">): void {
  setEditTarget(null);
  setDirty(false);
  requestAnimationFrame(() => {
    details.current
      ?.querySelector<HTMLButtonElement>(`[data-edit-section="${editTarget}"]`)
      ?.focus();
  });
}

function useRegistrationDialogModel(profile: StudentProfile): RegistrationDialogModel {
  const [editTarget, setEditTarget] = useState<RegistrationEditTarget | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState<"close" | "edit" | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState("details");
  const detailsId = useId();
  const documentsId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const details = useRef<HTMLDivElement>(null);
  const finishEdit = (): void =>
    finishRegistrationEdit({ editTarget, setEditTarget, setDirty, details });
  return {
    profile,
    open,
    editBusy,
    uploadBusy,
    editTarget,
    setEditTarget,
    setEditBusy,
    dirty,
    setDirty,
    discard,
    setDiscard,
    setUploadBusy,
    setOpen,
    mobileSection,
    setMobileSection,
    detailsId,
    documentsId,
    title,
    details,
    finishEdit,
  };
}

export function StudentContactButton({ profile }: { profile: StudentProfile }): ReactElement {
  const model = useRegistrationDialogModel(profile);
  return (
    <Dialog
      open={model.open}
      onOpenChange={(value) => {
        if (model.uploadBusy || model.editBusy) return;
        if (!value && model.dirty) {
          model.setDiscard("close");
          return;
        }
        if (value) model.setMobileSection("details");
        model.setOpen(value);
      }}
      onOpenChangeComplete={(value) => {
        if (!value) model.setEditTarget(null);
      }}
    >
      <DialogTrigger
        aria-label="Informações cadastrais"
        title="Informações cadastrais"
        render={<Button variant="link" size="inline" />}
      >
        <UserRound aria-hidden="true" />
        <span>Informações cadastrais</span>
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop className="student-registration-backdrop" />
        <RegistrationContent model={model} />
      </DialogPortal>
    </Dialog>
  );
}

function RegistrationContent({ model }: { model: RegistrationViewModel }): ReactElement {
  return (
    <DialogContent
      closeLabel="Fechar cadastro"
      initialFocus={model.title}
      className="student-registration-dialog"
    >
      <RegistrationHeader model={model} />
      <RegistrationMobileNavigation model={model} />
      <div className={styles.layout} data-mobile-section={model.mobileSection}>
        <RegistrationDetails model={model} />
        <div id={model.documentsId} className={styles.documentsPane}>
          <RegistrationDocuments studentId={model.profile.id} onBusyChange={model.setUploadBusy} />
        </div>
      </div>
      <RegistrationDiscard model={model} />
    </DialogContent>
  );
}

function RegistrationHeader({ model }: { model: RegistrationViewModel }): ReactElement {
  const { profile } = model;
  const status = statusBadgeVm(profile.contact.status);
  return (
    <div className={styles.header}>
      <Avatar name={profile.contact.fullName} colorKey={profile.id} size="lg" />
      <DialogHeader className="min-w-0 flex-1">
        <DialogTitle
          ref={model.title}
          tabIndex={-1}
          size="lg"
          className="outline-none [overflow-wrap:anywhere] [text-wrap:balance]"
        >
          {profile.contact.fullName}
        </DialogTitle>
        <div className={styles.headerMetadata}>
          <DialogDescription>Informações cadastrais</DialogDescription>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </DialogHeader>
    </div>
  );
}

function RegistrationMobileNavigation({ model }: { model: RegistrationViewModel }): ReactElement {
  return (
    <div className={styles.mobileNavigation}>
      <SegmentedControl
        aria-label="Seção do cadastro"
        value={model.mobileSection}
        onValueChange={(value) => {
          if (value) model.setMobileSection(value);
        }}
      >
        <SegmentedControlItem value="details" aria-controls={model.detailsId}>
          Dados cadastrais
        </SegmentedControlItem>
        <SegmentedControlItem value="documents" aria-controls={model.documentsId}>
          Documentos
        </SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
}

function RegistrationDetails({ model }: { model: RegistrationViewModel }): ReactElement {
  return (
    <div id={model.detailsId} ref={model.details} className={styles.details}>
      {model.editTarget ? (
        <RegistrationEditor
          key={model.editTarget}
          profile={model.profile}
          target={model.editTarget}
          onCancel={() => {
            if (model.dirty) model.setDiscard("edit");
            else model.finishEdit();
          }}
          onSaved={model.finishEdit}
          onDirtyChange={model.setDirty}
          onBusyChange={model.setEditBusy}
        />
      ) : (
        <RegistrationFactsSections profile={model.profile} onEdit={model.setEditTarget} />
      )}
    </div>
  );
}

function RegistrationFactsSections({
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
      <section className={styles.section}>
        <SectionHeading title="Observações" icon={NotebookPen} target="notes" onEdit={onEdit} />
        <p className={styles.notes}>{profile.notes ?? "Nenhuma observação."}</p>
      </section>
    </>
  );
}

function RegistrationDiscard({ model }: { model: RegistrationViewModel }): ReactElement | null {
  if (!model.discard) return null;
  return (
    <DiscardRegistrationDialog
      onKeep={() => model.setDiscard(null)}
      onDiscard={() => {
        if (model.discard === "close") {
          model.setDirty(false);
          model.setOpen(false);
        } else model.finishEdit();
        model.setDiscard(null);
      }}
    />
  );
}

function StudentContactFacts({ profile }: { profile: StudentProfile }): ReactElement {
  return (
    <dl className={styles.facts}>
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
  onEdit: (target: RegistrationEditTarget) => void;
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
        onClick={() => onEdit(target)}
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
