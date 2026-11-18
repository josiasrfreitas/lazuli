import { readFile } from "node:fs/promises";
import { createDbClient } from "../packages/db/src/client.js";
import { saoPauloTodayIso, utcDate } from "../packages/db/src/seed-dev-support.js";
import { listContracts } from "../packages/api/src/finance/internal/contracts.js";
import { getStorage } from "../packages/storage/src/index.js";

const database = createDbClient();
try {
  const today = saoPauloTodayIso();
  const date = utcDate(today);
  const now = new Date();
  const workspace = JSON.parse(
    await readFile(new URL("../.lazuli/workspace.json", import.meta.url), "utf8"),
  );
  const current = await database.period.findFirstOrThrow({
    where: { deletedAt: null, startDate: { lte: date }, endDate: { gte: date } },
  });
  const groups = { semesterId: current.id, deletedAt: null };
  const [
    students,
    teachers,
    classes,
    future,
    entries,
    records,
    attendance,
    grades,
    overdue,
    contracts,
    photos,
    assessmentFiles,
    documents,
  ] = await Promise.all([
    database.student.count({ where: { deletedAt: null } }),
    database.user.count({ where: { role: "TEACHER", deletedAt: null } }),
    database.class.count({ where: groups }),
    database.classSession.count({
      where: { class: groups, date: { gt: date }, status: "SCHEDULED", deletedAt: null },
    }),
    database.enrollment.count({ where: { class: groups, deletedAt: null } }),
    database.classSessionRecord.count({
      where: { classSession: { class: groups, date: { lt: date } }, deletedAt: null },
    }),
    database.attendance.groupBy({
      by: ["status"],
      where: { deletedAt: null, classSession: { class: groups } },
      _count: true,
    }),
    database.assessmentGrade.aggregate({
      where: { deletedAt: null },
      _count: true,
      _avg: { score: true },
      _min: { score: true },
      _max: { score: true },
    }),
    listContracts(database, { page: 1, status: "INADIMPLENTE", now }),
    database.contract.count({ where: { deletedAt: null } }),
    database.studentDocumentFile.findMany({
      where: { kind: "photo", status: "READY", deletedAt: null },
      include: { session: { include: { student: true } } },
    }),
    database.assessmentFile.findMany({ where: { status: "READY", deletedAt: null } }),
    database.studentDocumentFile.findMany({
      where: { kind: { not: "photo" }, status: "READY", deletedAt: null },
    }),
  ]);
  console.log(`Escola em ${today} · ${current.name} · ${workspace.urls.web}`);
  console.log(
    `${students} alunos · ${teachers} professores · ${classes} turmas · ${entries} matrículas · ${records} registros de aula · ${future} aulas futuras`,
  );
  console.log(
    `Contratos inadimplentes: ${overdue.total}/${contracts}. Notas: ${grades._count}, média ${grades._avg.score?.toFixed(1)}, de ${grades._min.score} a ${grades._max.score}.`,
  );
  console.log("Frequência:", attendance.map((row) => `${row.status}: ${row._count}`).join(" · "));
  for (const file of [...photos, ...documents, ...assessmentFiles]) {
    if (!file.bucket || !file.key) throw new Error(`Arquivo sem referência: ${file.id}`);
    const result = await getStorage().read({ bucket: file.bucket, key: file.key });
    if (!result.bytes.length || result.bytes.length !== file.byteLength)
      throw new Error(`Arquivo incompleto: ${file.id}`);
  }
  console.log(
    `Arquivos conferidos: ${photos.length} fotos, ${documents.length} documentos e ${assessmentFiles.length} anexos de avaliações.`,
  );
  for (const item of photos.slice(0, 3))
    console.log(
      `${item.session.student?.fullName}: ${workspace.urls.web}/alunos/${item.session.studentId}`,
    );
} finally {
  await database.$disconnect();
}
