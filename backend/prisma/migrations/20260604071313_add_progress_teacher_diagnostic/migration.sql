-- AlterTable
ALTER TABLE "User" ADD COLUMN     "diagnosticCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "school" TEXT,
ADD COLUMN     "targetScore" INTEGER;

-- CreateTable
CREATE TABLE "MicroLesson" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MicroLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherStudent" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherStudent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MicroLesson_userId_idx" ON "MicroLesson"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MicroLesson_userId_date_key" ON "MicroLesson"("userId", "date");

-- CreateIndex
CREATE INDEX "TeacherStudent_teacherId_idx" ON "TeacherStudent"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherStudent_studentId_idx" ON "TeacherStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherStudent_teacherId_studentId_key" ON "TeacherStudent"("teacherId", "studentId");

-- AddForeignKey
ALTER TABLE "MicroLesson" ADD CONSTRAINT "MicroLesson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
