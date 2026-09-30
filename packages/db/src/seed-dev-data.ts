/**
 * Deterministic development fixtures for the students vertical. Data only:
 * `seed-dev.ts` turns these seeds into idempotent upserts keyed by stable UUIDs.
 */

const DEFAULT_CAPACITY = 12;
const KIDS_CAPACITY = 8;

export type DevWeekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type DevScheduleSlot = {
  weekday: DevWeekday;
  /** HH:mm wall time (America/Sao_Paulo). */
  startTime: string;
  endTime: string;
};

export type DevTeacherSeed = { key: string; name: string; email: string };

export type DevClassSeed = {
  key: string;
  stageInternalCode: string;
  teacherKey: string;
  capacity: number;
  slots: DevScheduleSlot[];
};

export type DevGuardianSeed = {
  fullName: string;
  relationship: string;
  phone: string;
  email?: string;
};

export type DevExitReason = "SUSPENDED" | "DROPPED" | "COMPLETED";

export type DevEnrollmentSeed = {
  classKey: string;
  /** When set, the enrollment exits on the shared dev exit date (two weeks ago). */
  exitReason?: DevExitReason;
};

export type DevAttendanceProfile = "good" | "low";

export type DevStudentSeed = {
  key: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DROPPED";
  ageYears?: number;
  phone?: string;
  email?: string;
  guardian?: DevGuardianSeed;
  enrollments: DevEnrollmentSeed[];
  attendance: DevAttendanceProfile;
  notes?: string;
};

export const DEV_ADMIN = {
  email: "dev@lazuli.local",
  name: "Secretaria Lazuli",
} as const;

export const DEV_SYSTEM_ADMIN = {
  email: "sistema@lazuli.local",
  name: "Administrador do sistema",
} as const;

export const DEV_TEACHERS: readonly DevTeacherSeed[] = [
  { key: "camila", name: "Camila Duarte", email: "camila.duarte@lazuli.local" },
  { key: "rafael", name: "Rafael Mendes", email: "rafael.mendes@lazuli.local" },
  { key: "juliana", name: "Juliana Prado", email: "juliana.prado@lazuli.local" },
  { key: "heitor", name: "Heitor Vasconcelos", email: "heitor.vasconcelos@lazuli.local" },
];

export const DEV_CLASSES: readonly DevClassSeed[] = [
  {
    key: "E1A",
    stageInternalCode: "E1",
    teacherKey: "camila",
    capacity: DEFAULT_CAPACITY,
    slots: [
      { weekday: "TUESDAY", startTime: "19:00", endTime: "20:30" },
      { weekday: "THURSDAY", startTime: "19:00", endTime: "20:30" },
    ],
  },
  {
    key: "T2A",
    stageInternalCode: "T2",
    teacherKey: "rafael",
    capacity: DEFAULT_CAPACITY,
    slots: [
      { weekday: "MONDAY", startTime: "19:00", endTime: "20:30" },
      { weekday: "WEDNESDAY", startTime: "19:00", endTime: "20:30" },
    ],
  },
  {
    key: "F1A",
    stageInternalCode: "F1",
    teacherKey: "juliana",
    capacity: DEFAULT_CAPACITY,
    slots: [{ weekday: "SATURDAY", startTime: "09:00", endTime: "12:00" }],
  },
  {
    key: "MWYA",
    stageInternalCode: "MWY",
    teacherKey: "juliana",
    capacity: KIDS_CAPACITY,
    slots: [
      { weekday: "TUESDAY", startTime: "14:00", endTime: "15:00" },
      { weekday: "THURSDAY", startTime: "14:00", endTime: "15:00" },
    ],
  },
  {
    key: "C2A",
    stageInternalCode: "C2",
    teacherKey: "heitor",
    capacity: DEFAULT_CAPACITY,
    slots: [
      { weekday: "MONDAY", startTime: "15:30", endTime: "17:00" },
      { weekday: "WEDNESDAY", startTime: "15:30", endTime: "17:00" },
    ],
  },
  {
    key: "S1A",
    stageInternalCode: "S1",
    teacherKey: "rafael",
    capacity: DEFAULT_CAPACITY,
    slots: [{ weekday: "FRIDAY", startTime: "19:00", endTime: "21:00" }],
  },
];

export const DEV_STUDENTS: readonly DevStudentSeed[] = [
  {
    key: "ana",
    fullName: "Ana Beatriz Rocha",
    status: "ACTIVE",
    ageYears: 28,
    phone: "(11) 98801-2233",
    email: "ana.rocha@example.com",
    enrollments: [{ classKey: "T2A" }],
    attendance: "good",
    notes: "Prefere contato por WhatsApp.",
  },
  {
    key: "bruno",
    fullName: "Bruno Carvalho",
    status: "ACTIVE",
    ageYears: 35,
    phone: "(11) 98712-4455",
    email: "bruno.carvalho@example.com",
    enrollments: [{ classKey: "E1A" }],
    attendance: "good",
  },
  {
    key: "carla",
    fullName: "Carla Menezes",
    status: "ACTIVE",
    ageYears: 39,
    phone: "(11) 99655-7788",
    enrollments: [{ classKey: "E1A" }],
    attendance: "good",
  },
  {
    key: "davi",
    fullName: "Davi Lucca Ferreira",
    status: "ACTIVE",
    ageYears: 13,
    phone: "(11) 98123-9012",
    guardian: {
      fullName: "Patrícia Ferreira",
      relationship: "Mãe",
      phone: "(11) 98123-9012",
      email: "patricia.ferreira@example.com",
    },
    enrollments: [{ classKey: "C2A" }],
    attendance: "good",
  },
  {
    key: "elisa",
    fullName: "Elisa Prado Martins",
    status: "ACTIVE",
    ageYears: 8,
    guardian: {
      fullName: "Renata Martins",
      relationship: "Mãe",
      phone: "(11) 99320-6677",
      email: "renata.martins@example.com",
    },
    enrollments: [{ classKey: "MWYA" }],
    attendance: "good",
  },
  {
    key: "felipe",
    fullName: "Felipe Andrade",
    status: "ACTIVE",
    ageYears: 31,
    phone: "(11) 97244-1100",
    email: "felipe.andrade@example.com",
    enrollments: [{ classKey: "F1A" }],
    attendance: "low",
  },
  {
    key: "gabriela",
    fullName: "Gabriela Nunes",
    status: "ACTIVE",
    ageYears: 27,
    phone: "(11) 98466-3322",
    email: "gabriela.nunes@example.com",
    enrollments: [{ classKey: "S1A" }, { classKey: "F1A" }],
    attendance: "good",
  },
  {
    key: "henrique",
    fullName: "Henrique Sales",
    status: "ACTIVE",
    ageYears: 42,
    phone: "(11) 99870-5544",
    enrollments: [],
    attendance: "good",
    notes: "Aguardando definição de turma.",
  },
  {
    key: "isadora",
    fullName: "Isadora Campos",
    status: "ACTIVE",
    ageYears: 14,
    guardian: {
      fullName: "Carlos Campos",
      relationship: "Pai",
      phone: "(11) 98005-8899",
    },
    enrollments: [{ classKey: "C2A" }],
    attendance: "good",
  },
  {
    key: "joao",
    fullName: "João Pedro Almeida",
    status: "ACTIVE",
    ageYears: 25,
    phone: "(11) 97551-2266",
    email: "joao.almeida@example.com",
    enrollments: [{ classKey: "T2A" }],
    attendance: "good",
  },
  {
    key: "larissa",
    fullName: "Larissa Fontes",
    status: "ACTIVE",
    ageYears: 33,
    phone: "(11) 99118-7733",
    enrollments: [{ classKey: "E1A" }],
    attendance: "good",
  },
  {
    key: "marcos",
    fullName: "Marcos Vinícius Teles",
    status: "INACTIVE",
    ageYears: 37,
    phone: "(11) 98290-4411",
    enrollments: [{ classKey: "T2A", exitReason: "COMPLETED" }],
    attendance: "good",
  },
  {
    key: "natalia",
    fullName: "Natália Borges",
    status: "SUSPENDED",
    ageYears: 30,
    phone: "(11) 97633-9955",
    enrollments: [{ classKey: "F1A", exitReason: "SUSPENDED" }],
    attendance: "good",
    notes: "Matrícula trancada a pedido da aluna.",
  },
  {
    key: "otavio",
    fullName: "Otávio Ramos",
    status: "DROPPED",
    ageYears: 34,
    phone: "(11) 98944-6600",
    enrollments: [{ classKey: "S1A", exitReason: "DROPPED" }],
    attendance: "low",
  },
  {
    key: "priscila",
    fullName: "Priscila Duarte Lima",
    status: "ACTIVE",
    ageYears: 29,
    phone: "(11) 99402-1188",
    email: "priscila.lima@example.com",
    enrollments: [{ classKey: "S1A" }],
    attendance: "good",
  },
  {
    key: "theo",
    fullName: "Théo Siqueira",
    status: "ACTIVE",
    ageYears: 7,
    guardian: {
      fullName: "Mônica Siqueira",
      relationship: "Mãe",
      phone: "(11) 98077-3300",
      email: "monica.siqueira@example.com",
    },
    enrollments: [{ classKey: "MWYA" }],
    attendance: "good",
  },
];
