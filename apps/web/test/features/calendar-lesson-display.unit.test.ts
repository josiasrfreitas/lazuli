import assert from "node:assert/strict";
import { test } from "node:test";
import { lessonDisplay } from "../../src/features/class-records/calendar-lesson.js";
import type { CalendarLesson } from "../../src/features/class-records/calendar-model.js";

const regular: CalendarLesson = {
  id: "lesson-1",
  classId: "class-1",
  className: "Turma A",
  scheduleType: "REGULAR",
  stageName: "Curso - Etapa 2",
  date: "2026-10-21",
  startTime: "14:00",
  endTime: "15:00",
  teacherId: "teacher-1",
  teacher: "Camila",
  state: "UPCOMING",
  attendanceOnly: false,
  guestCount: 0,
};

void test("shows the correct calendar identity for regular and personalized lessons", () => {
  assert.deepEqual(lessonDisplay(regular), {
    id: undefined,
    title: "Etapa 2",
    context: "Turma A",
    status: "Agendada",
    kind: "Regular",
    modality: "REGULAR",
  });
  assert.deepEqual(
    lessonDisplay({
      ...regular,
      scheduleType: "PERSONALIZED",
      stageName: null,
      attendanceOnly: true,
    }),
    {
      id: undefined,
      title: "Estágios individuais",
      context: "Turma A",
      status: "Presença registrada",
      kind: "PPT",
      modality: "PERSONALIZED",
    },
  );
});

void test("distinguishes placement and experimental lessons, including overdue work", () => {
  const placement = {
    id: "visit-1",
    kind: "PLACEMENT",
    candidate: { fullName: "Lia" },
    status: "SCHEDULED",
    overdue: false,
  } as NonNullable<CalendarLesson["experimental"]>;
  assert.deepEqual(lessonDisplay({ ...regular, experimental: placement }), {
    id: "experimental-cell-visit-1",
    title: "Lia",
    context: "Nivelamento",
    status: "Agendada",
    kind: "Atendimento",
    modality: "EXPERIMENTAL",
  });
  assert.deepEqual(
    lessonDisplay({
      ...regular,
      experimental: { ...placement, kind: "TRIAL", overdue: true },
    }),
    {
      id: "experimental-cell-visit-1",
      title: "Lia",
      context: "Individual",
      status: "A registrar",
      kind: "Experimental",
      modality: "EXPERIMENTAL",
    },
  );
});

void test("labels a rescheduled appointment and keeps its own calendar identity", () => {
  const appointment = {
    id: "appointment-1",
    student: { name: "Davi" },
    purpose: "MAKEUP",
    status: "CANCELLED",
    rescheduledToId: "appointment-2",
    overdue: false,
  } as NonNullable<CalendarLesson["appointment"]>;
  assert.deepEqual(lessonDisplay({ ...regular, appointment }), {
    id: "appointment-cell-appointment-1",
    title: "Davi",
    context: "Reposição de falta",
    status: "Reagendado",
    kind: "Atendimento",
    modality: "APPOINTMENT",
  });
  assert.equal(
    lessonDisplay({ ...regular, appointment: { ...appointment, overdue: true } }).status,
    "A registrar",
  );
});
