"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useState, type ReactNode } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import { Alert, Avatar, Button, Input, Switch } from "@lazuli/ui";
import type { RouterInputs } from "@lazuli/api";
import type { ClassRecord } from "~/features/class-records/shared";
import type { AttendanceStatus } from "./staff-section";
import { attendanceTime } from "./location";
import styles from "./teacher-page.module.css";

export type AttendanceReviewData = {
  session: { id: string };
  attendanceOnly: boolean;
  version: number;
  attendanceStamp: string | null;
  restriction: string | null;
  snapshot: {
    entries: Pick<
      ClassRecord["snapshot"]["entries"][number],
      "enrollmentId" | "studentId" | "name" | "stage" | "status"
    >[];
  };
};
export type AttendanceReviewStatus = Pick<
  AttendanceStatus,
  "declarations" | "confirmationRestriction"
>;
export type AttendanceReviewInput = RouterInputs["studentAttendance"]["confirm"];

export function AttendanceReview({
  data,
  status,
  statusFailed = false,
  saving = false,
  saved = false,
  refreshing = false,
  error,
  onConfirm,
  onChange,
  onRefresh,
  onRecord,
  sharing,
}: {
  data: AttendanceReviewData;
  status: AttendanceReviewStatus;
  statusFailed?: boolean;
  saving?: boolean;
  saved?: boolean;
  refreshing?: boolean;
  error?: { message: string; conflict: boolean } | null;
  onConfirm: (input: AttendanceReviewInput) => void;
  onChange?: () => void;
  onRefresh?: () => void;
  onRecord?: () => void;
  sharing: ReactNode;
}): ReactJSX.Element {
  const sessionId = data.session.id;
  const confirmed = data.attendanceOnly || data.version > 0;
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const dirty = Object.keys(overrides).length > 0;
  useEffect(() => {
    if (!dirty || saved) return;
    const warn = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);

  const rows = data.snapshot.entries.map((row) => {
    const declaration = status.declarations.find((item) => item.enrollmentId === row.enrollmentId);
    return {
      ...row,
      declaration,
      present:
        overrides[row.enrollmentId] ??
        (confirmed ? row.status === "PRESENT" : Boolean(declaration)),
      manual: overrides[row.enrollmentId] !== undefined,
    };
  });
  const present = rows.filter((row) => row.present).length;
  const searchKey = (value: string): string =>
    value
      .normalize("NFD")
      .replaceAll(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR")
      .trim();
  const visible = rows.filter((row) => searchKey(row.name).includes(searchKey(search)));
  const blocked = Boolean(status.confirmationRestriction) || statusFailed || saving || refreshing;
  return (
    <>
      <div className={styles.layout}>
        <form
          className={styles.review}
          aria-label="Chamada da aula"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (blocked || rows.length === 0 || (confirmed && !dirty)) return;
            onConfirm({
              sessionId,
              attendanceStamp: data.attendanceStamp,
              declarationIds: status.declarations.map((row) => row.id),
              rows: rows.map((row) => ({
                enrollmentId: row.enrollmentId,
                status: row.present ? "PRESENT" : "ABSENT",
              })),
            });
          }}
        >
          <div className={styles.listHeading}>
            <div>
              <h2>
                Alunos <span>{rows.length}</span>
              </h2>
              <p aria-live="polite">
                <strong>
                  {present} {present === 1 ? "presente" : "presentes"}
                </strong>
                {" · "}
                {rows.length - present} {rows.length - present === 1 ? "ausente" : "ausentes"}
              </p>
            </div>
            {confirmed && !dirty && (
              <span className={styles.saved}>
                <Check aria-hidden="true" /> Chamada registrada
              </span>
            )}
          </div>
          {!confirmed && (
            <p className={styles.hint}>
              Quem confirma pelo QR ou link aparece como presente. Você pode ajustar qualquer aluno
              antes de salvar.
            </p>
          )}
          {rows.length > 8 && (
            <Input
              type="search"
              size="sm"
              placeholder="Buscar aluno"
              aria-label="Buscar aluno na chamada"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
          <ul className={styles.roster}>
            {visible.map((row) => (
              <li key={row.enrollmentId} className={styles.person}>
                <Avatar name={row.name} colorKey={row.studentId} size="sm" />
                <div className={styles.identity}>
                  <label htmlFor={`presence-${row.enrollmentId}`}>{row.name}</label>
                  <span>
                    {row.manual
                      ? "Ajustado por você"
                      : confirmed
                        ? (row.stage ?? "Presença registrada")
                        : row.declaration
                          ? `${row.declaration.format === "ONLINE" ? "Link" : "QR Code"} · ${attendanceTime(row.declaration.submittedAt)}`
                          : "Sem confirmação do aluno"}
                  </span>
                </div>
                <div className={styles.presence} data-present={row.present}>
                  <span aria-hidden="true">{row.present ? "Presente" : "Ausente"}</span>
                  <Switch
                    id={`presence-${row.enrollmentId}`}
                    aria-label={`Presença de ${row.name}`}
                    checked={row.present}
                    disabled={blocked}
                    onCheckedChange={(value) => {
                      onChange?.();
                      setOverrides((current) => ({ ...current, [row.enrollmentId]: value }));
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <p className={styles.hint}>
              {rows.length > 0
                ? "Nenhum aluno com esse nome."
                : "Não há alunos previstos para esta aula."}
            </p>
          )}
          {status.confirmationRestriction && <Alert>{status.confirmationRestriction}</Alert>}
          {error && (
            <Alert variant="destructive">
              {error.message}
              {error.conflict && onRefresh && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={refreshing}
                  onClick={onRefresh}
                >
                  Atualizar lista
                </Button>
              )}
            </Alert>
          )}
          <div className={styles.commit}>
            <p>
              {confirmed
                ? dirty
                  ? "Salve para registrar os ajustes."
                  : "A chamada foi conferida e está salva."
                : "Ao confirmar, a presença é registrada e o QR e o link são encerrados."}
            </p>
            {!status.confirmationRestriction && (
              <Button
                type="submit"
                disabled={blocked || rows.length === 0 || (confirmed && !dirty)}
              >
                <ClipboardCheck aria-hidden="true" />
                {saving ? "Salvando…" : confirmed ? "Salvar ajustes" : "Confirmar chamada"}
              </Button>
            )}
          </div>
        </form>
        <aside className={styles.sharing} aria-label="Compartilhar presença">
          {sharing}
          {onRecord && !data.restriction && (
            <Button
              variant="ghost"
              disabled={dirty || saving}
              title={dirty ? "Salve os ajustes da chamada antes de registrar a aula." : undefined}
              onClick={onRecord}
            >
              {data.version ? "Corrigir registro" : "Registrar aula"}
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
