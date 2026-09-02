-- 001: Extensions and enum types
-- Required by all subsequent migrations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
CREATE TYPE user_role AS ENUM ('volunteer', 'ngo');
CREATE TYPE project_status AS ENUM ('draft', 'published', 'active', 'completed', 'cancelled');
CREATE TYPE registration_status AS ENUM ('confirmed', 'cancelled');
CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'ready', 'failed');
