import type { JSX as ReactJSX } from "react";
import { Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import { Button } from "@lazuli/ui";
import { toWhatsAppUrl } from "~/lib/format";
import {
  interestLabel,
  leadInterestLabels,
  statusLabels,
  type Candidate,
} from "~/features/admissions/labels";
import type { CalendarExperimental } from "./calendar-model";
import styles from "./calendar-experimental-dialog.module.css";

type Props = {
  lead: Candidate | undefined;
  candidate: CalendarExperimental["candidate"];
  onEditContact: () => void;
};
export function ExperimentalLeadDetails({
  lead,
  candidate,
  onEditContact,
}: Props): ReactJSX.Element {
  const profile = leadProfileDetails(lead, candidate);
  const contact = leadContactDetails(lead);
  return (
    <div className={styles.lead}>
      {profile.visible && (
        <LeadProfile lead={lead} stage={profile.stage} scheduleType={profile.scheduleType} />
      )}
      {contact.visible && (
        <LeadContact
          lead={lead}
          phone={contact.phone}
          email={contact.email}
          editable={contact.editable}
          onEditContact={onEditContact}
        />
      )}
    </div>
  );
}

function leadProfileDetails(
  lead: Candidate | undefined,
  candidate: CalendarExperimental["candidate"],
): {
  visible: boolean;
  stage: string | undefined;
  scheduleType: CalendarExperimental["candidate"]["scheduleType"];
} {
  const stage = lead ? lead.stage?.name : candidate.stage?.name;
  const scheduleType = lead ? lead.scheduleType : candidate.scheduleType;
  return { visible: Boolean(lead || stage || scheduleType), stage, scheduleType };
}

function leadContactDetails(lead: Candidate | undefined): {
  visible: boolean;
  editable: boolean;
  phone: string | undefined;
  email: string | undefined;
} {
  const editable = lead?.status === "WAITING";
  const phone = lead?.phone?.trim();
  const email = lead?.email?.trim();
  return {
    visible: [phone, email, lead?.contactName?.trim(), editable].some(Boolean),
    editable,
    phone,
    email,
  };
}

function LeadProfile({
  lead,
  stage,
  scheduleType,
}: {
  lead: Candidate | undefined;
  stage: string | undefined;
  scheduleType: CalendarExperimental["candidate"]["scheduleType"];
}): ReactJSX.Element {
  return (
    <section className={styles.profile}>
      <h3>Sobre o lead</h3>
      <dl className={styles.leadFacts}>
        {lead && (
          <div>
            <dt>Interesse</dt>
            <dd>{leadInterestLabels[lead.interest]}</dd>
          </div>
        )}
        {scheduleType && (
          <div>
            <dt>Modalidade</dt>
            <dd>
              {interestLabel(scheduleType)}
              {stage ? ` · ${stage}` : ""}
            </dd>
          </div>
        )}
        {!scheduleType && stage && (
          <div>
            <dt>Estágio</dt>
            <dd>{stage}</dd>
          </div>
        )}
        {lead && (
          <div>
            <dt>Situação</dt>
            <dd>{statusLabels[lead.status]}</dd>
          </div>
        )}
        {lead?.source?.trim() && (
          <div>
            <dt>Origem</dt>
            <dd>{lead.source}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function LeadContact({
  lead,
  phone,
  email,
  editable,
  onEditContact,
}: {
  lead: Candidate | undefined;
  phone: string | undefined;
  email: string | undefined;
  editable: boolean;
  onEditContact: () => void;
}): ReactJSX.Element {
  return (
    <section className={styles.contact}>
      <div className={styles.sectionHeading}>
        <h3>Contato</h3>
        {editable && (
          <Button variant="ghost" size="sm" onClick={onEditContact}>
            <Pencil aria-hidden="true" /> Editar contato
          </Button>
        )}
      </div>
      {lead?.contactName?.trim() && (
        <p className={styles.contactPerson}>
          {lead.contactName}
          <span>Pessoa de contato</span>
        </p>
      )}
      <div className={styles.contactLinks}>
        <LeadPhone phone={phone} editable={editable} onEditContact={onEditContact} />
        <LeadEmail email={email} editable={editable} onEditContact={onEditContact} />
      </div>
    </section>
  );
}

function LeadPhone({
  phone,
  editable,
  onEditContact,
}: {
  phone: string | undefined;
  editable: boolean;
  onEditContact: () => void;
}): ReactJSX.Element | null {
  const whatsapp = toWhatsAppUrl(phone);
  if (phone && whatsapp)
    return (
      <a
        href={whatsapp}
        target="_blank"
        rel="noreferrer"
        className={styles.contactLink}
        aria-label={`Conversar no WhatsApp: ${phone}`}
      >
        <MessageCircle aria-hidden="true" />
        <span>
          {phone}
          <small>Conversar no WhatsApp</small>
        </span>
      </a>
    );
  if (phone)
    return (
      <span className={styles.contactLink}>
        <Phone aria-hidden="true" />
        {phone}
      </span>
    );
  if (editable)
    return (
      <Button variant="link" size="sm" onClick={onEditContact}>
        <Phone aria-hidden="true" />
        Adicionar telefone
      </Button>
    );
  return null;
}

function LeadEmail({
  email,
  editable,
  onEditContact,
}: {
  email: string | undefined;
  editable: boolean;
  onEditContact: () => void;
}): ReactJSX.Element | null {
  if (email)
    return (
      <a href={`mailto:${email}`} className={styles.contactLink}>
        <Mail aria-hidden="true" />
        <span>{email}</span>
      </a>
    );
  if (editable)
    return (
      <Button variant="link" size="sm" onClick={onEditContact}>
        <Mail aria-hidden="true" />
        Adicionar e-mail
      </Button>
    );
  return null;
}
