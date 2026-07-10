import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ArtifactStorage } from "@lazuli/integrations";

import type { ReportGenerateDatabase } from "../src/reports/process-report-generate.js";
import { processReportGenerate } from "../src/reports/process-report-generate.js";
import { ReportGenerationError } from "../src/reports/report-error.js";

const ARTIFACT_ID = "00000000-0000-0000-0000-000000005320";
const NOW = new Date("2026-07-09T15:00:00.000Z");
const BUCKET = "lazuli-test";

type ArtifactState = {
  id: string;
  kind: string;
  studentId: string | null;
  classId: string | null;
  orderId: string | null;
  deletedAt: null;
};

type UpdateCall = { where: { id: string }; data: Record<string, unknown> };

function buildFakes(artifact: ArtifactState | null): {
  database: ReportGenerateDatabase;
  storage: ArtifactStorage;
  updates: UpdateCall[];
  puts: { key: string; contentType: string }[];
} {
  const updates: UpdateCall[] = [];
  const puts: { key: string; contentType: string }[] = [];
  const database = {
    generatedArtifact: {
      findFirst: () => Promise.resolve(artifact),
      update: (call: UpdateCall) => {
        updates.push(call);
        return Promise.resolve(artifact);
      },
    },
    financeSettings: {
      findUnique: () => Promise.resolve({ interestRatePctMonthly: 1 }),
    },
    installment: {
      findMany: () => Promise.resolve([]),
    },
  } as unknown as ReportGenerateDatabase;
  const storage: ArtifactStorage = {
    put: (input) => {
      puts.push({ key: input.key, contentType: input.contentType });
      return Promise.resolve({ bucket: BUCKET, key: input.key });
    },
    getSignedUrl: () => Promise.reject(new Error("unused")),
  };

  return { database, storage, updates, puts };
}

function overdueCsvArtifact(): ArtifactState {
  return {
    id: ARTIFACT_ID,
    kind: "OVERDUE_RECEIVABLES_CSV",
    studentId: null,
    classId: null,
    orderId: null,
    deletedAt: null,
  };
}

void describe("processReportGenerate", () => {
  void it("stamps startedAt, uploads, and stamps completion facts", async () => {
    const fakes = buildFakes(overdueCsvArtifact());

    const result = await processReportGenerate({
      payload: { artifactId: ARTIFACT_ID },
      database: fakes.database,
      storage: fakes.storage,
      now: NOW,
    });

    assert.deepEqual(result, { artifactId: ARTIFACT_ID });
    assert.equal(fakes.updates.length, 2);
    assert.equal(fakes.updates[0]?.data.startedAt, NOW);
    assert.equal(fakes.updates[0]?.data.failedAt, null);
    assert.deepEqual(fakes.puts, [
      {
        key: `reports/${ARTIFACT_ID}/inadimplencia.csv`,
        contentType: "text/csv; charset=utf-8",
      },
    ]);
    const completed = fakes.updates[1]?.data;
    assert.equal(completed?.storageBucket, BUCKET);
    assert.equal(completed?.storageObject, `reports/${ARTIFACT_ID}/inadimplencia.csv`);
    assert.equal(completed?.fileName, "inadimplencia.csv");
    assert.equal(completed?.completedAt, NOW);
  });
});

void describe("processReportGenerate failure stamping", () => {
  void it("stamps failedAt and errorCode for the unsupported SIGNED_ORDER_PDF kind", async () => {
    const fakes = buildFakes({ ...overdueCsvArtifact(), kind: "SIGNED_ORDER_PDF" });

    await assert.rejects(
      processReportGenerate({
        payload: { artifactId: ARTIFACT_ID },
        database: fakes.database,
        storage: fakes.storage,
        now: NOW,
      }),
      (error: unknown) =>
        error instanceof ReportGenerationError && error.code === "SETUP_ERROR_UNSUPPORTED_KIND",
    );

    assert.equal(fakes.puts.length, 0);
    const failed = fakes.updates.at(-1)?.data;
    assert.equal(failed?.failedAt, NOW);
    assert.equal(failed?.errorCode, "SETUP_ERROR_UNSUPPORTED_KIND");
    assert.match(String(failed?.errorMessage), new RegExp(ARTIFACT_ID));
  });

  void it("stamps failedAt when the storage upload fails, without leaking PII", async () => {
    const fakes = buildFakes(overdueCsvArtifact());
    const storage: ArtifactStorage = {
      put: () => Promise.reject(new Error("bucket exploded with student Ana Souza")),
      getSignedUrl: () => Promise.reject(new Error("unused")),
    };

    await assert.rejects(
      processReportGenerate({
        payload: { artifactId: ARTIFACT_ID },
        database: fakes.database,
        storage,
        now: NOW,
      }),
    );

    const failed = fakes.updates.at(-1)?.data;
    assert.equal(failed?.errorCode, "UNKNOWN");
    assert.doesNotMatch(String(failed?.errorMessage), /Ana Souza/);
  });
});

void describe("processReportGenerate missing artifact", () => {
  void it("fails loudly when the artifact row does not exist", async () => {
    const fakes = buildFakes(null);

    await assert.rejects(
      processReportGenerate({
        payload: { artifactId: ARTIFACT_ID },
        database: fakes.database,
        storage: fakes.storage,
        now: NOW,
      }),
      (error: unknown) =>
        error instanceof ReportGenerationError && error.code === "SETUP_ERROR_ARTIFACT_NOT_FOUND",
    );

    assert.equal(fakes.updates.length, 0);
  });
});
