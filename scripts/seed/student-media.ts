import { requiredRegistrationDocuments } from "../../packages/domain/src/registration-documents.js";
import { isMinorInSaoPaulo } from "../../packages/api/src/students/date-rules.js";
import { registrationPdf } from "./registration-pdf.js";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { DatabaseClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN } from "../../packages/db/src/seed-dev-data.js";
import { stableUuid } from "../../packages/db/src/seed-dev-support.js";
import {
  getStorage,
  type Storage,
  type StoredFileReference,
} from "../../packages/storage/src/index.js";

const guideName = "roteiro.pdf";

const PDF = "application/pdf";
const CHILD_MAX_AGE = 13;
const MISSING_DOCUMENT_INTERVAL = 19;
const GUIDE_INTERVAL = 25;

const titles = {
  student: "Identidade do aluno",
  guardian: "Identidade do responsável",
  residence: "Comprovante de residência",
  photo: "Foto do aluno",
};

type SeedFile = StoredFileReference & {
  kind: string;
  title: string;
  status: "READY";
  byteLength: number;
};
type GuideStorage = (key: string) => Promise<StoredFileReference & { byteLength: number }>;
type SeedStudent = {
  id: string;
  fullName: string;
  birthDate: Date | null;
  guardian: { fullName: string } | null;
};

/** Ship actual private files so opening a fixture exercises the normal authorized download. */
export async function seedSchoolFiles(database: DatabaseClient): Promise<void> {
  const storage = getStorage();
  const guide = await readFile(new URL(`media/${guideName}`, import.meta.url));
  const storeGuide: GuideStorage = async (key) => ({
    ...(await storage.put({ key, bytes: guide, contentType: PDF })),
    byteLength: guide.length,
  });
  await seedRegistrations(database, { storage, storeGuide });
  await seedAssessmentFiles(database, {
    storeGuide,
    checksum: createHash("sha256").update(guide).digest("hex"),
  });
}

function registrationStudents(database: DatabaseClient): Promise<SeedStudent[]> {
  return database.student.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    select: { id: true, fullName: true, birthDate: true, guardian: { select: { fullName: true } } },
  });
}

async function seedRegistrations(
  database: DatabaseClient,
  { storage, storeGuide }: { storage: Storage; storeGuide: GuideStorage },
): Promise<void> {
  const admin = await database.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } });
  const students = await registrationStudents(database);
  const counters = { child: 0, teen: 0, adult: 0 };
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - CHILD_MAX_AGE);
  for (const [index, student] of students.entries()) {
    const minor = isMinorInSaoPaulo({ birthDate: student.birthDate, now });
    const adultOrTeen = minor ? "teen" : "adult";
    const group = student.birthDate && student.birthDate > cutoff ? "child" : adultOrTeen;
    const portrait = `${group}-${counters[group]++}.jpg`;
    const files = await registrationFiles(student, { index, minor, portrait, storage, storeGuide });
    await database.studentDocumentSession.create({
      data: {
        studentId: student.id,
        createdById: admin.id,
        closedAt: now,
        tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
        files: { create: files },
      },
    });
  }
}

async function registrationFiles(
  student: SeedStudent,
  {
    index,
    minor,
    portrait,
    storage,
    storeGuide,
  }: {
    index: number;
    minor: boolean;
    portrait: string;
    storage: Storage;
    storeGuide: GuideStorage;
  },
): Promise<SeedFile[]> {
  const required = requiredRegistrationDocuments(minor);
  // Each incomplete registration lacks one specific item.
  const missing =
    index % MISSING_DOCUMENT_INTERVAL === MISSING_DOCUMENT_INTERVAL - 1
      ? required[Math.floor(index / MISSING_DOCUMENT_INTERVAL) % required.length]
      : null;
  const prefix = `student-documents/seed/${student.id}`;
  const files: SeedFile[] = [];
  for (const kind of required) {
    if (kind === missing) continue;
    files.push(await storeRegistrationFile(student, { kind, portrait, prefix, storage }));
  }
  if (index % GUIDE_INTERVAL === 0)
    files.push({
      ...(await storeGuide(`${prefix}/${guideName}`)),
      kind: `custom_${stableUuid(["guide", student.id])}`,
      title: "Roteiro de estudos",
      status: "READY",
    });
  return files;
}

async function storeRegistrationFile(
  student: SeedStudent,
  {
    kind,
    portrait,
    prefix,
    storage,
  }: { kind: keyof typeof titles; portrait: string; prefix: string; storage: Storage },
): Promise<SeedFile> {
  const isPhoto = kind === "photo";
  const title = titles[kind];
  const holder =
    kind === "guardian"
      ? (student.guardian?.fullName ?? "Responsável cadastral")
      : student.fullName;
  const bytes = isPhoto
    ? await readFile(new URL(`media/portraits/${portrait}`, import.meta.url))
    : registrationPdf({ title, student: student.fullName, holder });
  const reference = await storage.put({
    key: `${prefix}/${kind}.${isPhoto ? "jpg" : "pdf"}`,
    bytes,
    contentType: isPhoto ? "image/jpeg" : PDF,
  });
  return { ...reference, kind, title, status: "READY", byteLength: bytes.length };
}

async function seedAssessmentFiles(
  database: DatabaseClient,
  { storeGuide, checksum }: { storeGuide: GuideStorage; checksum: string },
): Promise<void> {
  const grades = await database.assessmentGrade.findMany({
    where: { phase: "BLOCK_ONE", competence: "WRITTEN", deletedAt: null },
    orderBy: [{ assessedOn: "desc" }, { assessmentId: "asc" }],
    take: 24,
  });
  for (const grade of grades) {
    const id = stableUuid(["assessment-file", grade.assessmentId, grade.phase]);
    await database.assessmentFile.create({
      data: {
        id,
        assessmentId: grade.assessmentId,
        phase: grade.phase,
        competence: grade.competence,
        fileName: "Roteiro de prática escrita.pdf",
        contentType: PDF,
        status: "READY",
        ...(await storeGuide(`assessment-files/seed/${id}.pdf`)),
        uploadedById: grade.recordedById,
        checksum,
        createdAt: grade.assessedOn,
        receivedAt: grade.assessedOn,
        processedAt: grade.assessedOn,
      },
    });
  }
}
