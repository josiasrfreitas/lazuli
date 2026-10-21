"use client";

import type { JSX as ReactJSX } from "react";
import { Mail, Phone, UserRound } from "lucide-react";
import { Button } from "@lazuli/ui";
import { toWhatsAppUrl } from "~/lib/format";
import { dateLabel, formatLabel, leadInterestLabels, type Candidate } from "./labels";
import styles from "./lead-workspace.module.css";
import { PendingAllocation } from "./pending-allocation";

const experienceLabels: Record<string, string> = {
  NONE: "Iniciante",
  SOME: "Já estudou inglês",
  UNKNOWN: "Não informada",
};

export function LeadContext({
  candidate,
  onEdit,
}: {
  candidate: Candidate;
  onEdit: () => void;
}): ReactJSX.Element {
  const whatsapp = toWhatsAppUrl(candidate.phone);
  return (
    <aside className={styles.context} aria-label="Dados do lead">
      <section className={styles.contextSection}>
        <div className={styles.sectionHeading}>
          <h2>Sobre o lead</h2>
          {candidate.status === "WAITING" && (
            <Button variant="ghost" size="compact-responsive" onClick={onEdit}>
              Editar
            </Button>
          )}
        </div>
        <dl className={styles.facts}>
          <div className={styles.experience}>
            <dt>Experiência com inglês</dt>
            <dd>{experienceLabels[candidate.englishExperience] ?? "Não informada"}</dd>
          </div>
          <div>
            <dt>Estágio</dt>
            <dd>
              {candidate.stage?.name ??
                (candidate.englishExperience === "SOME" ? "Aguarda nivelamento" : "A definir")}
            </dd>
          </div>
          <div>
            <dt>Interesse</dt>
            <dd>{leadInterestLabels[candidate.interest]}</dd>
          </div>
          <div>
            <dt>Formato preferido</dt>
            <dd>{candidate.format ? formatLabel(candidate.format) : "Sem preferência"}</dd>
          </div>
        </dl>
        {candidate.studentId && candidate.status === "WAITING" && (
          <p className={styles.contextNote}>
            Cadastro iniciado. Continue a turma e o contrato em “Abrir aluno”.
          </p>
        )}
        {candidate.status === "WAITING" && <PendingAllocation candidate={candidate} />}
      </section>
      <section className={styles.contextSection} aria-label="Contato">
        <h2>Contato</h2>
        <div className={styles.contacts}>
          {candidate.contactName && (
            <div className={styles.contact}>
              <UserRound aria-hidden="true" />
              <div>
                <span>
                  {candidate.contactRole === "GUARDIAN" ? "Responsável" : "Pessoa de contato"}
                </span>
                <p>{candidate.contactName}</p>
              </div>
            </div>
          )}
          {candidate.phone && (
            <div className={styles.contact}>
              <Phone aria-hidden="true" />
              <div>
                <span>
                  {candidate.contactOwner === "GUARDIAN" ? "Telefone do responsável" : "Telefone"}
                </span>
                <a
                  href={whatsapp ?? `tel:${candidate.phone}`}
                  target={whatsapp ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  {candidate.phone}
                </a>
              </div>
            </div>
          )}
          {candidate.email && (
            <div className={styles.contact}>
              <Mail aria-hidden="true" />
              <div>
                <span>
                  {candidate.contactOwner === "GUARDIAN" ? "E-mail do responsável" : "E-mail"}
                </span>
                <a href={`mailto:${candidate.email}`}>{candidate.email}</a>
              </div>
            </div>
          )}
          {!candidate.phone && !candidate.email && (
            <p className={styles.contextNote}>Nenhum telefone ou e-mail informado.</p>
          )}
        </div>
        {(candidate.birthDate || candidate.source) && (
          <dl className={styles.facts}>
            {candidate.birthDate && (
              <div>
                <dt>Nascimento</dt>
                <dd>{dateLabel(candidate.birthDate)}</dd>
              </div>
            )}
            {candidate.source && (
              <div>
                <dt>Origem</dt>
                <dd>{candidate.source}</dd>
              </div>
            )}
          </dl>
        )}
      </section>
      {candidate.notes && (
        <section className={styles.contextSection}>
          <h2>Observações</h2>
          <p className={styles.notes}>{candidate.notes}</p>
        </section>
      )}
      <p className={styles.createdAt}>Cadastrado em {dateLabel(candidate.createdAt)}</p>
    </aside>
  );
}
