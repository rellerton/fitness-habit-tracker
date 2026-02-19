PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "TrackerType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Tracker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "trackerTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tracker_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Tracker_trackerTypeId_fkey" FOREIGN KEY ("trackerTypeId") REFERENCES "TrackerType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Seed the legacy global category set into a default tracker type
INSERT INTO "TrackerType" ("id", "name", "active", "createdAt", "updatedAt")
VALUES ('default_tracker_type', 'Default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Redefine Category to scope category names/sort by tracker type
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "allowDaysOffPerWeek" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_trackerTypeId_fkey" FOREIGN KEY ("trackerTypeId") REFERENCES "TrackerType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("id", "trackerTypeId", "name", "sortOrder", "allowDaysOffPerWeek", "active", "createdAt", "updatedAt")
SELECT "id", 'default_tracker_type', "name", "sortOrder", "allowDaysOffPerWeek", "active", "createdAt", "updatedAt"
FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_trackerTypeId_name_key" ON "Category"("trackerTypeId", "name");
CREATE INDEX "Category_trackerTypeId_active_sortOrder_idx" ON "Category"("trackerTypeId", "active", "sortOrder");

-- Create one default tracker per person so existing rounds can be attached
INSERT INTO "Tracker" ("id", "personId", "trackerTypeId", "name", "active", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'default_tracker_type', 'Default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Person";

-- Redefine Round to attach each round to its tracker
CREATE TABLE "new_Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "lengthWeeks" INTEGER NOT NULL,
    "goalWeight" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Round_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("id", "personId", "trackerId", "startDate", "lengthWeeks", "goalWeight", "createdAt")
SELECT
  r."id",
  r."personId",
  t."id",
  r."startDate",
  r."lengthWeeks",
  r."goalWeight",
  r."createdAt"
FROM "Round" r
JOIN "Tracker" t
  ON t."personId" = r."personId"
 AND t."trackerTypeId" = 'default_tracker_type';
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
CREATE INDEX "Round_personId_idx" ON "Round"("personId");
CREATE INDEX "Round_trackerId_idx" ON "Round"("trackerId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerType_name_key" ON "TrackerType"("name");

-- CreateIndex
CREATE INDEX "Tracker_personId_active_idx" ON "Tracker"("personId", "active");

-- CreateIndex
CREATE INDEX "Tracker_trackerTypeId_active_idx" ON "Tracker"("trackerTypeId", "active");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
