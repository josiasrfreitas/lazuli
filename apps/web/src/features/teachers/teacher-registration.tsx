import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Pencil, UserRound } from "lucide-react";
import { Button } from "@lazuli/ui";
import layout from "../students/profile/student-overview.module.css";
import styles from "../students/profile/student-registration.module.css";
export function TeacherRegistration({
  teacher,
  onEdit,
}: {
  teacher: RouterOutputs["teachers"]["byId"];
  onEdit: () => void;
}): ReactElement {
  return (
    <div className={layout.registration}>
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
          <dl className={styles.facts}>
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
              <dt>E-mail</dt>
              <dd>{teacher.email}</dd>
            </div>
          </dl>
        </section>
      </section>
    </div>
  );
}
