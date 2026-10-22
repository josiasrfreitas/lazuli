"use client";

import type { JSX as ReactJSX } from "react";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { RotateCcw, UserPlus } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { ONLINE_WINDOW_MINUTES } from "@lazuli/validators";
import { TeacherPage } from "~/features/teacher-workspace/shared";
import {
  AttendanceReview,
  type AttendanceReviewData,
  type AttendanceReviewInput,
  type AttendanceReviewStatus,
} from "./attendance-review";
import { AttendanceShareControls, type AttendanceShareAccess } from "./share-controls";
import styles from "./teacher-page.module.css";

const SHORT_PREVIEW_MINUTES = 10;
const MILLISECONDS_PER_MINUTE = 60_000;
const names = [
  "Ana Beatriz Martins",
  "Marcos Vinícius Costa",
  "Carlos Eduardo Lima",
  "Beatriz Oliveira Santos",
  "João Pedro Almeida",
  "Maria Clara Nascimento",
  "Letícia Fernandes",
  "Rafael Souza",
  "Sofia Rodrigues",
  "Gabriel Ferreira",
];
const roster: AttendanceReviewData["snapshot"]["entries"] = names.map((name, index) => ({
  enrollmentId: `preview-enrollment-${index}`,
  studentId: `preview-student-${index}`,
  name,
  stage: "Essentials 1",
  status: "ABSENT",
}));
function declaration(index: number): AttendanceReviewStatus["declarations"][number] {
  return {
    id: `preview-declaration-${index}`,
    enrollmentId: roster[index]!.enrollmentId,
    name: roster[index]!.name,
    submittedAt: new Date(),
    matchKind: "SELECTED",
    format: "ONLINE",
    accuracy: null,
    distance: null,
  };
}

type PreviewAttendance = {
  round: number;
  confirmed: boolean;
  entries: AttendanceReviewData["snapshot"]["entries"];
  declarations: AttendanceReviewStatus["declarations"];
  stamp: string | null;
  notice: string;
  setNotice: Dispatch<SetStateAction<string>>;
  receive: (index: number) => void;
  confirm: (input: AttendanceReviewInput) => void;
  reset: () => void;
};
function usePreviewAttendance(): PreviewAttendance {
  const [round, setRound] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [entries, setEntries] = useState(roster);
  const [declarations, setDeclarations] = useState(() => [declaration(1), declaration(2)]);
  const [notice, setNotice] = useState("");
  const [stamp, setStamp] = useState<string | null>(null);
  const receive = useCallback(
    (index: number) => {
      if (confirmed) return;
      const next = declaration(index);
      setDeclarations((current) =>
        current.some((row) => row.enrollmentId === next.enrollmentId)
          ? current
          : [...current, next],
      );
      setNotice(`Presença recebida de ${next.name}. Confira o switch na lista.`);
    },
    [confirmed],
  );
  function confirm(input: AttendanceReviewInput): void {
    setEntries((current) => confirmedEntries(current, input));
    setConfirmed(true);
    setStamp(new Date().toISOString());
    setRound((value) => value + 1);
    setNotice("Chamada confirmada na prévia. Nenhum registro real foi alterado.");
  }
  function reset(): void {
    setConfirmed(false);
    setEntries(roster);
    setDeclarations([declaration(1), declaration(2)]);
    setStamp(null);
    setNotice("");
    setRound((value) => value + 1);
  }
  return {
    round,
    confirmed,
    entries,
    declarations,
    stamp,
    notice,
    setNotice,
    receive,
    confirm,
    reset,
  };
}

function confirmedEntries(
  entries: AttendanceReviewData["snapshot"]["entries"],
  input: AttendanceReviewInput,
): AttendanceReviewData["snapshot"]["entries"] {
  return entries.map((row) => ({
    ...row,
    status: input.rows.find((value) => value.enrollmentId === row.enrollmentId)!.status,
  }));
}

type PreviewSharing = {
  access: AttendanceShareAccess | null;
  minutes: (typeof ONLINE_WINDOW_MINUTES)[number];
  previousLink: boolean;
  setMinutes: Dispatch<SetStateAction<(typeof ONLINE_WINDOW_MINUTES)[number]>>;
  generate: () => void;
  close: () => void;
  clear: () => void;
  reset: () => void;
};
function usePreviewSharing(setNotice: (value: string) => void): PreviewSharing {
  const [access, setAccess] = useState<AttendanceShareAccess | null>(null);
  const [minutes, setMinutes] =
    useState<(typeof ONLINE_WINDOW_MINUTES)[number]>(SHORT_PREVIEW_MINUTES);
  const [previousLink, setPreviousLink] = useState(false);
  function generate(): void {
    const origin = globalThis.location.origin;
    const instance = crypto.randomUUID();
    setAccess({
      url: `${origin}/presenca/previa?ensaio=${instance}`,
      projectionUrl: `${origin}/presenca/previa/projecao?ensaio=${instance}`,
      expiresAt: new Date(Date.now() + minutes * MILLISECONDS_PER_MINUTE),
    });
    setPreviousLink(true);
    setNotice("QR e link de demonstração abertos. Você já pode simular um envio.");
  }
  function close(): void {
    setAccess(null);
    setNotice("Link encerrado. As presenças recebidas continuam na lista.");
  }
  function reset(): void {
    setAccess(null);
    setPreviousLink(false);
    setMinutes(SHORT_PREVIEW_MINUTES);
  }
  return {
    access,
    minutes,
    previousLink,
    setMinutes,
    generate,
    close,
    clear: () => setAccess(null),
    reset,
  };
}

export function TeacherAttendancePreview(): ReactJSX.Element {
  const attendance = usePreviewAttendance();
  const sharing = usePreviewSharing(attendance.setNotice);
  const { access } = sharing;
  const { confirmed, receive } = attendance;
  useEffect(() => {
    if (!access || confirmed || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("lazuli-attendance-preview");
    channel.addEventListener("message", (event: MessageEvent<string>) => {
      if (event.data === "ana-present") receive(0);
    });
    return () => channel.close();
  }, [access, confirmed, receive]);
  const next = roster.findIndex(
    (row) => !attendance.declarations.some((value) => value.enrollmentId === row.enrollmentId),
  );
  const data: AttendanceReviewData = {
    session: { id: "preview-session" },
    attendanceOnly: confirmed,
    version: 0,
    attendanceStamp: attendance.stamp,
    restriction: null,
    snapshot: { entries: attendance.entries },
  };
  function confirm(input: AttendanceReviewInput): void {
    attendance.confirm(input);
    sharing.clear();
  }
  function reset(): void {
    attendance.reset();
    sharing.reset();
  }
  return (
    <PreviewPage
      attendance={attendance}
      sharing={sharing}
      data={data}
      next={next}
      confirm={confirm}
      reset={reset}
    />
  );
}

function PreviewPage({
  attendance,
  sharing,
  data,
  next,
  confirm,
  reset,
}: {
  attendance: PreviewAttendance;
  sharing: PreviewSharing;
  data: AttendanceReviewData;
  next: number;
  confirm: (input: AttendanceReviewInput) => void;
  reset: () => void;
}): ReactJSX.Element {
  return (
    <TeacherPage
      title="Chamada · Essentials 1"
      description="Prévia interativa · Aula online"
      back="/professor/agenda"
    >
      <PreviewTools
        access={sharing.access}
        confirmed={attendance.confirmed}
        next={next}
        receive={attendance.receive}
        reset={reset}
      />
      {attendance.notice && (
        <p role="status" className={styles.hint}>
          {attendance.notice}
        </p>
      )}
      <AttendanceReview
        key={attendance.round}
        data={data}
        status={{ declarations: attendance.declarations, confirmationRestriction: null }}
        onConfirm={confirm}
        sharing={<PreviewShareControls attendance={attendance} sharing={sharing} />}
      />
    </TeacherPage>
  );
}

function PreviewTools({
  access,
  confirmed,
  next,
  receive,
  reset,
}: {
  access: AttendanceShareAccess | null;
  confirmed: boolean;
  next: number;
  receive: (index: number) => void;
  reset: () => void;
}): ReactJSX.Element {
  return (
    <div className={styles.previewTools}>
      <p>Alunos fictícios. Nenhuma presença real é gravada.</p>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="compact-responsive"
          disabled={!access || confirmed || next === -1}
          onClick={() => receive(next)}
        >
          <UserPlus aria-hidden="true" /> Simular envio
        </Button>
        <Button variant="ghost" size="compact-responsive" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Reiniciar
        </Button>
      </div>
    </div>
  );
}

function PreviewShareControls({
  attendance,
  sharing,
}: {
  attendance: PreviewAttendance;
  sharing: PreviewSharing;
}): ReactJSX.Element {
  return (
    <AttendanceShareControls
      status={{
        format: "ONLINE",
        restriction: attendance.confirmed
          ? "Chamada conferida. Reinicie a prévia para receber novos envios."
          : null,
        active: Boolean(sharing.access),
      }}
      pending={false}
      generating={false}
      error={undefined}
      access={sharing.access}
      previousLink={sharing.previousLink}
      minutes={sharing.minutes}
      setMinutes={sharing.setMinutes}
      generate={sharing.generate}
      close={sharing.close}
    />
  );
}
