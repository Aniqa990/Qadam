-- 003: projects table
-- Projects created by NGOs with a status lifecycle.

CREATE TABLE projects (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    ngo_id              UUID            NOT NULL REFERENCES ngos (id),
    title               TEXT            NOT NULL,
    description         TEXT            NOT NULL,
    required_skills     TEXT[]          NOT NULL DEFAULT '{}',
    category            TEXT            NOT NULL,
    responsibilities    TEXT[]          NOT NULL DEFAULT '{}',
    eligibility         JSONB           NOT NULL DEFAULT '{}',
    capacity            INTEGER         NOT NULL CHECK (capacity > 0),
    whatsapp_group_url  TEXT,
    status              project_status  NOT NULL DEFAULT 'draft',
    start_date          DATE            NOT NULL,
    end_date            DATE            NOT NULL,
    event_date          DATE,
    location_name       TEXT,
    location_lat        DOUBLE PRECISION,
    location_lng        DOUBLE PRECISION,
    hours_per_session   DOUBLE PRECISION DEFAULT 0,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT chk_project_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_projects_ngo_id          ON projects (ngo_id);
CREATE INDEX idx_projects_status          ON projects (status);
CREATE INDEX idx_projects_required_skills ON projects USING GIN (required_skills);
CREATE INDEX idx_projects_date_range      ON projects (start_date, end_date);
