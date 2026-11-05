import type { ReactElement } from "react";
import { Camera, FileText, FolderOpen, House, IdCard, UsersRound } from "lucide-react";
import { InlineSkeleton } from "@lazuli/ui";
import { DOCUMENTS } from "~/features/student-documents/model";
import { RegistrationDocumentLoading } from "./registration-document-preview";
import styles from "./student-registration.module.css";
import loading from "./student-loading.module.css";
export const DOCUMENT_LABELS = {
  student: "Aluno",
  guardian: "Responsável",
  residence: "Residência",
  photo: "Foto",
  payment: "Pagamento",
};
export const DOCUMENT_ICONS = {
  student: IdCard,
  guardian: UsersRound,
  residence: House,
  photo: Camera,
  payment: FileText,
};
export function RegistrationDocumentsLoading(): ReactElement {
  return (
    <section
      className={styles.documents}
      aria-label="Carregando documentos do aluno"
      aria-busy="true"
    >
      <DocumentsHeader pending />
      <DocumentsLoading />
    </section>
  );
}

export function DocumentsHeader({
  pending,
  count,
}: {
  pending: boolean;
  count?: number | undefined;
}): ReactElement {
  return (
    <header className={styles.documentHeader}>
      <h3>
        <FolderOpen aria-hidden="true" />
        Documentos
      </h3>
      {pending ? (
        <InlineSkeleton className="w-16" />
      ) : (
        count !== undefined && (
          <span className={styles.count}>
            {count} {count === 1 ? "arquivo" : "arquivos"}
          </span>
        )
      )}
    </header>
  );
}
export function DocumentsLoading(): ReactElement {
  return (
    <div className={`${styles.documents} ${loading.surface}`}>
      <div className={styles.documentSelector}>
        {DOCUMENTS.filter((document) => document.id !== "payment").map((document) => {
          const Icon = DOCUMENT_ICONS[document.id];
          return (
            <div key={document.id} className={styles.choiceSkeleton}>
              <span className={styles.choicePlaceholder}>
                <Icon aria-hidden="true" />
              </span>
              <span className={styles.choiceLabel}>{DOCUMENT_LABELS[document.id]}</span>
              <span className={styles.choiceStatus}>
                <InlineSkeleton className="h-2 w-12" />
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.documentStage}>
        <div className={styles.previewTitle} aria-hidden="true">
          <InlineSkeleton className="w-40" />
          <InlineSkeleton className="w-16" />
        </div>
        <div className={styles.preview} data-loading="true">
          <RegistrationDocumentLoading />
        </div>
        <div className={styles.documentActions} aria-hidden="true">
          <InlineSkeleton className="w-28" />
        </div>
      </div>
    </div>
  );
}
