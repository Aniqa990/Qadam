-- 014: add history_summary column to volunteers
--
-- Append-only text column that accumulates a short entry each time a
-- project the volunteer contributed to is marked as completed by the
-- owning NGO (transitionProject → 'completed'). Each entry is a single
-- line: "Completed: <title> (<category>, skills: ...)". Capped at ~15
-- entries by the writer (oldest lines are dropped when the cap is hit).
--
-- Written best-effort on project completion — a failure to update this
-- column never fails the project-completion transition.

ALTER TABLE volunteers
    ADD COLUMN IF NOT EXISTS history_summary TEXT DEFAULT NULL;
