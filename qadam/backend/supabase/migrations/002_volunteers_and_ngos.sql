-- 002: volunteers and ngos tables
-- Clerk is the identity provider; auth_user_id stores Clerk user IDs as TEXT.

-- =============================================================================
-- volunteers
-- =============================================================================
CREATE TABLE volunteers (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id    TEXT            NOT NULL UNIQUE,
    full_name       TEXT            NOT NULL,
    email           TEXT            NOT NULL UNIQUE,
    phone           TEXT,
    skills          TEXT[]          NOT NULL DEFAULT '{}',
    interests       TEXT[]          NOT NULL DEFAULT '{}',
    experience      TEXT,
    location_lat    DOUBLE PRECISION,
    location_lng    DOUBLE PRECISION,
    location_name   TEXT,
    age             INTEGER         CHECK (age >= 15 AND age <= 100),
    onboarding_complete BOOLEAN    NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_volunteers_auth_user_id ON volunteers (auth_user_id);
CREATE UNIQUE INDEX idx_volunteers_email        ON volunteers (email);
CREATE INDEX idx_volunteers_skills              ON volunteers USING GIN (skills);
CREATE INDEX idx_volunteers_interests           ON volunteers USING GIN (interests);
CREATE INDEX idx_volunteers_onboarding          ON volunteers (onboarding_complete);

-- =============================================================================
-- ngos
-- =============================================================================
CREATE TABLE ngos (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id        TEXT        NOT NULL UNIQUE,
    name                TEXT        NOT NULL,
    email               TEXT        NOT NULL UNIQUE,
    description         TEXT,
    logo_url            TEXT,
    categories          TEXT[]      NOT NULL DEFAULT '{}',
    mission             TEXT,
    website             TEXT,
    phone               TEXT,
    registration_number TEXT,
    onboarding_complete BOOLEAN     NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ngos_auth_user_id ON ngos (auth_user_id);
CREATE UNIQUE INDEX idx_ngos_email        ON ngos (email);
CREATE INDEX idx_ngos_categories          ON ngos USING GIN (categories);
