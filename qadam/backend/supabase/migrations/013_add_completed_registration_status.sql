-- 013: add 'completed' to registration_status enum
--
-- The 'completed' value is used by the project-completion flow
-- (transitionProject in project.service.ts) to mark a registration as
-- fulfilled when its project is completed by the owning NGO. A previous
-- design wrote this on attendance check-out; that was removed because
-- checkout is per-session and a project may span many sessions.
--
-- ALTER TYPE ... ADD VALUE is in its own migration file because it cannot
-- run inside the same transaction as other DDL on some Postgres versions.
-- Supabase CLI wraps each .sql file in its own transaction, so the new
-- value is committed and usable by the time the next migration runs.

ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'completed';
