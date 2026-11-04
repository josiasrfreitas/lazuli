"use client";

import { useState, type ReactElement } from "react";
import type { StudentProfile } from "./logic";
import type { RegistrationEditTarget } from "./registration-editor";
import { RegistrationFactsSections } from "./student-contact";
import { RegistrationEditDialog } from "./registration-edit-dialog";
import { RegistrationDocuments } from "./registration-documents";
import styles from "./student-overview.module.css";

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
