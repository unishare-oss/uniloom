-- Tickets assigned to someone who is no longer a member of the project become unassigned
-- (from now on, leaving or being removed does this in the API).
UPDATE "item" AS i
SET "assigneeId" = NULL
WHERE i."assigneeId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "member" AS m
    WHERE m."projectId" = i."projectId" AND m."userId" = i."assigneeId"
  );
