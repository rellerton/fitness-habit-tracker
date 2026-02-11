-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "roundLengthWeeks" INTEGER NOT NULL DEFAULT 8,
    "weekStartsOn" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "weightUnit" TEXT NOT NULL DEFAULT 'LBS',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSettings" ("id", "roundLengthWeeks", "timezone", "updatedAt", "weekStartsOn") SELECT "id", "roundLengthWeeks", "timezone", "updatedAt", "weekStartsOn" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
