-- 011: drop volunteers.experience
-- The free-text "volunteer experience/history" field is removed from the
-- product entirely: no form input, no API field, no storage. The volunteer
-- embedding input becomes skills + interests only. Existing stored values
-- are discarded — run once in the Supabase SQL Editor.

ALTER TABLE volunteers DROP COLUMN IF EXISTS experience;
