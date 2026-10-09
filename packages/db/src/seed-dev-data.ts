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

// 160 students, with a mean of ten per class. Teachers' slots do not overlap.
const CLASS_PROFILES = [
  ["MWYA", "MWY", 8, 6, 3],
  ["MWBA", "MWB", 10, 7, 3],
  ["MWRA", "MWR", 11, 8, 3],
  ["MWGA", "MWG", 9, 9, 3],
  ["C1A", "C1", 12, 11, 3],
  ["C2A", "C2", 10, 12, 3],
  ["C3A", "C3", 14, 13, 3],
  ["C4A", "C4", 8, 14, 3],
  ["E1A", "E1", 11, 15, 3],
  ["T2A", "T2", 9, 15, 3],
  ["F1A", "F1", 12, 18, 22],
  ["S1A", "S1", 10, 20, 25],
  ["E2A", "E2", 4, 15, 3],
  ["PPT-E1", "E1", 10, 14, 3],
  ["PPT-C2", "C2", 10, 12, 3],
  ["PPT-T1", "T1", 12, 18, 20],
] as const;

export const DEV_CLASSES: readonly DevClassSeed[] = CLASS_PROFILES.map((profile, index) => ({
  key: profile[0],
  scheduleType: profile[0].startsWith("PPT") ? "PERSONALIZED" : "REGULAR",
  stageInternalCode: profile[1],
  teacherKey: DEV_TEACHERS[index % DEV_TEACHERS.length]!.key,
  capacity: 25,
  studentCount: profile[2],
  minimumAge: profile[3],
  ageSpread: profile[4],
  slots: classSlots(index),
}));

function classSlots(index: number): DevScheduleSlot[] {
  const windows = [
    { startTime: "14:00", endTime: "15:30" },
    { startTime: "16:00", endTime: "17:30" },
    { startTime: "19:00", endTime: "20:30" },
  ] as const;
  // Adults meet in the evening; the younger groups attend in the afternoon.
  const evening = [10, 11, 15].includes(index);
  const window =
    index === 14
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
  ...Array.from({ length: 18 }, (_, index) => `occupancy-E1A-${index + 1}`),
  ...Array.from({ length: 13 }, (_, index) => `occupancy-T2A-${index + 1}`),
];

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
  const surname = SURNAMES[(index * 7 + Math.floor(index / FIRST_NAMES.length)) % SURNAMES.length]!;
  const secondSurname = SURNAMES[(index * 11 + 5) % SURNAMES.length]!;
  const fullName = `${firstName} ${surname}${surname === secondSurname ? "" : ` ${secondSurname}`}`;
  const ageYears = classroom.minimumAge + (position % classroom.ageSpread);
  const phone = `(82) 9${String(8100 + index)}-${String(1200 + index * 37).padStart(4, "0")}`;
  const guardian =
    ageYears < 18
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
    birthdayOffsetDays: (index * 47) % 330,
    phone,
    email: `${emailSlug(fullName)}@example.com`,
    ...(guardian ? { guardian } : {}),
    enrollments: [
      {
        classKey: classroom.key,
        ...(classroom.scheduleType === "PERSONALIZED"
          ? {
              stageInternalCode: classroom.stageInternalCode.startsWith("C")
                ? ["C1", "C2", "C3"][position % 3]!
                : ["E1", "E2", "T1"][position % 3]!,
            }
          : {}),
      },
    ],
    attendance: index % 17 === 0 ? "low" : "good",
  };
}

function emailSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, ".");
}
