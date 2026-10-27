CREATE TABLE "StudentDocumentSession" (
 "id" UUID NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdById" UUID NOT NULL, "tokenHash" TEXT NOT NULL, "studentId" UUID,
 "closedAt" TIMESTAMPTZ,
 CONSTRAINT "StudentDocumentSession_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "StudentDocumentSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentDocumentSession_tokenHash_key" ON "StudentDocumentSession"("tokenHash");
CREATE INDEX "StudentDocumentSession_studentId_idx" ON "StudentDocumentSession"("studentId");
CREATE INDEX "StudentDocumentSession_createdById_idx" ON "StudentDocumentSession"("createdById");
CREATE TABLE "StudentDocumentFile" (
 "id" UUID NOT NULL, "sessionId" UUID NOT NULL, "kind" TEXT NOT NULL,
 "bucket" TEXT NOT NULL, "key" TEXT NOT NULL, "byteLength" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RECEIVED', "extraction" JSONB,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL,
 CONSTRAINT "StudentDocumentFile_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "StudentDocumentFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudentDocumentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "StudentDocumentFile_kind_check" CHECK ("kind" IN ('student','guardian','residence','payment','photo')),
 CONSTRAINT "StudentDocumentFile_status_check" CHECK ("status" IN ('RECEIVED','PROCESSING','READY','FAILED'))
);
CREATE UNIQUE INDEX "StudentDocumentFile_sessionId_kind_key" ON "StudentDocumentFile"("sessionId","kind");
CREATE INDEX "StudentDocumentFile_status_updatedAt_idx" ON "StudentDocumentFile"("status","updatedAt");
