BEGIN;
CREATE TYPE "EmployeeArea" AS ENUM ('SECRETARIAT','MANAGEMENT','PEDAGOGY','COMMERCIAL');
CREATE TABLE "EmployeeProfile" (
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  "user_id" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  cpf VARCHAR(11) UNIQUE CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  phone TEXT,
  employment_type VARCHAR(20) CHECK (employment_type IN ('CLT','PJ','AUTONOMOUS','OTHER')),
  area "EmployeeArea",
  job_title VARCHAR(120)
);
INSERT INTO "TeacherProfile" (user_id, updated_at)
SELECT id, CURRENT_TIMESTAMP FROM "User" WHERE role = 'TEACHER'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO "EmployeeProfile" (user_id, cpf, phone, employment_type, created_at, updated_at, deleted_at)
SELECT user_id, cpf, phone, employment_type, created_at, updated_at, deleted_at FROM "TeacherProfile";
ALTER TABLE "TeacherFile" DROP CONSTRAINT "TeacherFile_teacher_id_fkey",
  ADD FOREIGN KEY (teacher_id) REFERENCES "EmployeeProfile"(user_id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherUploadSession" DROP CONSTRAINT "TeacherUploadSession_teacher_id_fkey",
  ADD FOREIGN KEY (teacher_id) REFERENCES "EmployeeProfile"(user_id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherProfile" DROP CONSTRAINT teacher_vacation_check,
  DROP COLUMN cpf, DROP COLUMN phone, DROP COLUMN employment_type,
  ADD CHECK ((vacation_start IS NULL AND vacation_end IS NULL) OR
    (vacation_start IS NOT NULL AND vacation_end IS NOT NULL AND vacation_end >= vacation_start));
COMMIT;
