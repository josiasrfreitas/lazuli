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

export function ExperimentalLeadDetails({
  lead,
  candidate,
  onEditContact,
}: {
  lead: Candidate | undefined;
  candidate: CalendarExperimental["candidate"];
  onEditContact: () => void;
}) {
  const editable = lead?.status === "WAITING";
  const stage = lead ? lead.stage?.name : candidate.stage?.name;
  const scheduleType = lead ? lead.scheduleType : candidate.scheduleType;
  const phone = lead?.phone?.trim();
  const email = lead?.email?.trim();
  const whatsapp = toWhatsAppUrl(phone);
  return (
    <div className={styles.lead}>
      {(editable || scheduleType || stage || lead) && (
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
      )}
      {(phone || email || lead?.contactName?.trim() || editable) && (
        <section className={styles.contact}>
          <div className={styles.sectionHeading}>
            <h3>Contato</h3>
            {editable && (
              <Button variant="ghost" size="sm" onClick={onEditContact}>
                <Pencil aria-hidden="true" />
                Editar contato
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
            {phone ? (
              whatsapp ? (
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
              ) : (
                <span className={styles.contactLink}>
                  <Phone aria-hidden="true" />
                  {phone}
                </span>
              )
            ) : (
              editable && (
                <Button variant="link" size="sm" onClick={onEditContact}>
                  <Phone aria-hidden="true" />
                  Adicionar telefone
                </Button>
              )
            )}
            {email ? (
              <a href={`mailto:${email}`} className={styles.contactLink}>
                <Mail aria-hidden="true" />
                <span>{email}</span>
              </a>
            ) : (
              editable && (
                <Button variant="link" size="sm" onClick={onEditContact}>
                  <Mail aria-hidden="true" />
                  Adicionar e-mail
                </Button>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
