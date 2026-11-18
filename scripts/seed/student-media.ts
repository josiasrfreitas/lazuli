import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { DatabaseClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN, DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";
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
  const enrolled = DEV_STUDENTS.filter((student) => student.enrollments.length);
  const cohorts = [
    enrolled.filter((student) => (student.ageYears ?? 0) < 13),
    enrolled.filter((student) => (student.ageYears ?? 0) >= 13 && (student.ageYears ?? 0) < 18),
    enrolled.filter((student) => (student.ageYears ?? 0) >= 18),
  ];
  for (const [ageGroup, cohort] of cohorts.entries()) {
    for (const [index, student] of cohort.slice(0, 3).entries()) {
      const studentId = stableUuid(["student", student.key]);
      const prefix = `student-documents/seed/${studentId}`;
      const bytes = await readFile(
        new URL(`./media/portrait-${1 + ageGroup * 3 + index}.jpg`, import.meta.url),
      );
      const photo = await storage.put({
        key: `${prefix}/photo.jpg`,
        bytes,
        contentType: "image/jpeg",
      });
      await database.studentDocumentSession.create({
        data: {
          studentId,
          createdById: admin.id,
          closedAt: new Date(),
          tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
          files: {
            create: [
              {
                ...photo,
                kind: "photo",
                title: "Foto do aluno",
                status: "READY",
                byteLength: bytes.length,
              },
              {
                ...(await storeGuide(`${prefix}/${guideName}`)),
                kind: `custom_${stableUuid(["guide", student.key])}`,
                title: "Roteiro de estudos",
                status: "READY",
              },
            ],
          },
        },
      });
    }
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
