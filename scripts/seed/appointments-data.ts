import type { StaffUser } from "../../packages/api/src/trpc/context.js";
import type { TransactionClient } from "../../packages/db/src/client.js";
import { addDays, isoOf, utcDate } from "../../packages/db/src/seed-dev-support.js";
import { sessionEndInstant } from "../../packages/domain/src/session-time.js";

const MILLISECONDS_PER_MINUTE = 60_000;
const SATURDAY = 6;

export type SeedPurpose = "MAKEUP" | "PPT_COMPLEMENT" | "REINFORCEMENT" | "ASSESSMENT";
export type AppointmentSeedContext = {
  database: TransactionClient;
  admin: StaffUser;
  teachers: StaffUser[];
  todayIso: string;
};
export type AppointmentEnrollment = {
  id: string;
  studentId: string;
  entryDate: Date;
  exitDate: Date | null;
  student: { fullName: string; guardianId: string | null };
  class: {
    id: string;
    teacherId: string | null;
    format: "IN_PERSON" | "ONLINE";
    scheduleType: "REGULAR" | "PERSONALIZED";
  };
};
export type SeedAbsence = {
  id: string;
  enrollmentId: string;
  studentId: string;
  date: Date;
  confirmedAt: Date;
  minutes: number;
  sourceContent: string | null;
};
export type SeedCoverage = { attendanceId: string; minutes: number };

export const SUPPORT_SCENARIOS: readonly {
  key: string;
  studentIndex: number;
  purpose: SeedPurpose;
  status: "SCHEDULED" | "ATTENDED" | "NO_SHOW";
  minutes: number;
  plannedContent: string;
  performedContent: string;
}[] = [
  {
    key: "ppt-complement-attended",
    studentIndex: 130,
    purpose: "PPT_COMPLEMENT",
    status: "ATTENDED",
    minutes: 60,
    plannedContent: "Complementar a prática individual de escuta e conversação do estágio atual.",
    performedContent:
      "Sessão individual de escuta e diálogo, com repetição guiada e devolutiva sobre a construção das respostas.",
  },
  {
    key: "ppt-complement-scheduled",
    studentIndex: 143,
    purpose: "PPT_COMPLEMENT",
    status: "SCHEDULED",
    minutes: 60,
    plannedContent:
      "Complementar o tempo de prática do PPT com vocabulário e perguntas do cotidiano.",
    performedContent: "",
  },
  {
    key: "reinforcement-attended",
    studentIndex: 64,
    purpose: "REINFORCEMENT",
    status: "ATTENDED",
    minutes: 45,
    plannedContent: "Retomar a compreensão oral com apoio visual e tempo para dúvidas.",
    performedContent:
      "Revisamos instruções e perguntas com imagens, escuta em pequenos trechos e nova tentativa após orientação.",
  },
  {
    key: "reinforcement-no-show",
    studentIndex: 211,
    purpose: "REINFORCEMENT",
    status: "NO_SHOW",
    minutes: 45,
    plannedContent:
      "Prática online de conversação e esclarecimento de dúvidas, sem falta de origem.",
    performedContent: "",
  },
  {
    key: "assessment-attended",
    studentIndex: 150,
    purpose: "ASSESSMENT",
    status: "ATTENDED",
    minutes: 45,
    plannedContent:
      "Atendimento de avaliação oral; o lançamento da nota permanece na avaliação de estágio.",
    performedContent:
      "Realizada atividade oral individual com perguntas e situações do cotidiano. Nota e decisão pedagógica aguardam registro no estágio.",
  },
  {
    key: "assessment-scheduled",
    studentIndex: 153,
    purpose: "ASSESSMENT",
    status: "SCHEDULED",
    minutes: 45,
    plannedContent: "Reservar horário para avaliação de compreensão oral do estágio atual.",
    performedContent: "",
  },
];

export function businessInstant(date: Date, time: string): Date {
  return sessionEndInstant({ date, endTime: time });
}

export function minutesAfter(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MILLISECONDS_PER_MINUTE);
}

export function previousWeekday(date: Date): Date {
  let previous = addDays(date, -1);
  while (previous.getUTCDay() === 0 || previous.getUTCDay() === SATURDAY)
    previous = addDays(previous, -1);
  return previous;
}

export function nextWeekday(date: Date): Date {
  let next = date;
  while (next.getUTCDay() === 0 || next.getUTCDay() === SATURDAY) next = addDays(next, 1);
  return next;
}

export function sourcePlan(absences: SeedAbsence[]): string | null {
  const known = absences.filter((source) => source.sourceContent);
  if (known.length === 0) return null;
  return known
    .map(
      (source) =>
        `${isoOf(source.date).split("-").toReversed().join("/")}: ${source.sourceContent}`,
    )
    .join("\n");
}

export function scenarioDate(todayIso: string, offset: number): Date {
  return addDays(utcDate(todayIso), offset);
}
