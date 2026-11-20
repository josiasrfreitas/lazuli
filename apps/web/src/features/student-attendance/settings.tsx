"use client";
import type { ReactElement } from "react";
import { Button, InlineSkeleton, ToastAlert } from "@lazuli/ui";
import { AttendanceSettingsForm } from "./settings-fields";
import { trpc } from "~/lib/trpc";
import { useSettingsForm, type Settings } from "./settings-model";
import styles from "./settings.module.css";

export function AttendanceSettingsPage(): ReactElement {
  const query = trpc.studentAttendance.settings.useQuery(undefined, { retry: false });
  return (
    <section className={styles.section} aria-label="Localização da escola">
      {query.error && (
        <ToastAlert variant="destructive">
          Não foi possível carregar a localização.{" "}
          <Button type="button" variant="link" size="inline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </ToastAlert>
      )}
      {query.isPending && <LocationLoading />}
      {query.data !== undefined && <SettingsForm initial={query.data} />}
    </section>
  );
}
function SettingsForm({ initial }: { initial: Settings }): ReactElement {
  const model = useSettingsForm(initial);
  return <AttendanceSettingsForm model={model} />;
}
function LocationLoading(): ReactElement {
  return (
    <div
      className={styles.workspace}
      role="status"
      aria-label="Carregando localização da escola"
      aria-busy="true"
    >
      <div className={styles.controls} aria-hidden="true">
        <InlineSkeleton shape="block" className="h-6 w-48" />
        <InlineSkeleton className="h-4 w-full" />
        <InlineSkeleton shape="block" className="h-8 w-full" />
        <InlineSkeleton className="h-4 w-32" />
        <InlineSkeleton shape="block" className="h-8 w-24" />
      </div>
      <div className={styles.mapLoading} aria-hidden="true">
        <InlineSkeleton shape="block" className="h-5 w-32" />
        <p>Preparando endereço e mapa…</p>
      </div>
      <div className={styles.footer} aria-hidden="true">
        <InlineSkeleton className="h-3 w-48" />
        <InlineSkeleton shape="block" className="h-8 w-32" />
      </div>
    </div>
  );
}
