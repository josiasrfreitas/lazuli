BEGIN;
ALTER TABLE "BookLessonPage" ADD COLUMN lesson_id UUID;
UPDATE "BookLessonPage" p SET lesson_id=b.lesson_id FROM "BookLessonPart" b WHERE b.id=p.part_id;
ALTER TABLE "BookLessonPage" ALTER COLUMN lesson_id SET NOT NULL, ALTER COLUMN part_id DROP NOT NULL,
  ADD FOREIGN KEY (lesson_id) REFERENCES "BookLesson"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD UNIQUE (lesson_id,id);
CREATE UNIQUE INDEX "BookLessonPage_direct_number_key" ON "BookLessonPage"(lesson_id,number) WHERE deleted_at IS NULL AND part_id IS NULL;
ALTER TABLE "ProgramActivityLesson" DROP CONSTRAINT "ProgramActivityLesson_part_id_page_id_fkey",
  DROP CONSTRAINT "ProgramActivityLesson_check",
  ADD FOREIGN KEY (lesson_id,page_id) REFERENCES "BookLessonPage"(lesson_id,id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CHECK ((part_id IS NULL OR part='') AND (page_activity_id IS NULL OR page_id IS NOT NULL));
COMMIT;
