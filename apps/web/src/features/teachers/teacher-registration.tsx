"use client";
import { type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Pencil, UserRound, BriefcaseBusiness } from "lucide-react";
import { Button } from "@lazuli/ui";
import layout from "../students/profile/student-overview.module.css";
import registration from "./teacher-registration.module.css";
import styles from "../students/profile/student-registration.module.css";
import { useTeacherDocuments } from "./use-teacher-documents";
import { TeacherDocumentPanel } from "./teacher-document-panel";
import { EMPLOYMENT_LABELS } from "./teacher-employment-fields";
import { AREA_LABELS, ROLE_LABELS } from "./employee-labels";
const NOT_INFORMED = "Não informado";
type Teacher = RouterOutputs["teachers"]["byId"];
export function TeacherRegistration({
  teacher,
  onEdit,
}: {
  teacher: Teacher;
  onEdit: () => void;
}): ReactElement {
  const documents = useTeacherDocuments(teacher.id);
  return (
    <div className={registration.layout}>
      <section className={layout.registrationFacts} aria-label="Informações de cadastro">
        <PersonalDetails teacher={teacher} onEdit={onEdit} />
        <EmploymentDetails teacher={teacher} onEdit={onEdit} />
      </section>
      <div className={registration.documents}>
        <TeacherDocumentPanel documents={documents} showGuidance hidePhoto />
      </div>
    </div>
  );
}

function PersonalDetails({
  teacher,
  onEdit,
}: {
  teacher: Teacher;
  onEdit: () => void;
}): ReactElement {
  const profile = teacher.employeeProfile;
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 className={styles.sectionTitle}>
          <UserRound aria-hidden="true" /> Dados pessoais
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Editar dados pessoais">
          <Pencil />
        </Button>
      </div>
      <dl className={registration.facts}>
        <div className={styles.fact}>
          <dt>Nome completo</dt>
          <dd>{teacher.name}</dd>
        </div>
        <div className={styles.fact}>
          <dt>CPF</dt>
          <dd>
            {profile?.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/u, "$1.$2.$3-$4") ?? NOT_INFORMED}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Telefone</dt>
          <dd>{profile?.phone || NOT_INFORMED}</dd>
        </div>
        <div className={styles.fact}>
          <dt>E-mail</dt>
          <dd>{teacher.email}</dd>
        </div>
      </dl>
    </section>
  );
}

function EmploymentDetails({
  teacher,
  onEdit,
}: {
  teacher: Teacher;
  onEdit: () => void;
}): ReactElement {
  const profile = teacher.employeeProfile;
  return (
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
              : NOT_INFORMED}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Área</dt>
          <dd>{profile?.area ? AREA_LABELS[profile.area] : "A preencher"}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Cargo</dt>
          <dd>{profile?.jobTitle || NOT_INFORMED}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Papel de acesso</dt>
          <dd>{ROLE_LABELS[teacher.role]}</dd>
        </div>
        <div className={styles.fact} data-wide>
          <dt>Observações</dt>
          <dd className="whitespace-pre-wrap">
            {teacher.teacherProfile?.notes || "Nenhuma observação"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
