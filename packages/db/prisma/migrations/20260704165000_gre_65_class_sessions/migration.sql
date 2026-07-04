-- CreateEnum
CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "class_id" UUID NOT NULL,
    "schedule_slot_id" UUID,
    "date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "status" "ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancel_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ,
    "cancelled_by_id" UUID,
    "attendance_confirmed_at" TIMESTAMPTZ,
    "attendance_confirmed_by_id" UUID,
    "attendance_last_committed_at" TIMESTAMPTZ,
    "portal_submitted_at" TIMESTAMPTZ,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassSession_class_id_idx" ON "ClassSession"("class_id");

-- CreateIndex
CREATE INDEX "ClassSession_schedule_slot_id_idx" ON "ClassSession"("schedule_slot_id");

-- CreateIndex
CREATE INDEX "ClassSession_cancelled_by_id_idx" ON "ClassSession"("cancelled_by_id");

-- CreateIndex
CREATE INDEX "ClassSession_attendance_confirmed_by_id_idx" ON "ClassSession"("attendance_confirmed_by_id");

-- Partial unique index (TECHNICAL_SPEC §4.4): generated slot sessions are idempotent.
CREATE UNIQUE INDEX "ClassSession_slot_generation_key"
ON "ClassSession"("class_id", "schedule_slot_id", "date")
WHERE ("schedule_slot_id" IS NOT NULL AND "deleted_at" IS NULL);

-- Partial unique index (TECHNICAL_SPEC §4.4): ad-hoc/manual sessions are idempotent.
CREATE UNIQUE INDEX "ClassSession_ad_hoc_generation_key"
ON "ClassSession"("class_id", "date", "start_time", "end_time")
WHERE ("schedule_slot_id" IS NULL AND "deleted_at" IS NULL);

-- AddForeignKey
ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_class_id_fkey"
FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_schedule_slot_id_fkey"
FOREIGN KEY ("schedule_slot_id") REFERENCES "ClassScheduleSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Composite FK (TECHNICAL_SPEC §4.4): a session slot must belong to the same class.
ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_class_id_schedule_slot_id_fkey"
FOREIGN KEY ("class_id", "schedule_slot_id")
REFERENCES "ClassScheduleSlot"("class_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_cancelled_by_id_fkey"
FOREIGN KEY ("cancelled_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_attendance_confirmed_by_id_fkey"
FOREIGN KEY ("attendance_confirmed_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint (TECHNICAL_SPEC §4.4): sessions must have start before end.
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_start_before_end_check"
CHECK ("start_time" < "end_time");

-- AddCheckConstraint (TECHNICAL_SPEC §4.4): cancellation facts are explicit.
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_cancel_facts_check"
CHECK (
  (
    "status" = 'CANCELLED'
    AND "cancel_reason" IS NOT NULL
    AND "cancelled_at" IS NOT NULL
    AND "attendance_confirmed_at" IS NULL
    AND "portal_submitted_at" IS NULL
  )
  OR (
    "status" = 'SCHEDULED'
    AND "cancelled_at" IS NULL
  )
);

-- Slot-backed sessions must mirror the slot weekday and clock interval.
CREATE FUNCTION check_class_session_slot_match()
RETURNS trigger AS $$
DECLARE
  slot_row "ClassScheduleSlot"%ROWTYPE;
  session_weekday "Weekday";
BEGIN
  IF NEW."schedule_slot_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO slot_row
  FROM "ClassScheduleSlot"
  WHERE "id" = NEW."schedule_slot_id"
    AND "class_id" = NEW."class_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ClassSession schedule slot must belong to the same class'
      USING CONSTRAINT = 'ClassSession_slot_match_check';
  END IF;

  session_weekday := CASE EXTRACT(ISODOW FROM NEW."date")::integer
    WHEN 1 THEN 'MONDAY'::"Weekday"
    WHEN 2 THEN 'TUESDAY'::"Weekday"
    WHEN 3 THEN 'WEDNESDAY'::"Weekday"
    WHEN 4 THEN 'THURSDAY'::"Weekday"
    WHEN 5 THEN 'FRIDAY'::"Weekday"
    WHEN 6 THEN 'SATURDAY'::"Weekday"
    ELSE 'SUNDAY'::"Weekday"
  END;

  IF slot_row."weekday" <> session_weekday
    OR slot_row."start_time" <> NEW."start_time"
    OR slot_row."end_time" <> NEW."end_time" THEN
    RAISE EXCEPTION 'ClassSession date/time must match its schedule slot'
      USING CONSTRAINT = 'ClassSession_slot_match_check';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClassSession_slot_match_trigger"
BEFORE INSERT OR UPDATE OF "class_id", "schedule_slot_id", "date", "start_time", "end_time"
ON "ClassSession"
FOR EACH ROW
EXECUTE FUNCTION check_class_session_slot_match();
