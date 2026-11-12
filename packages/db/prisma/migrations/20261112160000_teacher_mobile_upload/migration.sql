CREATE TABLE "TeacherUploadSession" (
 "id" UUID NOT NULL PRIMARY KEY,
 "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ NOT NULL,
 "deleted_at" TIMESTAMPTZ,
 "token_hash" TEXT NOT NULL,
 "created_by_id" UUID NOT NULL,
 "teacher_id" UUID,
 "expires_at" TIMESTAMPTZ NOT NULL,
 "closed_at" TIMESTAMPTZ,
 CONSTRAINT "TeacherUploadSession_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "TeacherProfile"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeacherUploadSession_token_hash_key" ON "TeacherUploadSession"("token_hash");
CREATE INDEX "TeacherUploadSession_teacher_id_idx" ON "TeacherUploadSession"("teacher_id");
ALTER TABLE "TeacherFile" ALTER COLUMN "teacher_id" DROP NOT NULL, ADD COLUMN "upload_session_id" UUID;
ALTER TABLE "TeacherFile" ADD CONSTRAINT "TeacherFile_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "TeacherUploadSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "teacher_draft_photo" ON "TeacherFile"("upload_session_id") WHERE "kind" = 'PHOTO' AND "deleted_at" IS NULL AND "teacher_id" IS NULL;
