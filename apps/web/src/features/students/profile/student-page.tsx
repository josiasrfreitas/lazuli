"use client";

import type { ReactElement } from "react";
import { MessageCircle } from "lucide-react";
import { Badge, Button, InlineSkeleton } from "@lazuli/ui";
import { studentStatusSchema } from "@lazuli/validators";
import { formatDateOnlyBR } from "~/lib/format";
import { statusBadgeVm } from "../view-model";
import { useStudentProfile, type StudentProfile } from "./logic";
import { MISSING_DETAIL, ProfileError, ProfileFact } from "./profile-shared";
import { StudentContactButton } from "./student-contact";
import { StudentSections } from "./student-sections";

export function StudentPage({ id }: { id: string }): ReactElement {
  const profile = useStudentProfile(id);
  return (
    <div className="mx-auto grid w-full max-w-7xl content-start gap-6 p-4 sm:p-6">
      {profile.isPending && <ProfileLoading />}
      {profile.isError && (
        <ProfileError
          message={profileErrorMessage(profile.error.data?.code)}
          onRetry={() => void profile.refetch()}
          isRetrying={profile.isFetching}
        />
      )}
      {profile.data && (
        <>
          <StudentIdentity profile={profile.data} />
          <StudentSections key={id} id={id} />
        </>
      )}
    </div>
  );
}

function profileErrorMessage(code: string | undefined): string {
  if (code === "NOT_FOUND") return "Aluno não encontrado.";
  if (code === "BAD_REQUEST") return "Endereço de aluno inválido.";
  return "Não foi possível carregar o aluno. Tente novamente.";
}

function StudentIdentity({ profile }: { profile: StudentProfile }): ReactElement {
  const parsed = studentStatusSchema.safeParse(profile.contact.status);
  const status = parsed.success
    ? statusBadgeVm(parsed.data)
    : { label: "Situação não informada", variant: "neutral" as const };
  return (
    <header className="grid min-w-0 gap-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="break-words font-display text-2xl font-semibold text-heading sm:text-3xl">
            {profile.contact.fullName}
          </h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {profile.whatsAppUrl && (
            <Button
              variant="link"
              size="inline"
              nativeButton={false}
              render={<a href={profile.whatsAppUrl} target="_blank" rel="noreferrer" />}
            >
              <MessageCircle aria-hidden="true" /> WhatsApp
            </Button>
          )}
          <StudentContactButton profile={profile} />
        </div>
      </div>
      <dl className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileFact label="Nascimento">
          {profile.contact.birthDate ? formatDateOnlyBR(profile.contact.birthDate) : MISSING_DETAIL}
        </ProfileFact>
        <ProfileFact label="Telefone">{profile.contact.phone ?? MISSING_DETAIL}</ProfileFact>
        <ProfileFact label="E-mail">{profile.contact.email ?? MISSING_DETAIL}</ProfileFact>
        <ProfileFact label="Responsável">
          {profile.guardian?.fullName ?? MISSING_DETAIL}
        </ProfileFact>
      </dl>
    </header>
  );
}

function ProfileLoading(): ReactElement {
  return (
    <div role="status" className="grid gap-4">
      <InlineSkeleton className="h-8 w-64 max-w-full" />
      <InlineSkeleton className="h-5 w-48" />
      <span className="sr-only">Carregando aluno</span>
    </div>
  );
}
