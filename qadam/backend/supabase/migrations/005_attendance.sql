-- 005: attendance_tokens and attendance tables

-- =============================================================================
-- attendance_tokens
-- Time-limited tokens encoded in QR codes for each attendance event.
-- =============================================================================
CREATE TABLE attendance_tokens (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID        NOT NULL UNIQUE,
    project_id      UUID        NOT NULL REFERENCES projects (id),
    token           TEXT        NOT NULL UNIQUE,
    event_name      TEXT,
    event_date      DATE        NOT NULL,
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    created_by      TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_tokens_project_id ON attendance_tokens (project_id);
CREATE UNIQUE INDEX idx_attendance_tokens_token ON attendance_tokens (token);

-- =============================================================================
-- attendance
-- Verified check-in/check-out records.
-- =============================================================================
CREATE TABLE attendance (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID            NOT NULL REFERENCES registrations (id),
    volunteer_id    UUID            NOT NULL REFERENCES volunteers (id),
    project_id      UUID            NOT NULL REFERENCES projects (id),
    event_id        UUID            NOT NULL,
    check_in        TIMESTAMPTZ,
    check_out       TIMESTAMPTZ,
    hours           DOUBLE PRECISION DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_attendance_volunteer_event UNIQUE (volunteer_id, event_id),
    CONSTRAINT chk_attendance_hours_positive CHECK (hours >= 0)
);

CREATE INDEX idx_attendance_volunteer_id ON attendance (volunteer_id);
CREATE INDEX idx_attendance_project_id   ON attendance (project_id);
CREATE INDEX idx_attendance_event_id     ON attendance (event_id);
