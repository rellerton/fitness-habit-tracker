-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "weight" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeightEntry_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WeightEntry_roundId_idx" ON "WeightEntry"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "WeightEntry_roundId_weekIndex_key" ON "WeightEntry"("roundId", "weekIndex");
