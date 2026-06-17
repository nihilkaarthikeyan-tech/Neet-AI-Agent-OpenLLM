-- CreateTable
CREATE TABLE "LearningToolSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningToolSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningToolSave_userId_toolType_idx" ON "LearningToolSave"("userId", "toolType");

-- AddForeignKey
ALTER TABLE "LearningToolSave" ADD CONSTRAINT "LearningToolSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
