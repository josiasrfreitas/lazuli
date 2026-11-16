ALTER TABLE "PedagogicalOccurrence" ALTER COLUMN "class_session_id" DROP NOT NULL;
ALTER TABLE "PedagogicalOccurrence" ADD COLUMN "occurred_on" DATE, ADD COLUMN "occurred_time" VARCHAR(5);
ALTER TABLE "PedagogicalOccurrence" ADD CONSTRAINT "occurrence_context_check" CHECK (
  ("class_session_id" IS NOT NULL AND "occurred_on" IS NULL AND "occurred_time" IS NULL)
  OR ("class_session_id" IS NULL AND "occurred_on" IS NOT NULL AND "occurred_time" IS NOT NULL
      AND "occurred_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
