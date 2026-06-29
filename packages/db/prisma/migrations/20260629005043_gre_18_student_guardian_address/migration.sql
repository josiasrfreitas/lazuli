-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DROPPED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CPF', 'RG');

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "birth_date" DATE,
    "document_type" "DocumentType",
    "document_number" TEXT,
    "address_id" UUID,
    "guardian_id" UUID,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "full_name" TEXT NOT NULL,
    "relationship" TEXT,
    "document_type" "DocumentType",
    "document_number" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address_id" UUID,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Student_address_id_idx" ON "Student"("address_id");

-- CreateIndex
CREATE INDEX "Student_guardian_id_idx" ON "Student"("guardian_id");

-- CreateIndex
CREATE INDEX "Guardian_address_id_idx" ON "Guardian"("address_id");

-- AddCheckConstraint
ALTER TABLE "Student" ADD CONSTRAINT "Student_document_number_requires_type_check"
CHECK ("document_number" IS NULL OR "document_type" IS NOT NULL);

-- AddCheckConstraint
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_document_number_requires_type_check"
CHECK ("document_number" IS NULL OR "document_type" IS NOT NULL);

-- AddCheckConstraint
ALTER TABLE "Student" ADD CONSTRAINT "Student_minor_requires_guardian_check"
CHECK (
    "birth_date" IS NULL
    OR "birth_date" <= (((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '18 years')::date)
    OR "guardian_id" IS NOT NULL
);

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
