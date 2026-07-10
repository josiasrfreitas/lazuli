import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ArtifactStorageNotConfiguredError,
  createArtifactStorageFromEnv,
  parseStorageEnvironment,
  selectArtifactStorage,
} from "../src/index.js";

const PROJECT_ID = "lazuli-local";
const BUCKET = "lazuli-test-bucket";
const EMULATOR_HOST = "http://localhost:4443";

void describe("parseStorageEnvironment", () => {
  void it("treats empty-string env vars as absent", () => {
    const environment = parseStorageEnvironment({
      GCS_PROJECT_ID: "",
      GCS_ARTIFACTS_BUCKET: "   ",
      STORAGE_EMULATOR_HOST: "",
    });

    assert.equal(environment.gcsProjectId, undefined);
    assert.equal(environment.gcsArtifactsBucket, undefined);
    assert.equal(environment.storageEmulatorHost, undefined);
  });

  void it("trims configured values", () => {
    const environment = parseStorageEnvironment({
      GCS_PROJECT_ID: ` ${PROJECT_ID} `,
      GCS_ARTIFACTS_BUCKET: BUCKET,
      STORAGE_EMULATOR_HOST: EMULATOR_HOST,
    });

    assert.equal(environment.gcsProjectId, PROJECT_ID);
    assert.equal(environment.gcsArtifactsBucket, BUCKET);
    assert.equal(environment.storageEmulatorHost, EMULATOR_HOST);
  });
});

void describe("selectArtifactStorage", () => {
  void it("selects none when the bucket is not configured", () => {
    const selection = selectArtifactStorage(
      parseStorageEnvironment({ GCS_PROJECT_ID: PROJECT_ID, GCS_ARTIFACTS_BUCKET: "" }),
    );

    assert.deepEqual(selection, { kind: "none" });
  });

  void it("selects none when the project is not configured", () => {
    const selection = selectArtifactStorage(
      parseStorageEnvironment({ GCS_PROJECT_ID: undefined, GCS_ARTIFACTS_BUCKET: BUCKET }),
    );

    assert.deepEqual(selection, { kind: "none" });
  });

  void it("selects GCS with emulator host when fully configured", () => {
    const selection = selectArtifactStorage(
      parseStorageEnvironment({
        GCS_PROJECT_ID: PROJECT_ID,
        GCS_ARTIFACTS_BUCKET: BUCKET,
        STORAGE_EMULATOR_HOST: EMULATOR_HOST,
      }),
    );

    assert.deepEqual(selection, {
      kind: "gcs",
      projectId: PROJECT_ID,
      bucket: BUCKET,
      emulatorHost: EMULATOR_HOST,
    });
  });

  void it("selects real GCS auth path when the emulator host is unset", () => {
    const selection = selectArtifactStorage(
      parseStorageEnvironment({ GCS_PROJECT_ID: PROJECT_ID, GCS_ARTIFACTS_BUCKET: BUCKET }),
    );

    assert.equal(selection.kind, "gcs");
    assert.equal(selection.kind === "gcs" ? selection.emulatorHost : "set", undefined);
  });
});

void describe("createArtifactStorageFromEnv", () => {
  void it("falls back to the no-op storage when unconfigured", async () => {
    const storage = createArtifactStorageFromEnv({});

    const putResult = await storage.put({
      key: "reports/probe.csv",
      contentType: "text/csv",
      body: new TextEncoder().encode("probe"),
    });

    assert.equal(putResult.bucket, "local-stub");
    await assert.rejects(
      storage.getSignedUrl("reports/probe.csv"),
      (error: unknown) => error instanceof ArtifactStorageNotConfiguredError,
    );
  });

  void it("builds emulator media URLs as signed URLs in emulator mode", async () => {
    const storage = createArtifactStorageFromEnv({
      GCS_PROJECT_ID: PROJECT_ID,
      GCS_ARTIFACTS_BUCKET: BUCKET,
      STORAGE_EMULATOR_HOST: EMULATOR_HOST,
    });

    const url = await storage.getSignedUrl("reports/sub dir/probe.pdf");

    assert.equal(
      url,
      `${EMULATOR_HOST}/storage/v1/b/${BUCKET}/o/reports%2Fsub%20dir%2Fprobe.pdf?alt=media`,
    );
  });
});
