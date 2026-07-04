-- Prisma can represent the slot relation as the composite FK below. Keeping the
-- separate nullable schedule_slot_id FK makes `prisma migrate diff` report drift
-- because it is redundant with the composite relationship used by the schema.
ALTER TABLE "ClassSession"
DROP CONSTRAINT "ClassSession_schedule_slot_id_fkey";
