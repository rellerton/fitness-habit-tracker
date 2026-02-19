-- Enforce Round.personId and Round.trackerId consistency at the database layer.
-- A round must belong to the same person as its tracker.

DROP TRIGGER IF EXISTS "round_person_tracker_consistency_insert";
CREATE TRIGGER "round_person_tracker_consistency_insert"
BEFORE INSERT ON "Round"
FOR EACH ROW
WHEN (
  SELECT "personId"
  FROM "Tracker"
  WHERE "id" = NEW."trackerId"
) IS NOT NEW."personId"
BEGIN
  SELECT RAISE(ABORT, 'Round.personId must match Tracker.personId');
END;

DROP TRIGGER IF EXISTS "round_person_tracker_consistency_update";
CREATE TRIGGER "round_person_tracker_consistency_update"
BEFORE UPDATE OF "personId", "trackerId" ON "Round"
FOR EACH ROW
WHEN (
  SELECT "personId"
  FROM "Tracker"
  WHERE "id" = NEW."trackerId"
) IS NOT NEW."personId"
BEGIN
  SELECT RAISE(ABORT, 'Round.personId must match Tracker.personId');
END;
