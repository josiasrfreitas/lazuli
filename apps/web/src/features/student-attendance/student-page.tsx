"use client";
import type { ReactElement } from "react";
import { Alert, Button } from "@lazuli/ui";
import { StudentAttendanceFrame } from "./student-frame";
import { DeclarationForm } from "./declaration-form";
import { usePublicLink, type PublicLink } from "./public-link";
import { StudentReceipt } from "./receipt";
export function StudentAttendancePage(): ReactElement {
  const link = usePublicLink();
  return (
    <StudentAttendanceFrame lesson={link.info}>
      <PublicContent link={link} />
    </StudentAttendanceFrame>
  );
}
function PublicContent({ link }: { link: PublicLink }): ReactElement | null {
  if (link.receipt) return <StudentReceipt receipt={link.receipt} />;
  if (!link.loaded || link.pending) return <p role="status">Abrindo sua aula…</p>;
  if (!link.token)
    return <Alert>Abra o QR ou o link de presença compartilhado pelo professor.</Alert>;
  if (link.invalid)
    return (
      <Alert>Este link está incompleto ou é inválido. Peça ao professor um novo acesso.</Alert>
    );
  if (link.error)
    return (
      <div className="grid gap-4">
        <Alert>{link.error.message}</Alert>
        <Button variant="secondary" onClick={link.retry}>
          Tentar novamente
        </Button>
      </div>
    );
  return link.info ? (
    <DeclarationForm key={link.token} token={link.token} info={link.info} />
  ) : null;
}
