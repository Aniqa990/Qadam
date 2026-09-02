-- 004: registrations table
-- Volunteer sign-ups for projects.

CREATE TABLE registrations (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id    UUID                NOT NULL REFERENCES volunteers (id),
    project_id      UUID                NOT NULL REFERENCES projects (id),
    status          registration_status NOT NULL DEFAULT 'confirmed',
    registered_at   TIMESTAMPTZ         NOT NULL DEFAULT now(),
    cancelled_at    TIMESTAMPTZ,

    CONSTRAINT uq_registration_volunteer_project UNIQUE (volunteer_id, project_id)
);

CREATE INDEX idx_registrations_volunteer_id    ON registrations (volunteer_id);
CREATE INDEX idx_registrations_project_id      ON registrations (project_id);
CREATE INDEX idx_registrations_project_status  ON registrations (project_id, status);
