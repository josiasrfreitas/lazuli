"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import { ToastAlert, Alert, Avatar, Button, Input, Switch } from "@lazuli/ui";
import type { RouterInputs } from "@lazuli/api";
import type { ClassRecord } from "~/features/class-records/shared";
import type { AttendanceStatus } from "./staff-section";
import { attendanceTime } from "./location";
import styles from "./teacher-page.module.css";

const ATTENDANCE_SEARCH_THRESHOLD = 8;
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

type ReviewProps = {
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
};
type ReviewRow = AttendanceReviewData["snapshot"]["entries"][number] & {
  declaration: AttendanceReviewStatus["declarations"][number] | undefined;
  present: boolean;
  manual: boolean;
};

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
}: ReviewProps): ReactJSX.Element {
  const confirmed = data.attendanceOnly || data.version > 0;
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const dirty = Object.keys(overrides).length > 0;
  useDirtyBeforeUnload(dirty, saved);
  const rows = buildReviewRows({ data, status, overrides, confirmed });
  const visible = rows.filter((row) => searchKey(row.name).includes(searchKey(search)));
  const present = rows.filter((row) => row.present).length;
  const blocked = Boolean(status.confirmationRestriction) || statusFailed || saving || refreshing;
  return (
    <div className={styles.layout}>
      <ReviewForm
        {...{
          data,
          status,
          rows,
          visible,
          present,
          confirmed,
          dirty,
          search,
          setSearch,
          blocked,
          saving,
          refreshing,
          error,
          onConfirm,
          onChange,
          onRefresh,
          setOverrides,
        }}
      />
      <ReviewSharing {...{ data, sharing, onRecord, dirty, saving }} />
    </div>
  );
}

function useDirtyBeforeUnload(dirty: boolean, saved: boolean): void {
  useEffect(() => {
    if (!dirty || saved) return;
    const warn = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);
}

function buildReviewRows({
  data,
  status,
  overrides,
  confirmed,
}: {
  data: AttendanceReviewData;
  status: AttendanceReviewStatus;
  overrides: Record<string, boolean>;
  confirmed: boolean;
}): ReviewRow[] {
  return data.snapshot.entries.map((row) => {
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
}

function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

type FormProps = {
  data: AttendanceReviewData;
  status: AttendanceReviewStatus;
  rows: ReviewRow[];
  visible: ReviewRow[];
  present: number;
  confirmed: boolean;
  dirty: boolean;
  search: string;
  setSearch: (value: string) => void;
  blocked: boolean;
  saving: boolean;
  refreshing: boolean;
  error: ReviewProps["error"];
  onConfirm: ReviewProps["onConfirm"];
  onChange: ReviewProps["onChange"];
  onRefresh: ReviewProps["onRefresh"];
  setOverrides: (update: (current: Record<string, boolean>) => Record<string, boolean>) => void;
};
function ReviewForm(props: FormProps): ReactJSX.Element {
  const {
    status,
    rows,
    visible,
    present,
    confirmed,
    dirty,
    search,
    setSearch,
    blocked,
    saving,
    refreshing,
    error,
    onChange,
    onRefresh,
    setOverrides,
  } = props;
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    submitReview(props);
  }
  return (
    <form className={styles.review} aria-label="Chamada da aula" noValidate onSubmit={submit}>
      <ReviewHeading rows={rows} present={present} confirmed={confirmed} dirty={dirty} />
      {!confirmed && (
        <p className={styles.hint}>
          Quem confirma pelo QR ou link aparece como presente. Você pode ajustar qualquer aluno
          antes de salvar.
        </p>
      )}
      <ReviewList
        {...{ rows, visible, search, setSearch, confirmed, blocked, onChange, setOverrides }}
      />
      <ReviewFeedback
        restriction={status.confirmationRestriction}
        error={error}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
      <ReviewCommit
        {...{ confirmed, dirty, saving, blocked }}
        count={rows.length}
        restriction={status.confirmationRestriction}
      />
    </form>
  );
}

function submitReview({
  data,
  status,
  rows,
  blocked,
  confirmed,
  dirty,
  onConfirm,
}: FormProps): void {
  if (blocked || rows.length === 0 || (confirmed && !dirty)) return;
  onConfirm({
    sessionId: data.session.id,
    attendanceStamp: data.attendanceStamp,
    declarationIds: status.declarations.map((row) => row.id),
    rows: rows.map((row) => ({
      enrollmentId: row.enrollmentId,
      status: row.present ? "PRESENT" : "ABSENT",
    })),
  });
}

function ReviewHeading({
  rows,
  present,
  confirmed,
  dirty,
}: {
  rows: ReviewRow[];
  present: number;
  confirmed: boolean;
  dirty: boolean;
}): ReactJSX.Element {
  return (
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
  );
}

type ListProps = Pick<
  FormProps,
  | "rows"
  | "visible"
  | "search"
  | "setSearch"
  | "confirmed"
  | "blocked"
  | "onChange"
  | "setOverrides"
>;
function ReviewList({
  rows,
  visible,
  search,
  setSearch,
  confirmed,
  blocked,
  onChange,
  setOverrides,
}: ListProps): ReactJSX.Element {
  return (
    <>
      {rows.length > ATTENDANCE_SEARCH_THRESHOLD && (
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
          <ReviewRowItem
            key={row.enrollmentId}
            row={row}
            confirmed={confirmed}
            blocked={blocked}
            onChange={onChange}
            setOverrides={setOverrides}
          />
        ))}
      </ul>
      {visible.length === 0 && (
        <p className={styles.hint}>
          {rows.length > 0
            ? "Nenhum aluno com esse nome."
            : "Não há alunos previstos para esta aula."}
        </p>
      )}
    </>
  );
}

function ReviewRowItem({
  row,
  confirmed,
  blocked,
  onChange,
  setOverrides,
}: {
  row: ReviewRow;
  confirmed: boolean;
  blocked: boolean;
  onChange: ReviewProps["onChange"];
  setOverrides: FormProps["setOverrides"];
}): ReactJSX.Element {
  return (
    <li className={styles.person}>
      <Avatar name={row.name} colorKey={row.studentId} size="sm" />
      <div className={styles.identity}>
        <label htmlFor={`presence-${row.enrollmentId}`}>{row.name}</label>
        <span>{rowStatusLabel(row, confirmed)}</span>
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
  );
}

function rowStatusLabel(row: ReviewRow, confirmed: boolean): string {
  if (row.manual) return "Ajustado por você";
  if (confirmed) return row.stage ?? "Presença registrada";
  if (!row.declaration) return "Sem confirmação do aluno";
  const channel = row.declaration.format === "ONLINE" ? "Link" : "QR Code";
  return `${channel} · ${attendanceTime(row.declaration.submittedAt)}`;
}

function ReviewFeedback({
  restriction,
  error,
  refreshing,
  onRefresh,
}: {
  restriction: string | null;
  error: ReviewProps["error"];
  refreshing: boolean;
  onRefresh: ReviewProps["onRefresh"];
}): ReactJSX.Element {
  return (
    <>
      {restriction && <Alert>{restriction}</Alert>}
      {error && (
        <ToastAlert variant="destructive">
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
        </ToastAlert>
      )}
    </>
  );
}

function ReviewCommit({
  confirmed,
  dirty,
  saving,
  blocked,
  count,
  restriction,
}: {
  confirmed: boolean;
  dirty: boolean;
  saving: boolean;
  blocked: boolean;
  count: number;
  restriction: string | null;
}): ReactJSX.Element {
  return (
    <div className={styles.commit}>
      <p>{commitMessage(confirmed, dirty)}</p>
      {!restriction && (
        <Button type="submit" disabled={blocked || count === 0 || (confirmed && !dirty)}>
          <ClipboardCheck aria-hidden="true" />
          {saveLabel(saving, confirmed)}
        </Button>
      )}
    </div>
  );
}

function saveLabel(saving: boolean, confirmed: boolean): string {
  if (saving) return "Salvando…";
  return confirmed ? "Salvar ajustes" : "Confirmar chamada";
}

function commitMessage(confirmed: boolean, dirty: boolean): string {
  if (!confirmed) return "Ao confirmar, a presença é registrada e o QR e o link são encerrados.";
  if (dirty) return "Salve para registrar os ajustes.";
  return "A chamada foi conferida e está salva.";
}

function ReviewSharing({
  data,
  sharing,
  onRecord,
  dirty,
  saving,
}: {
  data: AttendanceReviewData;
  sharing: ReactNode;
  onRecord: ReviewProps["onRecord"];
  dirty: boolean;
  saving: boolean;
}): ReactJSX.Element {
  return (
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
  );
}
