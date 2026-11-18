import { requiredRegistrationDocuments } from "../../packages/domain/src/registration-documents.js";
import { isMinorInSaoPaulo } from "../../packages/api/src/students/date-rules.js";
import { registrationPdf } from "./registration-pdf.js";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { DatabaseClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN } from "../../packages/db/src/seed-dev-data.js";
import { stableUuid } from "../../packages/db/src/seed-dev-support.js";
import { getStorage } from "../../packages/storage/src/index.js";

const guideName = "roteiro.pdf";

/** Ship actual private files so opening a fixture exercises the normal authorized download. */
export async function seedSchoolFiles(database: DatabaseClient): Promise<void> {
  const storage = getStorage();
  const guide = await readFile(new URL(`./media/${guideName}`, import.meta.url));
  async function storeGuide(key: string) {
    return {
      ...(await storage.put({ key, bytes: guide, contentType: "application/pdf" })),
      byteLength: guide.length,
    };
  }
  const admin = await database.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } });
  const students = await database.student.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    select: { id: true, fullName: true, birthDate: true, guardian: { select: { fullName: true } } },
  });
  const titles = {
    student: "Identidade do aluno",
    guardian: "Identidade do responsável",
    residence: "Comprovante de residência",
    photo: "Foto do aluno",
  };
  const counters = { child: 0, teen: 0, adult: 0 };
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 13);
  for (const [index, student] of students.entries()) {
    const minor = isMinorInSaoPaulo({ birthDate: student.birthDate, now });
    const group =
      student.birthDate && student.birthDate > cutoff ? "child" : minor ? "teen" : "adult";
    const portrait = counters[group]++;
    const required = requiredRegistrationDocuments(minor);
    // Keep a small, distributed queue; each incomplete registration lacks one specific item.
    const missing = index % 19 === 18 ? required[Math.floor(index / 19) % required.length] : null;
    const files = [];
    const prefix = `student-documents/seed/${student.id}`;
    for (const kind of required) {
      if (kind === missing) continue;
      const isPhoto = kind === "photo";
      const bytes = isPhoto
        ? await readFile(new URL(`./media/portraits/${group}-${portrait}.jpg`, import.meta.url))
        : registrationPdf(
            titles[kind],
            student.fullName,
            kind === "guardian"
              ? (student.guardian?.fullName ?? "Responsável cadastral")
              : student.fullName,
          );
      const reference = await storage.put({
        key: `${prefix}/${kind}.${isPhoto ? "jpg" : "pdf"}`,
        bytes,
        contentType: isPhoto ? "image/jpeg" : "application/pdf",
      });
      files.push({
        ...reference,
        kind,
        title: titles[kind],
        status: "READY",
        byteLength: bytes.length,
      });
    }
    if (index % 25 === 0)
      files.push({
        ...(await storeGuide(`${prefix}/${guideName}`)),
        kind: `custom_${stableUuid(["guide", student.id])}`,
        title: "Roteiro de estudos",
        status: "READY",
      });
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
        contentType: "application/pdf",
        status: "READY",
        ...(await storeGuide(`assessment-files/seed/${id}.pdf`)),
        uploadedById: grade.recordedById,
        checksum: createHash("sha256").update(guide).digest("hex"),
        createdAt: grade.assessedOn,
        receivedAt: grade.assessedOn,
        processedAt: grade.assessedOn,
      },
    });
  }
}
