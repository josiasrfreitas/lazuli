ALTER TABLE "SemesterClassPlan" ADD COLUMN "source_class_id" uuid REFERENCES "Class"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "SemesterClassPlan_semester_source_active" ON "SemesterClassPlan" ("semester_id", "source_class_id") WHERE "deleted_at" IS NULL AND "source_class_id" IS NOT NULL;
ALTER TABLE "SemesterPlacement" ADD COLUMN "effective_date" date, ADD COLUMN "declined_at" timestamptz, ADD COLUMN "declined_reason" text;
