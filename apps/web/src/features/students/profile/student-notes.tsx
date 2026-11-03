"use client";

import { useState, type ReactElement } from "react";
import { NotebookPen, Pencil, Plus } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { StudentProfile } from "./logic";
import { RegistrationEditDialog } from "./registration-edit-dialog";
import styles from "./student-overview.module.css";

export function StudentNotes({ profile }: { profile: StudentProfile }): ReactElement {
  const [editing, setEditing] = useState(false);
  const hasNotes = Boolean(profile.notes?.trim());
  return (
    <section className={styles.notes} aria-labelledby="student-notes-title">
      <header className={styles.sectionHeading}>
        <h2 id="student-notes-title">
          <NotebookPen aria-hidden="true" /> Anotações
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          {hasNotes ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {hasNotes ? "Editar" : "Adicionar anotação"}
        </Button>
      </header>
      {hasNotes ? (
        <p className={styles.notesText}>{profile.notes}</p>
      ) : (
        <div className={styles.notesEmpty}>
          <NotebookPen aria-hidden="true" />
          <p>Uma página para os combinados</p>
          <span>Registre preferências e informações úteis para o próximo contato.</span>
        </div>
      )}
      {editing && (
        <RegistrationEditDialog
          profile={profile}
          target="notes"
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}
