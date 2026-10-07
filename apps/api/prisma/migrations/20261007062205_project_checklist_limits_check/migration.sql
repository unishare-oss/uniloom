-- Checklist limits are at least 1 and the minimum is not above the maximum (null = no
-- limit). The service checks this too; the CHECK also holds when two updates race.
ALTER TABLE "project" ADD CONSTRAINT "project_checklist_limits" CHECK (
  ("checklistMin" IS NULL OR "checklistMin" >= 1)
  AND ("checklistMax" IS NULL OR "checklistMax" >= 1)
  AND ("checklistMin" IS NULL OR "checklistMax" IS NULL OR "checklistMin" <= "checklistMax")
);
