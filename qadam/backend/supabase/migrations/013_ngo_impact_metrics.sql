-- 013: NGO impact metrics aggregation function
--
-- Backs GET /api/impact/ngo (impact.service.ts). Everything is derived by
-- PostgreSQL aggregation over the authoritative rows (projects,
-- registrations, attendance) in a single round trip - no metrics table, no
-- AI. Metric definitions (documented in api-contracts.md "Impact Module"):
--   total_projects     all projects owned by the NGO (any status)
--   active/completed   status slices of the same set
--   total_volunteers   DISTINCT volunteers with a confirmed registration on
--                      one of the NGO's projects
--   total_hours        SUM(attendance.hours) where check_out IS NOT NULL
--                      (verified hours only - attendance is the source of
--                      truth for participation and survives later
--                      registration/project cancellation)
--   attendance_rate    share of those confirmed-registered volunteers who
--                      have at least one check-in on the NGO's projects
--                      (0 when nobody is registered; bounded [0,1])
--   by_cause           per projects.category: project count, distinct
--                      confirmed volunteers, verified hours
--   by_location        per projects.location_name ("City, Country",
--                      'Unknown' when null): same measures
--   by_month           verified hours grouped by check-in month (YYYY-MM)
--
-- Access paths are covered by existing indexes (idx_projects_ngo_id,
-- idx_registrations_project_id/_project_status, idx_attendance_project_id),
-- so no new indexes are needed. The function is STABLE (read-only) and runs
-- with the caller's privileges; impact.service.ts always passes the ngo_id
-- resolved server-side from the authenticated Clerk identity - the id is
-- never accepted from the client.
--
-- Hours are rounded to 2 decimals and counts cast to int so the returned
-- JSON carries clean numbers (numeric would render "30.00"; bigint is fine
-- but int keeps the shape uniform for the TypeScript DTO).

CREATE OR REPLACE FUNCTION ngo_impact_metrics(p_ngo_id uuid)
RETURNS json
LANGUAGE sql
STABLE
AS $func$
WITH
-- The NGO's projects (accessed via idx_projects_ngo_id).
ngo_projects AS (
    SELECT
        id,
        status,
        category,
        COALESCE(location_name, 'Unknown') AS location_name
    FROM projects
    WHERE ngo_id = p_ngo_id
),
-- Confirmed registrations on those projects (idx_registrations_project_status).
ngo_registrations AS (
    SELECT r.volunteer_id, r.project_id
    FROM registrations r
    JOIN ngo_projects p ON p.id = r.project_id
    WHERE r.status = 'confirmed'
),
-- Every check-in on those projects (idx_attendance_project_id). Hours only
-- become "verified" once check_out is set; the rate, however, counts any
-- check-in as attendance.
ngo_attendance AS (
    SELECT a.volunteer_id, a.project_id, a.check_in, a.check_out, a.hours
    FROM attendance a
    JOIN ngo_projects p ON p.id = a.project_id
),
totals AS (
    SELECT
        (SELECT count(*)::int FROM ngo_projects) AS total_projects,
        (SELECT count(*)::int FROM ngo_projects WHERE status = 'active') AS active_projects,
        (SELECT count(*)::int FROM ngo_projects WHERE status = 'completed') AS completed_projects,
        (SELECT count(DISTINCT volunteer_id)::int FROM ngo_registrations) AS total_volunteers,
        (SELECT COALESCE(round(sum(hours)::numeric, 2), 0)::float8
           FROM ngo_attendance
          WHERE check_out IS NOT NULL) AS total_hours,
        -- Attendees = checked-in volunteers who still hold a confirmed
        -- registration, so the rate can never exceed 1 (a volunteer whose
        -- registration was cancelled after attending is no longer part of
        -- the currently-confirmed community the rate is measured against).
        (SELECT count(DISTINCT a.volunteer_id)::int
           FROM ngo_attendance a
          WHERE EXISTS (
                SELECT 1 FROM ngo_registrations r
                 WHERE r.volunteer_id = a.volunteer_id
          )) AS attended_volunteers
),
-- Per-cause measures are grouped separately and re-joined on the grouping
-- key: a single registrations×attendance join would fan out and inflate
-- the hour sums (one attendance row would duplicate every registration row).
cause_projects AS (
    SELECT category, count(*)::int AS projects
    FROM ngo_projects
    GROUP BY category
),
cause_volunteers AS (
    SELECT p.category, count(DISTINCT r.volunteer_id)::int AS volunteers
    FROM ngo_registrations r
    JOIN ngo_projects p ON p.id = r.project_id
    GROUP BY p.category
),
cause_hours AS (
    SELECT p.category, COALESCE(round(sum(a.hours)::numeric, 2), 0)::float8 AS hours
    FROM ngo_attendance a
    JOIN ngo_projects p ON p.id = a.project_id
    WHERE a.check_out IS NOT NULL
    GROUP BY p.category
),
by_cause AS (
    SELECT
        cp.category,
        cp.projects,
        COALESCE(cv.volunteers, 0)::int AS volunteers,
        COALESCE(ch.hours, 0)::float8 AS hours
    FROM cause_projects cp
    LEFT JOIN cause_volunteers cv ON cv.category = cp.category
    LEFT JOIN cause_hours ch ON ch.category = cp.category
),
location_projects AS (
    SELECT location_name, count(*)::int AS projects
    FROM ngo_projects
    GROUP BY location_name
),
location_volunteers AS (
    SELECT p.location_name, count(DISTINCT r.volunteer_id)::int AS volunteers
    FROM ngo_registrations r
    JOIN ngo_projects p ON p.id = r.project_id
    GROUP BY p.location_name
),
location_hours AS (
    SELECT p.location_name, COALESCE(round(sum(a.hours)::numeric, 2), 0)::float8 AS hours
    FROM ngo_attendance a
    JOIN ngo_projects p ON p.id = a.project_id
    WHERE a.check_out IS NOT NULL
    GROUP BY p.location_name
),
by_location AS (
    SELECT
        lp.location_name AS location,
        lp.projects,
        COALESCE(lv.volunteers, 0)::int AS volunteers,
        COALESCE(lh.hours, 0)::float8 AS hours
    FROM location_projects lp
    LEFT JOIN location_volunteers lv ON lv.location_name = lp.location_name
    LEFT JOIN location_hours lh ON lh.location_name = lp.location_name
),
by_month AS (
    SELECT
        to_char(date_trunc('month', a.check_in), 'YYYY-MM') AS month,
        COALESCE(round(sum(a.hours)::numeric, 2), 0)::float8 AS hours
    FROM ngo_attendance a
    WHERE a.check_out IS NOT NULL
    GROUP BY 1
)
SELECT json_build_object(
    'total_projects', t.total_projects,
    'active_projects', t.active_projects,
    'completed_projects', t.completed_projects,
    'total_volunteers', t.total_volunteers,
    'total_hours', t.total_hours,
    'attendance_rate', round(
        CASE WHEN t.total_volunteers = 0 THEN 0
             ELSE t.attended_volunteers::float8 / t.total_volunteers
        END, 4)::float8,
    'by_cause', (
        SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.hours DESC, c.category), '[]'::json)
        FROM by_cause c
    ),
    'by_location', (
        SELECT COALESCE(json_agg(row_to_json(l) ORDER BY l.hours DESC, l.location), '[]'::json)
        FROM by_location l
    ),
    'by_month', (
        SELECT COALESCE(json_agg(row_to_json(m) ORDER BY m.month), '[]'::json)
        FROM by_month m
    )
)
FROM totals t;
$func$;
