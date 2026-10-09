/** One school scenario, shared by academic and financial loading. */

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
  scheduleType?: "REGULAR" | "PERSONALIZED";
  stageInternalCode: string;
  teacherKey: string;
  capacity: number;
  studentCount: number;
  minimumAge: number;
  ageSpread: number;
  slots: DevScheduleSlot[];
};

export type DevGuardianSeed = {
  fullName: string;
  relationship: string;
  phone: string;
  email?: string;
};

export type DevEnrollmentSeed = {
  classKey: string;
  stageInternalCode?: string;
};

export type DevAttendanceProfile = "good" | "low";

export type DevStudentSeed = {
  key: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DROPPED";
  ageYears?: number;
  birthdayOffsetDays?: number;
  phone?: string;
  email?: string;
  guardian?: DevGuardianSeed;
  enrollments: DevEnrollmentSeed[];
  attendance: DevAttendanceProfile;
  notes?: string;
};

export const DEV_ADMIN = {
  email: "dev@lazuli.local",
  name: "Clara Ribeiro",
} as const;

export const DEV_SYSTEM_ADMIN = {
  email: "sistema@lazuli.local",
  name: "Marcelo Nogueira",
} as const;

export const DEV_TEACHERS: readonly DevTeacherSeed[] = [
  { key: "camila", name: "Camila Duarte", email: "camila.duarte@lazuli.local" },
  { key: "rafael", name: "Rafael Mendes", email: "rafael.mendes@lazuli.local" },
  { key: "juliana", name: "Juliana Prado", email: "juliana.prado@lazuli.local" },
  { key: "heitor", name: "Heitor Vasconcelos", email: "heitor.vasconcelos@lazuli.local" },
  { key: "beatriz", name: "Beatriz Albuquerque", email: "beatriz.albuquerque@lazuli.local" },
  { key: "lucas", name: "Lucas Monteiro", email: "lucas.monteiro@lazuli.local" },
  { key: "renata", name: "Renata Cavalcanti", email: "renata.cavalcanti@lazuli.local" },
];

const ADULT_AGE = 18;

// 160 students, with a mean of ten per class. Teachers' slots do not overlap.
const CLASS_PROFILES = [
  { key: "MWYA", stageInternalCode: "MWY", studentCount: 8, minimumAge: 6, ageSpread: 3 },
  { key: "MWBA", stageInternalCode: "MWB", studentCount: 10, minimumAge: 7, ageSpread: 3 },
  { key: "MWRA", stageInternalCode: "MWR", studentCount: 11, minimumAge: 8, ageSpread: 3 },
  { key: "MWGA", stageInternalCode: "MWG", studentCount: 9, minimumAge: 9, ageSpread: 3 },
  { key: "C1A", stageInternalCode: "C1", studentCount: 12, minimumAge: 11, ageSpread: 3 },
  { key: "C2A", stageInternalCode: "C2", studentCount: 10, minimumAge: 12, ageSpread: 3 },
  { key: "C3A", stageInternalCode: "C3", studentCount: 14, minimumAge: 13, ageSpread: 3 },
  { key: "C4A", stageInternalCode: "C4", studentCount: 8, minimumAge: 14, ageSpread: 3 },
  { key: "E1A", stageInternalCode: "E1", studentCount: 11, minimumAge: 15, ageSpread: 3 },
  { key: "T2A", stageInternalCode: "T2", studentCount: 9, minimumAge: 15, ageSpread: 3 },
  { key: "F1A", stageInternalCode: "F1", studentCount: 12, minimumAge: 18, ageSpread: 22 },
  { key: "S1A", stageInternalCode: "S1", studentCount: 10, minimumAge: 20, ageSpread: 25 },
  { key: "E2A", stageInternalCode: "E2", studentCount: 4, minimumAge: 15, ageSpread: 3 },
  { key: "PPT-E1", stageInternalCode: "E1", studentCount: 10, minimumAge: 14, ageSpread: 3 },
  { key: "PPT-C2", stageInternalCode: "C2", studentCount: 10, minimumAge: 12, ageSpread: 3 },
  { key: "PPT-T1", stageInternalCode: "T1", studentCount: 12, minimumAge: 18, ageSpread: 20 },
] as const;

export const DEV_CLASSES: readonly DevClassSeed[] = CLASS_PROFILES.map((profile, index) => ({
  key: profile.key,
  scheduleType: profile.key.startsWith("PPT") ? "PERSONALIZED" : "REGULAR",
  stageInternalCode: profile.stageInternalCode,
  teacherKey: DEV_TEACHERS[index % DEV_TEACHERS.length]!.key,
  capacity: 25,
  studentCount: profile.studentCount,
  minimumAge: profile.minimumAge,
  ageSpread: profile.ageSpread,
  slots: classSlots(index),
}));

function classSlots(index: number): DevScheduleSlot[] {
  const windows = [
    { startTime: "14:00", endTime: "15:30" },
    { startTime: "16:00", endTime: "17:30" },
    { startTime: "19:00", endTime: "20:30" },
  ] as const;
  // Adults meet in the evening; the younger groups attend in the afternoon.
  const evening = CLASS_PROFILES[index]!.minimumAge >= ADULT_AGE;
  const window =
    CLASS_PROFILES[index]!.key === "PPT-C2"
      ? { startTime: "17:30", endTime: "19:00" }
      : windows[evening ? 2 : Math.floor(index / DEV_TEACHERS.length) % 2]!;
  const weekdays: DevWeekday[] =
    index % 2 === 0 ? ["MONDAY", "WEDNESDAY"] : ["TUESDAY", "THURSDAY"];
  return weekdays.map((weekday) => ({ weekday, ...window }));
}

const FIRST_NAMES = [
  "Ana Beatriz",
  "Bruno",
  "Carolina",
  "Davi Lucca",
  "Elisa",
  "Felipe",
  "Gabriela",
  "Henrique",
  "Isadora",
  "João Pedro",
  "Larissa",
  "Marcos Vinícius",
  "Natália",
  "Otávio",
  "Priscila",
  "Théo",
  "Marina",
  "Arthur",
  "Cecília",
  "Daniel",
  "Eduarda",
  "Francisco",
  "Helena",
  "Igor",
  "Júlia",
  "Leonardo",
  "Luísa",
  "Miguel",
  "Manuela",
  "Nicolas",
  "Olívia",
  "Pedro Henrique",
  "Rafaela",
  "Samuel",
  "Sofia",
  "Tomás",
  "Valentina",
  "Vinícius",
  "Yasmin",
  "Alice",
] as const;
const SURNAMES = [
  "Rocha",
  "Carvalho",
  "Menezes",
  "Ferreira",
  "Martins",
  "Andrade",
  "Nunes",
  "Sales",
  "Campos",
  "Almeida",
  "Fontes",
  "Teles",
  "Borges",
  "Ramos",
  "Lima",
  "Siqueira",
  "Azevedo",
  "Barbosa",
  "Costa",
  "Oliveira",
  "Pereira",
  "Santana",
  "Teixeira",
  "Moreira",
  "Farias",
  "Cunha",
  "Moura",
  "Batista",
  "Correia",
  "Dias",
  "Rezende",
  "Lacerda",
] as const;
const GUARDIAN_NAMES = [
  "Patrícia",
  "Carlos",
  "Mônica",
  "Eduardo",
  "Fernanda",
  "Rodrigo",
  "Adriana",
  "André",
] as const;
// Preserve existing fixture keys even though their scenario is rebuilt.
const EXISTING_KEYS = [
  "ana",
  "bruno",
  "carla",
  "davi",
  "elisa",
  "felipe",
  "gabriela",
  "henrique",
  "isadora",
  "joao",
  "larissa",
  "marcos",
  "natalia",
  "otavio",
  "priscila",
  "theo",
  "ppt-example",
  ...Array.from({ length: 18 }, (_unused, index) => `occupancy-E1A-${index + 1}`),
  ...Array.from({ length: 13 }, (_unused, index) => `occupancy-T2A-${index + 1}`),
];

const SURNAME_STRIDE = 7;
const SECOND_SURNAME_STRIDE = 11;
const SECOND_SURNAME_OFFSET = 5;
const PHONE_PREFIX = 8100;
const PHONE_SUFFIX = 1200;
const PHONE_STRIDE = 37;
const PHONE_SUFFIX_LENGTH = 4;
const BIRTHDAY_STRIDE = 47;
const BIRTHDAY_VARIATIONS = 330;
const LOW_ATTENDANCE_CYCLE = 17;
const CHILD_PPT_STAGES = ["C1", "C2", "C3"];
const TEEN_PPT_STAGES = ["E1", "E2", "T1"];

export const DEV_STUDENTS: readonly DevStudentSeed[] = buildStudents();

function buildStudents(): DevStudentSeed[] {
  const students: DevStudentSeed[] = [];
  for (const classroom of DEV_CLASSES) {
    for (let position = 0; position < classroom.studentCount; position += 1) {
      students.push(studentProfile(classroom, { position, index: students.length }));
    }
  }
  return students;
}

function studentProfile(
  classroom: DevClassSeed,
  input: { position: number; index: number },
): DevStudentSeed {
  const { position, index } = input;
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length]!;
  const surname =
    SURNAMES[(index * SURNAME_STRIDE + Math.floor(index / FIRST_NAMES.length)) % SURNAMES.length]!;
  const secondSurname =
    SURNAMES[(index * SECOND_SURNAME_STRIDE + SECOND_SURNAME_OFFSET) % SURNAMES.length]!;
  const fullName = `${firstName} ${surname}${surname === secondSurname ? "" : ` ${secondSurname}`}`;
  const ageYears = classroom.minimumAge + (position % classroom.ageSpread);
  const phone = `(82) 9${String(PHONE_PREFIX + index)}-${String(PHONE_SUFFIX + index * PHONE_STRIDE).padStart(PHONE_SUFFIX_LENGTH, "0")}`;
  const guardian =
    ageYears < ADULT_AGE
      ? {
          fullName: `${GUARDIAN_NAMES[index % GUARDIAN_NAMES.length]} ${surname} ${secondSurname}`,
          relationship: index % 2 === 0 ? "Mãe" : "Pai",
          phone,
          email: `familia.${emailSlug(fullName)}@example.com`,
        }
      : undefined;
  return {
    key: EXISTING_KEYS[index] ?? `school-student-${index + 1}`,
    fullName,
    status: "ACTIVE",
    ageYears,
    birthdayOffsetDays: (index * BIRTHDAY_STRIDE) % BIRTHDAY_VARIATIONS,
    phone,
    email: `${emailSlug(fullName)}@example.com`,
    ...(guardian ? { guardian } : {}),
    enrollments: [
      {
        classKey: classroom.key,
        ...(classroom.scheduleType === "PERSONALIZED"
          ? {
              stageInternalCode: classroom.stageInternalCode.startsWith("C")
                ? CHILD_PPT_STAGES[position % CHILD_PPT_STAGES.length]!
                : TEEN_PPT_STAGES[position % TEEN_PPT_STAGES.length]!,
            }
          : {}),
      },
    ],
    attendance: index % LOW_ATTENDANCE_CYCLE === 0 ? "low" : "good",
  };
}

function emailSlug(name: string): string {
  return name
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/gu, "")
    .toLowerCase()
    .replaceAll(/\s+/gu, ".");
}
