"use client";

import { useState, type ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import type { StudentProfile } from "./logic";
import type { RegistrationEditTarget } from "./registration-editor";
import { RegistrationFactsSections } from "./student-contact";
import { RegistrationEditDialog } from "./registration-edit-dialog";
import { RegistrationDocuments } from "./registration-documents";
import styles from "./student-overview.module.css";
import loading from "./student-loading.module.css";

const REGISTRATION_SKELETON_FIELDS = 4;

export function StudentRegistrationSection({
  profile,
  onBusyChange,
}: {
  profile: StudentProfile;
  onBusyChange: (busy: boolean) => void;
}): ReactElement {
  const [editing, setEditing] = useState<RegistrationEditTarget | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  return (
    <div className={styles.registration}>
      <section className={styles.registrationFacts} aria-label="Informações de cadastro">
        <RegistrationFactsSections profile={profile} onEdit={setEditing} />
      </section>
      <div className={styles.registrationDocuments} aria-busy={uploadBusy}>
        <RegistrationDocuments
          studentId={profile.id}
          onBusyChange={(busy) => {
            setUploadBusy(busy);
            onBusyChange(busy);
          }}
        />
      </div>
      {editing && (
        <RegistrationEditDialog
          profile={profile}
          target={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export function StudentRegistrationLoading(): ReactElement {
  return (
    <div className={styles.registration} aria-busy="true" aria-label="Carregando cadastro do aluno">
      <div className={`${styles.registrationFacts} ${loading.surface}`}>
        {["Dados do aluno", "Responsável", "Endereço"].map((title) => (
          <section key={title} className="grid gap-4 border-b border-border py-4">
            <h3 className="text-sm font-semibold text-heading">{title}</h3>
            <div className="grid grid-cols-2 gap-4" aria-hidden="true">
              {Array.from({ length: REGISTRATION_SKELETON_FIELDS }, (_value, field) => (
                <div key={field} className="grid gap-2">
                  <InlineSkeleton className="h-3 w-16" />
                  <InlineSkeleton className="h-4 w-32 max-w-full" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className={`${styles.registrationDocuments} ${loading.surface}`}>
        <h3 className="text-h3 font-semibold text-heading">Documentos</h3>
        <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden="true">
          {Array.from({ length: REGISTRATION_SKELETON_FIELDS }, (_value, item) => (
            <InlineSkeleton key={item} className="h-24 w-full" />
          ))}
        </div>
        <InlineSkeleton className="mt-4 h-64 w-full" />
      </div>
    </div>
  );
}
