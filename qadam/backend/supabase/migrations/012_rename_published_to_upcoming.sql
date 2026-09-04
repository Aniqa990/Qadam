-- 012: rename project_status 'published' → 'upcoming'
-- The lifecycle becomes draft → upcoming → active → completed/cancelled.
-- New projects still default to 'draft'; publishing a draft now makes it
-- 'upcoming' (visible to volunteers, open for registration/matching/
-- attendance alongside 'active').
--
-- ALTER TYPE ... RENAME VALUE (PostgreSQL 10+) keeps each enum value's
-- internal OID, so the RLS policies in 009_rls_policies.sql that reference
-- the 'published' literal keep matching the renamed value unchanged.

ALTER TYPE project_status RENAME VALUE 'published' TO 'upcoming';
