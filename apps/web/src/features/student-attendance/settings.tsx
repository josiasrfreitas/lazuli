"use client";
import { type ReactElement } from "react";
import Link from "next/link";
import { Alert } from "@lazuli/ui";
import { AttendanceSettingsForm } from "./settings-fields";
import { trpc } from "~/lib/trpc";
import { useSettingsForm, type Settings } from "./settings-model";
export function AttendanceSettingsPage(): ReactElement {
  const query = trpc.studentAttendance.settings.useQuery();
  return (
    <div className="mx-auto grid w-full max-w-3xl content-start gap-5 p-4 sm:p-6">
      <Link href="/aulas" className="w-fit text-caption text-interactive hover:underline">
        Voltar para Aulas
      </Link>
      <h1 className="font-display text-h1 text-heading">Área da escola para presença</h1>
      <p className="text-sm text-muted-foreground">
        Informe as coordenadas reais e os limites usados pelo QR presencial. Aulas online dispensam
        localização. Novos limites valem para os próximos links.
      </p>
      {query.error && <Alert>{query.error.message}</Alert>}
      {query.isPending && <p role="status">Carregando configuração…</p>}
      {query.data !== undefined && <SettingsForm initial={query.data} />}
    </div>
  );
}
function SettingsForm({ initial }: { initial: Settings }): ReactElement {
  const model = useSettingsForm(initial);
  return <AttendanceSettingsForm model={model} />;
}
