import type { ReactElement } from "react";
import { UserRound, Plus } from "lucide-react";
import { DOCUMENTS } from "./model";
import { DocumentUploadPicker } from "./upload-picker";
import type { EnrollmentDocuments } from "./use-enrollment-documents";
import { trpc } from "~/lib/trpc";
import styles from "./documents.module.css";

export function EnrollmentPhoto({
  documents,
  studentId,
  disabled = false,
}: {
  documents: EnrollmentDocuments;
  studentId?: string | undefined;
  disabled?: boolean;
}): ReactElement {
  const existing = trpc.studentDocuments.photo.useQuery(
    { studentId: studentId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(studentId) },
  );
  const photo =
    documents.query.data?.files.findLast(
      (file) => file.kind === "photo" && file.status === "READY",
    ) ?? existing.data;
  const definition = DOCUMENTS.find((document) => document.id === "photo")!;
  return (
    <DocumentUploadPicker
      documents={documents}
      document={definition}
      disabled={disabled}
      renderTrigger={(picker) => (
        <button
          type="button"
          className={styles.avatarPicker}
          onClick={picker.open}
          disabled={picker.disabled}
          aria-label={photo ? "Trocar foto do aluno" : "Adicionar foto do aluno"}
          title={photo ? "Trocar foto pelo computador" : "Adicionar foto pelo computador"}
        >
          <span className={styles.avatarImage}>
            {photo ? (
              <img
                src={`/api/student-document-files/${photo.id}?v=${photo.updatedAt.getTime()}`}
                alt="Foto do aluno"
              />
            ) : (
              <UserRound aria-hidden="true" />
            )}
            <span className={styles.avatarAdd}>
              <Plus aria-hidden="true" />
            </span>
          </span>
        </button>
      )}
    />
  );
}
