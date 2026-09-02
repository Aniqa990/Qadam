# Database Schema

> **Auth provider note (Clerk migration):** This schema originally assumed Supabase Auth, where `auth_user_id` is a UUID FK into Supabase's built-in `auth.users` table and RLS policies use `auth.uid()`. With Clerk as the auth provider, `auth_user_id` instead stores Clerk's user ID (a string like `user_2abc...`, not a UUID) and there is no local `auth.users` table to FK against. See "Clerk Auth Migration" in AGENTS.md for the two supported ways to keep RLS working (Supabase's native third-party Clerk integration, or backend-only authorization with RLS as defense-in-depth). All `auth_user_id UUID ... FK → auth.users` rows below and all `auth.uid()` policy expressions should be read as `auth_user_id TEXT` (no FK) and `auth.jwt()->>'sub'` respectively once the migration lands.

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid() fallback
```

## Entity-Relationship Diagram

```
auth.users (Supabase Auth)
    │
    ├──1:1── volunteers
    │             │
    │             ├──1:N── registrations ──N:1── projects
    │             │             │
    │             │             └──1:N── attendance
    │             │
    │             └──1:1── volunteer_embeddings
    │
    └──1:1── ngos
                  │
                  ├──1:N── projects
                  │             │
                  │             ├──1:N── registrations
                  │             │
                  │             └──1:1── project_embeddings
                  │
                  ├──1:N── knowledge_documents
                  │             │
                  │             └──1:N── knowledge_chunks
                  │
                  └──1:N── attendance_tokens
```

## Enums

```sql
CREATE TYPE user_role AS ENUM ('volunteer', 'ngo');
CREATE TYPE project_status AS ENUM ('draft', 'published', 'active', 'completed', 'cancelled');
CREATE TYPE registration_status AS ENUM ('confirmed', 'cancelled', 'waitlisted');
CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'ready', 'failed');
```

## Tables

### `volunteers`

Extended profile for volunteer users. Links 1:1 to `auth.users`.

| Column           | Type             | Constraints                          | Notes                         |
|------------------|------------------|--------------------------------------|-------------------------------|
| `id`             | `UUID`           | PK, DEFAULT `gen_random_uuid()`     |                               |
| `auth_user_id`   | `UUID`           | UNIQUE, NOT NULL, FK → `auth.users` | Supabase Auth user ID         |
| `full_name`      | `TEXT`           | NOT NULL                             |                               |
| `email`          | `TEXT`           | NOT NULL, UNIQUE                     | Denormalized from auth        |
| `phone`          | `TEXT`           |                                      | Optional                      |
| `skills`         | `TEXT[]`         | NOT NULL, DEFAULT `'{}'`            | e.g. `{"teaching","design"}`  |
| `interests`      | `TEXT[]`         | NOT NULL, DEFAULT `'{}'`            | e.g. `{"education","health"}` |
| `experience`     | `TEXT`           |                                      | Free-text experience summary  |
| `availability`   | `JSONB`          | NOT NULL, DEFAULT `'{}'`            | See availability schema below|
| `location_lat`   | `DOUBLE PRECISION`|                                     | Exact pin dropped on map (OpenStreetMap/Leaflet), not a city centroid |
| `location_lng`   | `DOUBLE PRECISION`|                                     | Exact pin dropped on map     |
| `location_name`  | `TEXT`           |                                      | Format: `"City, Country"` (e.g. `"Karachi, Pakistan"`) — resolved via reverse geocoding when the pin is dropped |
| `age`  | `INTEGER`        | CHECK (`age >= 15 AND age <= 100`)  | Direct integer age, used as-is for eligibility checks (no DOB math) |
| `onboarding_complete` | `BOOLEAN`  | NOT NULL, DEFAULT `false`           | Gates access to features      |
| `created_at`     | `TIMESTAMPTZ`    | NOT NULL, DEFAULT `now()`           |                               |
| `updated_at`     | `TIMESTAMPTZ`    | NOT NULL, DEFAULT `now()`           |                               |



**Indexes:**
- `idx_volunteers_auth_user_id` — UNIQUE on `auth_user_id`
- `idx_volunteers_email` — UNIQUE on `email`
- `idx_volunteers_skills` — GIN on `skills`
- `idx_volunteers_interests` — GIN on `interests`
- `idx_volunteers_onboarding` — on `onboarding_complete`

---

### `ngos`

Organization profile for NGO users. Links 1:1 to `auth.users`.

| Column             | Type             | Constraints                          | Notes                       |
|--------------------|------------------|--------------------------------------|-----------------------------|
| `id`               | `UUID`           | PK, DEFAULT `gen_random_uuid()`     |                             |
| `auth_user_id`     | `UUID`           | UNIQUE, NOT NULL, FK → `auth.users` |                             |
| `name`             | `TEXT`           | NOT NULL                             | Organization name           |
| `email`            | `TEXT`           | NOT NULL, UNIQUE                     | Contact email               |
| `description`      | `TEXT`           |                                      | Organization description    |
| `category`      | `TEXT[]`         | NOT NULL, DEFAULT `'{}'`            | e.g. `{"education","health"}` |
| `mission`          | `TEXT`           |                                      | Mission statement           |
| `website`          | `TEXT`           |                                      |                             |
| `phone`            | `TEXT`           |                                      |                             |
| `registration_number` | `TEXT`        |                                      | Legal registration ID       |
| `location_name`    | `TEXT`           |                                      | Format: `"City, Country"`   |
| `location_lat`     | `DOUBLE PRECISION`|                                     | Exact pin from map picker    |
| `location_lng`     | `DOUBLE PRECISION`|                                     | Exact pin from map picker    |
| `onboarding_complete` | `BOOLEAN`     | NOT NULL, DEFAULT `false`           |                             |
| `created_at`       | `TIMESTAMPTZ`    | NOT NULL, DEFAULT `now()`           |                             |
| `updated_at`       | `TIMESTAMPTZ`    | NOT NULL, DEFAULT `now()`           |                             |

**Indexes:**
- `idx_ngos_auth_user_id` — UNIQUE on `auth_user_id`
- `idx_ngos_email` — UNIQUE on `email`

---

### `projects`

Projects created by NGOs with a status lifecycle.

| Column              | Type              | Constraints                          | Notes                        |
|---------------------|-------------------|--------------------------------------|------------------------------|
| `id`                | `UUID`            | PK, DEFAULT `gen_random_uuid()`     |                              |
| `ngo_id`            | `UUID`            | NOT NULL, FK → `ngos(id)`           | Owning NGO                   |
| `title`             | `TEXT`            | NOT NULL                             |                              |
| `description`       | `TEXT`            | NOT NULL                             |                              |
| `required_skills`   | `TEXT[]`          | NOT NULL, DEFAULT `'{}'`            | Skills needed                |
| `category`      | `TEXT`         | NOT NULL,                                  | e.g. `"education"` |
| `responsibilities`  | `TEXT[]`          | NOT NULL, DEFAULT `'{}'`            | Task list                    |
| `eligibility`       | `JSONB`           | NOT NULL, DEFAULT `'{}'`            | See schema below             |
| `capacity`          | `INTEGER`         | NOT NULL, CHECK (`capacity > 0`)    | Max volunteers               |
| `status`            | `project_status`  | NOT NULL, DEFAULT `'draft'`         | Lifecycle state              |
| `start_date`        | `DATE`            | NOT NULL                             |                              |
| `end_date`          | `DATE`            | NOT NULL                             |                              |
| `event_date`        | `DATE`            |                                      | Single-event date (if applicable) |
| `location_name`     | `TEXT`            |                                      | Format: `"City, Country"`    |
| `location_lat`      | `DOUBLE PRECISION`|                                      | Exact pin from map picker    |
| `location_lng`      | `DOUBLE PRECISION`|                                      | Exact pin from map picker    |
| `hours_per_session` | `DOUBLE PRECISION`| DEFAULT `0`                         | Estimated hours              |
| `created_at`        | `TIMESTAMPTZ`     | NOT NULL, DEFAULT `now()`           |                              |
| `updated_at`        | `TIMESTAMPTZ`     | NOT NULL, DEFAULT `now()`           |                              |

**Constraints:**
- `chk_project_dates` — CHECK (`end_date >= start_date`)

**Eligibility JSONB schema:**
```json
{
  "min_age": 18,
  "requires_background_check": false,
  "required_languages": ["en"],
  "custom_requirements": ["Must have first-aid certification"]
}
```

**Indexes:**
- `idx_projects_ngo_id` — on `ngo_id`
- `idx_projects_status` — on `status`
- `idx_projects_required_skills` — GIN on `required_skills`
- `idx_projects_date_range` — on `(start_date, end_date)`

---

### `registrations`

Volunteer sign-ups for projects.

| Column           | Type                | Constraints                                | Notes              |
|------------------|---------------------|--------------------------------------------|--------------------|
| `id`             | `UUID`              | PK, DEFAULT `gen_random_uuid()`           |                    |
| `volunteer_id`   | `UUID`              | NOT NULL, FK → `volunteers(id)`           |                    |
| `project_id`     | `UUID`              | NOT NULL, FK → `projects(id)`             |                    |
| `status`         | `registration_status`| NOT NULL, DEFAULT `'confirmed'`          |                    |
| `registered_at`  | `TIMESTAMPTZ`       | NOT NULL, DEFAULT `now()`                 |                    |
| `cancelled_at`   | `TIMESTAMPTZ`       |                                            |                    |

**Constraints:**
- `uq_registration_volunteer_project` — UNIQUE (`volunteer_id`, `project_id`) — prevents duplicate registration

**Indexes:**
- `idx_registrations_volunteer_id` — on `volunteer_id`
- `idx_registrations_project_id` — on `project_id`
- `idx_registrations_project_status` — on `(project_id, status)` (for capacity counting)

---

### `attendance`

Verified check-in/check-out records.

| Column           | Type             | Constraints                          | Notes                        |
|------------------|------------------|--------------------------------------|------------------------------|
| `id`             | `UUID`           | PK, DEFAULT `gen_random_uuid()`     |                              |
| `registration_id`| `UUID`           | NOT NULL, FK → `registrations(id)`  | Must have a valid registration|
| `volunteer_id`   | `UUID`           | NOT NULL, FK → `volunteers(id)`     | Denormalized for convenience |
| `project_id`     | `UUID`           | NOT NULL, FK → `projects(id)`       | Denormalized for convenience |
| `event_id`       | `UUID`           | NOT NULL                             | References `attendance_tokens.event_id` — identifies *which session* (e.g. "Day 2 Morning"), while `project_id` identifies *which project* the session belongs to |
| `check_in`       | `TIMESTAMPTZ`    |                                      | Set on check-in              |
| `check_out`      | `TIMESTAMPTZ`    |                                      | Set on check-out             |
| `hours`          | `DOUBLE PRECISION`| DEFAULT `0`                         | Calculated on check-out      |
| `created_at`     | `TIMESTAMPTZ`    | NOT NULL, DEFAULT `now()`           |                              |

**Constraints:**
- `uq_attendance_volunteer_event` — UNIQUE (`volunteer_id`, `event_id`) — one attendance record per volunteer per event
- `chk_attendance_hours_positive` — CHECK (`hours >= 0`)

**Indexes:**
- `idx_attendance_volunteer_id` — on `volunteer_id`
- `idx_attendance_project_id` — on `project_id`
- `idx_attendance_event_id` — on `event_id`

---

### `attendance_tokens`

Time-limited tokens encoded in QR codes for each attendance event.

| Column        | Type             | Constraints                          | Notes                        |
|---------------|------------------|--------------------------------------|------------------------------|
| `id`          | `UUID`           | PK, DEFAULT `gen_random_uuid()`     |                              |
| `event_id`    | `UUID`           | NOT NULL, UNIQUE                     | One token per event          |
| `project_id`  | `UUID`           | NOT NULL, FK → `projects(id)`       |                              |
| `token`       | `TEXT`           | NOT NULL                             | Random token encoded in QR   |
| `event_name`  | `TEXT`           |                                      | e.g. "Day 1 Morning Session" |
| `event_date`  | `DATE`           | NOT NULL                             |                              |
| `window_start`| `TIMESTAMPTZ`    | NOT NULL                             | Earliest valid check-in      |
| `window_end`  | `TIMESTAMPTZ`    | NOT NULL                             | Latest valid check-in        |
| `created_by`  | `UUID`           | NOT NULL, FK → `auth.users`         |                              |
| `created_at`  | `TIMESTAMPTZ`    | NOT NULL, DEFAULT `now()`           |                              |

**Indexes:**
- `idx_attendance_tokens_project_id` — on `project_id`
- `idx_attendance_tokens_token` — UNIQUE on `token`

---

### `knowledge_documents`

Documents uploaded by NGOs for RAG.

| Column         | Type              | Constraints                          | Notes                        |
|----------------|-------------------|--------------------------------------|------------------------------|
| `id`           | `UUID`            | PK, DEFAULT `gen_random_uuid()`     |                              |
| `ngo_id`       | `UUID`            | NOT NULL, FK → `ngos(id)`           | Owning NGO                   |
| `file_name`    | `TEXT`            | NOT NULL                             | Original file name           |
| `file_type`    | `TEXT`            | NOT NULL                             | MIME type                    |
| `file_size`    | `INTEGER`         | NOT NULL                             | Bytes                        |
| `storage_path` | `TEXT`            | NOT NULL                             | Supabase Storage path        |
| `status`       | `document_status` | NOT NULL, DEFAULT `'uploaded'`      | Processing status            |
| `chunk_count`  | `INTEGER`         | DEFAULT `0`                         |                              |
| `error_message`| `TEXT`            |                                      | Set if status = 'failed'     |
| `created_at`   | `TIMESTAMPTZ`     | NOT NULL, DEFAULT `now()`           |                              |

**Constraints:**
- `chk_knowledge_file_size` — CHECK (`file_size <= 10485760`) — 10 MB max for MVP

**Indexes:**
- `idx_knowledge_documents_ngo_id` — on `ngo_id`
- `idx_knowledge_documents_status` — on `status`

---

### `knowledge_chunks`

Text chunks extracted from knowledge documents, with embeddings.

| Column          | Type           | Constraints                          | Notes                        |
|-----------------|----------------|--------------------------------------|------------------------------|
| `id`            | `UUID`         | PK, DEFAULT `gen_random_uuid()`     |                              |
| `document_id`   | `UUID`         | NOT NULL, FK → `knowledge_documents(id)` ON DELETE CASCADE | |
| `ngo_id`        | `UUID`         | NOT NULL, FK → `ngos(id)`           | Denormalized for RLS/search  |
| `chunk_index`   | `INTEGER`      | NOT NULL                             | Order within document        |
| `content`       | `TEXT`         | NOT NULL                             | Chunk text                   |
| `embedding`     | `vector(384)`  |                                      | HF `all-MiniLM-L6-v2` output |
| `created_at`    | `TIMESTAMPTZ`  | NOT NULL, DEFAULT `now()`           |                              |

**Constraints:**
- `uq_chunk_document_index` — UNIQUE (`document_id`, `chunk_index`)

**Indexes:**
- `idx_knowledge_chunks_document_id` — on `document_id`
- `idx_knowledge_chunks_ngo_id` — on `ngo_id`
- `idx_knowledge_chunks_embedding` — using ivfflat (or hnsw) on `embedding vector_cosine_ops`

---

### `volunteer_embeddings`

Cached semantic embedding of a volunteer's profile for matching.

| Column          | Type           | Constraints                          | Notes                        |
|-----------------|----------------|--------------------------------------|------------------------------|
| `id`            | `UUID`         | PK, DEFAULT `gen_random_uuid()`     |                              |
| `volunteer_id`  | `UUID`         | UNIQUE, NOT NULL, FK → `volunteers(id)` ON DELETE CASCADE | One per volunteer |
| `embedding`     | `vector(384)`  | NOT NULL                             | Combined profile embedding   |
| `content_hash`  | `TEXT`         | NOT NULL                             | Hash of input text — detect changes |
| `updated_at`    | `TIMESTAMPTZ`  | NOT NULL, DEFAULT `now()`           |                              |

**Embedding input text:** Concatenation of `skills`, `interests`, and `experience` (free-text). Regenerated only when one of these three fields changes (see AGENTS.md AI section). Past registrations/attendance are deliberately excluded from the embedding for MVP — see "Embedding design" discussion.

**Indexes:**
- `idx_volunteer_embeddings_embedding` — using ivfflat on `embedding vector_cosine_ops`

---

### `project_embeddings`

Cached semantic embedding of a project for matching.

| Column          | Type           | Constraints                          | Notes                        |
|-----------------|----------------|--------------------------------------|------------------------------|
| `id`            | `UUID`         | PK, DEFAULT `gen_random_uuid()`     |                              |
| `project_id`    | `UUID`         | UNIQUE, NOT NULL, FK → `projects(id)` ON DELETE CASCADE | One per project |
| `embedding`     | `vector(384)`  | NOT NULL                             | Combined project embedding   |
| `content_hash`  | `TEXT`         | NOT NULL                             | Hash of input text — detect changes |
| `updated_at`    | `TIMESTAMPTZ`  | NOT NULL, DEFAULT `now()`           |                              |

**Embedding input text:** Concatenation of `title`, `description`, `category`, `required_skills`, and `responsibilities`.

**Indexes:**
- `idx_project_embeddings_embedding` — using ivfflat on `embedding vector_cosine_ops`

---

## Row Level Security (RLS) Policies

All tables have RLS enabled. Policies use `auth.uid()` to identify the current user.

### `volunteers`

| Policy                 | Operation | Using                                           |
|------------------------|-----------|-------------------------------------------------|
| `volunteers_select_own`| SELECT    | `auth_user_id = auth.uid()`                     |
| `volunteers_insert_own`| INSERT    | `auth_user_id = auth.uid()`                     |
| `volunteers_update_own`| UPDATE    | `auth_user_id = auth.uid()`                     |
| `volunteers_select_public` | SELECT | `onboarding_complete = true` (for matching/discovery, limited columns) |

### `ngos`

| Policy              | Operation | Using                                   |
|---------------------|-----------|-----------------------------------------|
| `ngos_select_own`   | SELECT    | `auth_user_id = auth.uid()`             |
| `ngos_insert_own`   | INSERT    | `auth_user_id = auth.uid()`             |
| `ngos_update_own`   | UPDATE    | `auth_user_id = auth.uid()`             |
| `ngos_select_public`| SELECT    | `onboarding_complete = true` (limited columns: name, description, categories, logo) |

### `projects`

| Policy                  | Operation | Using                                                   |
|-------------------------|-----------|---------------------------------------------------------|
| `projects_select_own`   | SELECT    | `ngo_id IN (SELECT id FROM ngos WHERE auth_user_id = auth.uid())` |
| `projects_insert_own`   | INSERT    | `ngo_id IN (SELECT id FROM ngos WHERE auth_user_id = auth.uid())` |
| `projects_update_own`   | UPDATE    | Same as above                                           |
| `projects_delete_own`   | DELETE    | Same as above                                           |
| `projects_select_published` | SELECT | `status IN ('published', 'active', 'completed')` (all authenticated users) |

### `registrations`

| Policy                          | Operation | Using                                                   |
|---------------------------------|-----------|---------------------------------------------------------|
| `registrations_select_own`      | SELECT    | `volunteer_id IN (SELECT id FROM volunteers WHERE auth_user_id = auth.uid())` |
| `registrations_insert_own`      | INSERT    | `volunteer_id IN (SELECT id FROM volunteers WHERE auth_user_id = auth.uid())` |
| `registrations_select_ngo`      | SELECT    | `project_id IN (SELECT p.id FROM projects p JOIN ngos n ON p.ngo_id = n.id WHERE n.auth_user_id = auth.uid())` |
| `registrations_update_own`      | UPDATE    | Same as `registrations_select_own` (volunteer can cancel)|

### `attendance`

| Policy                     | Operation | Using                                                   |
|----------------------------|-----------|---------------------------------------------------------|
| `attendance_select_own`    | SELECT    | `volunteer_id IN (SELECT id FROM volunteers WHERE auth_user_id = auth.uid())` |
| `attendance_insert_service`| INSERT    | Service role only (backend creates records)             |
| `attendance_update_service`| UPDATE    | Service role only (backend updates check-out)           |
| `attendance_select_ngo`    | SELECT    | `project_id IN (SELECT p.id FROM projects p JOIN ngos n ON p.ngo_id = n.id WHERE n.auth_user_id = auth.uid())` |

### `attendance_tokens`

| Policy                       | Operation | Using                                  |
|------------------------------|-----------|----------------------------------------|
| `attendance_tokens_service`  | ALL       | Service role only                      |
| `attendance_tokens_ngo_select` | SELECT  | `project_id IN (SELECT p.id FROM projects p JOIN ngos n ON p.ngo_id = n.id WHERE n.auth_user_id = auth.uid())` |

### `knowledge_documents`

| Policy                          | Operation | Using                                  |
|---------------------------------|-----------|----------------------------------------|
| `knowledge_docs_ngo_manage`     | ALL       | `ngo_id IN (SELECT id FROM ngos WHERE auth_user_id = auth.uid())` |

### `knowledge_chunks`

| Policy                       | Operation | Using                                   |
|------------------------------|-----------|-----------------------------------------|
| `knowledge_chunks_ngo_manage`| ALL       | `ngo_id IN (SELECT id FROM ngos WHERE auth_user_id = auth.uid())` |
| `knowledge_chunks_service_read`| SELECT  | Service role only (RAG queries via service role client) |

### `volunteer_embeddings` / `project_embeddings`

| Policy                       | Operation | Using                                  |
|------------------------------|-----------|----------------------------------------|
| `embeddings_service`         | ALL       | Service role only                      |

All embedding operations (read/write for matching) go through the backend service role client — never directly from the frontend.

## Authorization Matrix

| Resource              | Volunteer (own)  | NGO (own)        | Any Authenticated | Public |
|-----------------------|------------------|------------------|-------------------|--------|
| Volunteer profile     | R/W              | —                | R (limited)       | —      |
| NGO profile           | —                | R/W              | R (limited)       | —      |
| Projects (draft)      | —                | R/W              | —                 | —      |
| Projects (published)  | R                | R/W              | R                 | —      |
| Registrations         | R/W (own)        | R (own projects) | —                 | —      |
| Attendance            | R (own)          | R (own projects) | —                 | —      |
| Knowledge documents   | —                | R/W (own)        | —                 | —      |
| Knowledge chunks      | —                | R/W (own)        | —                 | —      |
| Embeddings            | —                | —                | —                 | —      |

All embedding access is service-role only — the backend manages embeddings transparently.