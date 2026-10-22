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
  format?: "IN_PERSON" | "ONLINE";
  stageInternalCode: string;
  teacherKey: string;
  capacity: number;
  studentCount: number;
  minimumAge: number;
  ageSpread: number;
  slots: DevScheduleSlot[];
};

export type DevGuardianSeed = {
  key?: string;
  fullName: string;
  relationship: string;
  phone: string;
  email?: string;
};

export type DevEnrollmentSeed = {
  classKey: string;
  stageInternalCode?: string;
  /** Civil days after semester start, capped at the seed business date. */
  entryOffsetDays?: number;
  previousStageInternalCode?: string;
};

export type DevAttendanceProfile = "good" | "low";

export type DevFinanceProfile = "punctual" | "partial" | "overdue" | "late-settled";

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
  financeProfile?: DevFinanceProfile;
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
const REGULAR_CAPACITY = 16;
const PERSONALIZED_CAPACITY = 12;
const ORIGINAL_CLASS_COUNT = 16;
const ORIGINAL_STUDENT_COUNT = 160;
const SIBLING_STUDENT_LIMIT = 190;
const UNALLOCATED_STUDENTS = 30;
const WAITING_STUDENTS = 10;
const PAUSED_STUDENT_LIMIT = 20;
const EVENING_MINIMUM_AGE = 16;
const FINANCE_PROFILE_CYCLE = 20;
const FINANCE_PROFILES: readonly DevFinanceProfile[] = ["overdue", "partial", "late-settled"];
const MONDAY_WEDNESDAY: DevWeekday[] = ["MONDAY", "WEDNESDAY"];
const TUESDAY_THURSDAY: DevWeekday[] = ["TUESDAY", "THURSDAY"];
const LATE_ENTRY_CYCLE = 11;
const MID_ENTRY_CYCLE = 7;
const LATE_ENTRY_OFFSET_DAYS = 35;
const MID_ENTRY_OFFSET_DAYS = 14;
const PPT_STAGE_CYCLE = 3;
const CLASS_WINDOWS = [
  { startTime: "14:00", endTime: "15:30" },
  { startTime: "16:00", endTime: "17:30" },
  { startTime: "19:00", endTime: "20:30" },
] as const;

// The original 160-student scenario stays first, preserving every student/class key.
// Six further classes bring active occupancy to 220; thirty records are unallocated.
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
  { key: "MWYB", stageInternalCode: "MWY", studentCount: 10, minimumAge: 6, ageSpread: 3 },
  { key: "C1B", stageInternalCode: "C1", studentCount: 10, minimumAge: 11, ageSpread: 3 },
  { key: "C2B", stageInternalCode: "C2", studentCount: 10, minimumAge: 12, ageSpread: 3 },
  { key: "E1B", stageInternalCode: "E1", studentCount: 10, minimumAge: 16, ageSpread: 5 },
  { key: "T1A", stageInternalCode: "T1", studentCount: 10, minimumAge: 18, ageSpread: 18 },
  { key: "S2A", stageInternalCode: "S2", studentCount: 10, minimumAge: 22, ageSpread: 25 },
] as const;

export const DEV_CLASSES: readonly DevClassSeed[] = CLASS_PROFILES.map((profile, index) => ({
  key: profile.key,
  scheduleType: profile.key.startsWith("PPT") ? "PERSONALIZED" : "REGULAR",
  format: profile.key === "S2A" ? "ONLINE" : "IN_PERSON",
  stageInternalCode: profile.stageInternalCode,
  teacherKey: DEV_TEACHERS[index % DEV_TEACHERS.length]!.key,
  capacity: profile.key.startsWith("PPT") ? PERSONALIZED_CAPACITY : REGULAR_CAPACITY,
  studentCount: profile.studentCount,
  minimumAge: profile.minimumAge,
  ageSpread: profile.ageSpread,
  slots: classSlots(index),
}));

function classSlots(index: number): DevScheduleSlot[] {
  if (index >= ORIGINAL_CLASS_COUNT) return additionalClassSlots(index);
  // Adults meet in the evening; the younger groups attend in the afternoon.
  const evening = CLASS_PROFILES[index]!.minimumAge >= ADULT_AGE;
  const window =
    CLASS_PROFILES[index]!.key === "PPT-C2"
      ? { startTime: "17:30", endTime: CLASS_WINDOWS[2].startTime }
      : CLASS_WINDOWS[evening ? 2 : Math.floor(index / DEV_TEACHERS.length) % 2]!;
  const weekdays: DevWeekday[] = index % 2 === 0 ? MONDAY_WEDNESDAY : TUESDAY_THURSDAY;
  return weekdays.map((weekday) => ({ weekday, ...window }));
}

function additionalClassSlots(index: number): DevScheduleSlot[] {
  const evening = CLASS_PROFILES[index]!.minimumAge >= EVENING_MINIMUM_AGE;
  const monday = evening ? index % 2 === 0 : index % 2 !== 0;
  const weekdays = monday ? MONDAY_WEDNESDAY : TUESDAY_THURSDAY;
  const window = CLASS_WINDOWS[evening ? 2 : 0];
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
const FAMILY_SURNAME_START = -2;
const PHONE_PREFIX = 8100;
const PHONE_SUFFIX = 1200;
const PHONE_STRIDE = 37;
const PHONE_SUFFIX_LENGTH = 4;
const PHONE_SUFFIX_VARIATIONS = 8800;
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
  shareFamily(students);
  const unallocatedClass = DEV_CLASSES.find((classroom) => classroom.key === "E1B")!;
  for (let position = 0; position < UNALLOCATED_STUDENTS; position += 1) {
    const student = studentProfile(unallocatedClass, { position, index: students.length });
    student.enrollments = [];
    Object.assign(student, unallocatedProfile(position));
    students.push(student);
  }
  return students;
}

function unallocatedProfile(position: number): Pick<DevStudentSeed, "status" | "notes"> {
  if (position < WAITING_STUDENTS)
    return {
      status: "ACTIVE",
      notes: "Cadastro concluído; aguardando definição de horário e alocação.",
    };
  if (position < PAUSED_STUDENT_LIMIT)
    return {
      status: "SUSPENDED",
      notes: "Estudos pausados a pedido da família; sem alocação vigente.",
    };
  return {
    status: "INACTIVE",
    notes: "Ex-aluno sem vínculo vigente; contato autorizado para futura retomada.",
  };
}

/** New sibling pairs share one guardian and payer; existing guardian identifiers stay stable. */
function shareFamily(students: DevStudentSeed[]): void {
  for (let index = ORIGINAL_STUDENT_COUNT; index < SIBLING_STUDENT_LIMIT; index += 2) {
    const older = students[index]!;
    const younger = students[index + 1]!;
    const guardian = { ...older.guardian!, key: older.key };
    older.guardian = guardian;
    younger.guardian = guardian;
    younger.fullName = `${FIRST_NAMES[(index + 1) % FIRST_NAMES.length]} ${older.fullName.split(" ").slice(FAMILY_SURNAME_START).join(" ")}`;
    younger.email = `${emailSlug(younger.fullName)}@example.com`;
    younger.ageYears = older.ageYears! + 1;
  }
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
  const phone = `(82) 9${String(PHONE_PREFIX + index)}-${String(PHONE_SUFFIX + ((index * PHONE_STRIDE) % PHONE_SUFFIX_VARIATIONS)).padStart(PHONE_SUFFIX_LENGTH, "0")}`;
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
    enrollments: [studentEnrollment(classroom, input)],
    attendance: index % LOW_ATTENDANCE_CYCLE === 0 ? "low" : "good",
    financeProfile: FINANCE_PROFILES[index % FINANCE_PROFILE_CYCLE] ?? "punctual",
  };
}

function studentEnrollment(
  classroom: DevClassSeed,
  input: { position: number; index: number },
): DevEnrollmentSeed {
  const { position, index } = input;
  const entryOffsetDays = studentEntryOffsetDays(index);
  const enrollment: DevEnrollmentSeed = { classKey: classroom.key, entryOffsetDays };
  if (classroom.scheduleType !== "PERSONALIZED") return enrollment;
  const child = classroom.stageInternalCode.startsWith("C");
  const stages = child ? CHILD_PPT_STAGES : TEEN_PPT_STAGES;
  enrollment.stageInternalCode = stages[position % stages.length]!;
  if (position % PPT_STAGE_CYCLE === 1) enrollment.previousStageInternalCode = child ? "C1" : "E1";
  return enrollment;
}

function studentEntryOffsetDays(index: number): number {
  if (index % LATE_ENTRY_CYCLE === 0) return LATE_ENTRY_OFFSET_DAYS;
  return index % MID_ENTRY_CYCLE === 0 ? MID_ENTRY_OFFSET_DAYS : 0;
}

function emailSlug(name: string): string {
  return name
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/gu, "")
    .toLowerCase()
    .replaceAll(/\s+/gu, ".");
}
