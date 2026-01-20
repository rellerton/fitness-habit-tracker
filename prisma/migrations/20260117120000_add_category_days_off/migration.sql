-- Add allowDaysOffPerWeek to Category with default 0
ALTER TABLE "Category" ADD COLUMN "allowDaysOffPerWeek" INTEGER NOT NULL DEFAULT 0;
