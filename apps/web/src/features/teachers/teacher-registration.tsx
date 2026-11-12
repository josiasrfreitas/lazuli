"use client";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Pencil, UserRound, BriefcaseBusiness } from "lucide-react";
import { Button } from "@lazuli/ui";
import layout from "../students/profile/student-overview.module.css";
import registration from "./teacher-registration.module.css";
import styles from "../students/profile/student-registration.module.css";
import { useTeacherDocuments } from "./use-teacher-documents";
import { TeacherDocumentPanel } from "./teacher-document-panel";
import { EMPLOYMENT_LABELS } from "./teacher-employment-fields";
export function TeacherRegistration({
  teacher,
  onEdit,
}: {
  teacher: RouterOutputs["teachers"]["byId"];
  onEdit: () => void;
}): ReactElement {
  const documents = useTeacherDocuments(teacher.id);
  const profile = teacher.teacherProfile;
  return (
    <div className={registration.layout}>
      <section className={layout.registrationFacts} aria-label="Informações de cadastro">
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>
              <UserRound aria-hidden="true" /> Dados pessoais
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              aria-label="Editar dados pessoais"
            >
              <Pencil />
            </Button>
          </div>
          <p className={styles.supporting}>
            Mantenha os dados de identificação e contato atualizados.
          </p>
          <dl className={registration.facts}>
            <div className={styles.fact}>
              <dt>Nome completo</dt>
              <dd>{teacher.name}</dd>
            </div>
            <div className={styles.fact}>
              <dt>CPF</dt>
              <dd>
                {teacher.teacherProfile?.cpf?.replace(
                  /(\d{3})(\d{3})(\d{3})(\d{2})/u,
                  "$1.$2.$3-$4",
                ) ?? "Não informado"}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>Telefone</dt>
              <dd>{profile?.phone || "Não informado"}</dd>
            </div>
            <div className={styles.fact}>
              <dt>E-mail</dt>
              <dd>{teacher.email}</dd>
            </div>
          </dl>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>
              <BriefcaseBusiness aria-hidden="true" /> Contratação
            </h2>
            <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Editar contratação">
              <Pencil />
            </Button>
          </div>
          <dl className={registration.facts}>
            <div className={styles.fact}>
              <dt>Tipo de vínculo</dt>
              <dd>
                {profile?.employmentType
                  ? EMPLOYMENT_LABELS[profile.employmentType as keyof typeof EMPLOYMENT_LABELS]
                  : "Não informado"}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>Carga semanal</dt>
              <dd>
                {profile?.weeklyHours == null
                  ? "Não informada"
                  : `${profile.weeklyHours.toLocaleString("pt-BR")} horas-aula`}
              </dd>
            </div>
            {profile?.employmentType === "CLT" && (
              <div className={styles.fact} data-wide>
                <dt>Previsão de férias</dt>
                <dd>
                  {profile.vacationStart && profile.vacationEnd
                    ? `${dateLabel(profile.vacationStart)} a ${dateLabel(profile.vacationEnd)}`
                    : "Não informada"}
                </dd>
              </div>
            )}
            <div className={styles.fact} data-wide>
              <dt>Observações</dt>
              <dd className="whitespace-pre-wrap">{profile?.notes || "Nenhuma observação"}</dd>
            </div>
          </dl>
        </section>
      </section>
      <div className={registration.documents}>
        <TeacherDocumentPanel documents={documents} showGuidance />
      </div>
    </div>
  );
}

function dateLabel(value: Date): string {
  return value.toISOString().slice(0, 10).split("-").reverse().join("/");
}
