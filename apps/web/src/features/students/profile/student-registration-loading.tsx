import type { ReactElement } from "react";
import { RegistrationFactsLoading } from "./student-contact";
import styles from "./student-overview.module.css";
import loading from "./student-loading.module.css";
import { RegistrationDocumentsLoading } from "./registration-documents-loading";

export function StudentRegistrationLoading(): ReactElement {
  return (
    <div
      className={styles.registration}
      data-loading="true"
      aria-busy="true"
      aria-label="Carregando cadastro do aluno"
    >
      <div className={`${styles.registrationFacts} ${loading.surface}`}>
        <RegistrationFactsLoading />
      </div>
      <div className={styles.registrationDocuments}>
        <RegistrationDocumentsLoading />
      </div>
    </div>
  );
}
