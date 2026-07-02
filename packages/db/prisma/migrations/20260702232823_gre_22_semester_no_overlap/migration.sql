-- CreateTable
CREATE TABLE "Semester" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Semester_name_key" ON "Semester"("name");

-- AddCheckConstraint (TECHNICAL_SPEC §4.4): a semester window must not be inverted.
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_start_not_after_end_check"
CHECK ("start_date" <= "end_date");

-- AddExclusionConstraint (TECHNICAL_SPEC §4.4, §3.3, S-CAL-4): semester windows must
-- not overlap, so every session date buckets into at most one semester. Inclusive
-- bounds ('[]') match the domain resolver; range && has built-in GiST support (no
-- btree_gist needed). Partial on live rows so a soft-deleted semester never blocks a
-- replacement, mirroring the active-record read filter.
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_no_overlap_excl"
EXCLUDE USING gist (daterange("start_date", "end_date", '[]') WITH &&)
WHERE ("deleted_at" IS NULL);
