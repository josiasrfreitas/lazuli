"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, UserPlus } from "lucide-react";
import { Button } from "@lazuli/ui";
import { TeacherPage } from "~/features/teacher-workspace/shared";
import {
  AttendanceReview,
  type AttendanceReviewData,
  type AttendanceReviewInput,
  type AttendanceReviewStatus,
} from "./attendance-review";
import { AttendanceShareControls, type AttendanceShareAccess } from "./share-controls";
import styles from "./teacher-page.module.css";

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
    referenceAccuracy: null,
  };
}

export function TeacherAttendancePreview() {
  const [round, setRound] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [entries, setEntries] = useState(roster);
  const [declarations, setDeclarations] = useState(() => [declaration(1), declaration(2)]);
  const [access, setAccess] = useState<AttendanceShareAccess | null>(null);
  const [minutes, setMinutes] = useState<10 | 20 | 30>(10);
  const [previousLink, setPreviousLink] = useState(false);
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

  useEffect(() => {
    if (!access || confirmed || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("lazuli-attendance-preview");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === "ana-present") receive(0);
    };
    return () => channel.close();
  }, [access, confirmed, receive]);

  function generate() {
    const origin = window.location.origin;
    const instance = crypto.randomUUID();
    setAccess({
      url: `${origin}/presenca/previa?ensaio=${instance}`,
      projectionUrl: `${origin}/presenca/previa/projecao?ensaio=${instance}`,
      expiresAt: new Date(Date.now() + minutes * 60_000),
    });
    setPreviousLink(true);
    setNotice("QR e link de demonstração abertos. Você já pode simular um envio.");
  }

  function confirm(input: AttendanceReviewInput) {
    setEntries((current) =>
      current.map((row) => ({
        ...row,
        status: input.rows.find((value) => value.enrollmentId === row.enrollmentId)!.status,
      })),
    );
    setConfirmed(true);
    setAccess(null);
    setStamp(new Date().toISOString());
    setRound((value) => value + 1);
    setNotice("Chamada confirmada na prévia. Nenhum registro real foi alterado.");
  }

  function reset() {
    setConfirmed(false);
    setEntries(roster);
    setDeclarations([declaration(1), declaration(2)]);
    setAccess(null);
    setPreviousLink(false);
    setMinutes(10);
    setStamp(null);
    setNotice("");
    setRound((value) => value + 1);
  }

  const next = roster.findIndex(
    (row) => !declarations.some((value) => value.enrollmentId === row.enrollmentId),
  );
  const data: AttendanceReviewData = {
    session: { id: "preview-session" },
    attendanceOnly: confirmed,
    version: 0,
    attendanceStamp: stamp,
    restriction: null,
    snapshot: { entries },
  };

  return (
    <TeacherPage
      title="Chamada · Essentials 1"
      description="Prévia interativa · Aula online"
      back="/professor/agenda"
    >
      <div className={styles.previewTools}>
        <p>Alunos fictícios. Nenhuma presença real é gravada.</p>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="compact-responsive"
            disabled={!access || confirmed || next < 0}
            onClick={() => receive(next)}
          >
            <UserPlus aria-hidden="true" /> Simular envio
          </Button>
          <Button variant="ghost" size="compact-responsive" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Reiniciar
          </Button>
        </div>
      </div>
      {notice && (
        <p role="status" className={styles.hint}>
          {notice}
        </p>
      )}
      <AttendanceReview
        key={round}
        data={data}
        status={{ declarations, confirmationRestriction: null }}
        onConfirm={confirm}
        sharing={
          <AttendanceShareControls
            status={{
              format: "ONLINE",
              restriction: confirmed
                ? "Chamada conferida. Reinicie a prévia para receber novos envios."
                : null,
              active: Boolean(access),
            }}
            access={access}
            previousLink={previousLink}
            minutes={minutes}
            setMinutes={setMinutes}
            generate={generate}
            close={() => {
              setAccess(null);
              setNotice("Link encerrado. As presenças recebidas continuam na lista.");
            }}
          />
        }
      />
    </TeacherPage>
  );
}
