-- CreateTable
CREATE TABLE "LearnSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "prompt" TEXT NOT NULL,
    "title" TEXT,
    "thumbnail" TEXT,
    "duration" INTEGER,
    "localPath" TEXT,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "addedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "techniques" TEXT NOT NULL,
    "howTo" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "style" TEXT,
    "mood" TEXT,
    "difficulty" TEXT,
    "insights" TEXT NOT NULL,
    "promptAlignment" INTEGER,
    "rawGemini" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoAnalysis_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LearnSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "analysisId" TEXT NOT NULL,
    "sentToDirector" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeNode_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "VideoAnalysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriberPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriberPrompt_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LearnSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LearnSource_externalId_key" ON "LearnSource"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoAnalysis_sourceId_key" ON "VideoAnalysis"("sourceId");

-- CreateIndex
CREATE INDEX "SubscriberPrompt_userId_idx" ON "SubscriberPrompt"("userId");
