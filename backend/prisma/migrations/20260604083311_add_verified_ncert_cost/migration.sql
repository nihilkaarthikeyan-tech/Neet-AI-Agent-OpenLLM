-- AlterTable
ALTER TABLE "DoubtMessage" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedBy" TEXT;

-- AlterTable
ALTER TABLE "TestQuestion" ADD COLUMN     "ncertSource" TEXT,
ADD COLUMN     "wrongAnalysis" TEXT;
