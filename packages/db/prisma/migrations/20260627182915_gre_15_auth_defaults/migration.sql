-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Verification" ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
