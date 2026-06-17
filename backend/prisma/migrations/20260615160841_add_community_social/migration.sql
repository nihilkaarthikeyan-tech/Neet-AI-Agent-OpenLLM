-- CreateTable
CREATE TABLE "PeerDoubt" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "askCount" INTEGER NOT NULL DEFAULT 1,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "aiAnswer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeerDoubt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerDoubtAsker" (
    "id" TEXT NOT NULL,
    "peerDoubtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerDoubtAsker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPodMember" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPodMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodFlashcard" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodFlashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTest" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "totalQ" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTestAssignment" (
    "id" TEXT NOT NULL,
    "classTestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTestAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeerDoubt_subject_idx" ON "PeerDoubt"("subject");

-- CreateIndex
CREATE INDEX "PeerDoubt_answered_idx" ON "PeerDoubt"("answered");

-- CreateIndex
CREATE INDEX "PeerDoubt_normalized_idx" ON "PeerDoubt"("normalized");

-- CreateIndex
CREATE INDEX "PeerDoubtAsker_userId_idx" ON "PeerDoubtAsker"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PeerDoubtAsker_peerDoubtId_userId_key" ON "PeerDoubtAsker"("peerDoubtId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPod_code_key" ON "StudyPod"("code");

-- CreateIndex
CREATE INDEX "StudyPodMember_userId_idx" ON "StudyPodMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPodMember_podId_userId_key" ON "StudyPodMember"("podId", "userId");

-- CreateIndex
CREATE INDEX "PodFlashcard_podId_idx" ON "PodFlashcard"("podId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentLink_studentId_key" ON "ParentLink"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentLink_code_key" ON "ParentLink"("code");

-- CreateIndex
CREATE INDEX "ClassTest_teacherId_idx" ON "ClassTest"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTestAssignment_attemptId_key" ON "ClassTestAssignment"("attemptId");

-- CreateIndex
CREATE INDEX "ClassTestAssignment_studentId_idx" ON "ClassTestAssignment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTestAssignment_classTestId_studentId_key" ON "ClassTestAssignment"("classTestId", "studentId");

-- AddForeignKey
ALTER TABLE "PeerDoubtAsker" ADD CONSTRAINT "PeerDoubtAsker_peerDoubtId_fkey" FOREIGN KEY ("peerDoubtId") REFERENCES "PeerDoubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPodMember" ADD CONSTRAINT "StudyPodMember_podId_fkey" FOREIGN KEY ("podId") REFERENCES "StudyPod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodFlashcard" ADD CONSTRAINT "PodFlashcard_podId_fkey" FOREIGN KEY ("podId") REFERENCES "StudyPod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTestAssignment" ADD CONSTRAINT "ClassTestAssignment_classTestId_fkey" FOREIGN KEY ("classTestId") REFERENCES "ClassTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
