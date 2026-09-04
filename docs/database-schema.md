# Database Schema

> **Auth provider note:** Clerk is the identity provider. `volunteers.auth_user_id` and `ngos.auth_user_id` store Clerk user IDs as `TEXT`; there is no local `auth.users` table. Express verifies Clerk session tokens and performs authorization server-side. Supabase PostgreSQL/Storage/pgvector remain the data and storage layer.
>
> **Location note:** Volunteers store an exact profile pin plus a cached `"City, Country"` label. NGOs do not have a profile location. Project location is set by the NGO during project creation and stored as the exact project pin plus its `"City, Country"` label. Availability is not stored anywhere in the project/database model.

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid() fallback
```

## Entity-Relationship Diagram

```
Clerk (external identity)
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
CREATE TYPE project_status AS ENUM ('draft', 'upcoming', 'active', 'completed', 'cancelled');
CREATE TYPE registration_status AS ENUM ('confirmed', 'cancelled');
CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'ready', 'failed');
```

## Tables

### `volunteers`

Extended profile for volunteer users. Links 1:1 to a Clerk identity via `auth_user_id`.

| Column           | Type             | Constraints                          | Notes                         |
|------------------|------------------|--------------------------------------|-------------------------------|
| `id`             | `UUID`           | PK, DEFAULT `gen_random_uuid()`     |                               |
| `auth_user_id`   | `TEXT`           | UNIQUE, NOT NULL                     | Clerk user ID                 |
| `full_name`      | `TEXT`           | NOT NULL                             |                               |
| `email`          | `TEXT`           | NOT NULL, UNIQUE                     | Denormalized from auth        |
| `phone`          | `TEXT`           |                                      | Optional                      |
| `skills`         | `TEXT[]`         | NOT NULL, DEFAULT `'{}'`            | e.g. `{"teaching","design"}`  |
| `interests`      | `TEXT[]`         | NOT NULL, DEFAULT `'{}'`            | e.g. `{"education","health"}` |
| `location_lat`   | `DOUBLE PRECISION`|                                     | Exact volunteer pin selected with MapLibre/OpenFreeMap |
| `location_lng`   | `DOUBLE PRECISION`|                                     | Exact volunteer pin selected with MapLibre/OpenFreeMap |
| `location_name`  | `TEXT`           |                                      | Format: `"City, Country"` (e.g. `"Karachi, Pakistan"`) — resolved via BigDataCloud reverse geocoding when the pin is dropped |
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

Organization profile for NGO users. Links 1:1 to a Clerk identity via `auth_user_id`.

| Column             | Type             | Constraints                          | Notes                       |
|--------------------|------------------|--------------------------------------|-----------------------------|
| `id`               | `UUID`           | PK, DEFAULT `gen_random_uuid()`     |                             |
| `auth_user_id`     | `TEXT`           | UNIQUE, NOT NULL                     | Clerk user ID               |
| `name`             | `TEXT`           | NOT NULL                             | Organization name           |
| `email`            | `TEXT`           | NOT NULL, UNIQUE                     | Contact email               |
| `description`      | `TEXT`           |                                      | Organization description    |
| `logo_url`         | `TEXT`           |                                      | Optional NGO logo URL |
| `categories`    | `TEXT[]`         | NOT NULL, DEFAULT `'{}'`            | e.g. `{"education","health"}` |
| `mission`          | `TEXT`           |                                      | Mission statement           |
| `website`          | `TEXT`           |                                      |                             |
| `phone`            | `TEXT`           |                                      |                             |
| `registration_number` | `TEXT`        |                                      | Legal registration ID       |
| `onboarding_complete` | `BOOLEAN`     | NOT NULL, DEFAULT `false`           |                             |
| `created_at`       | `TIMESTAMPTZ`    | NOT NULL, DEFAULT `now()`           |                             |
| `updated_at`       | `TIMESTAMPTZ`    | NOT NULL, DEFAULT `now()`           |                             |

**Indexes:**
- `idx_ngos_auth_user_id` — UNIQUE on `auth_user_id`
- `idx_ngos_email` — UNIQUE on `email`
- `idx_ngos_categories` — GIN on `categories`

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
| `whatsapp_group_url` | `TEXT`         |                                      | Optional WhatsApp group URL |
| `status`            | `project_status`  | NOT NULL, DEFAULT `'draft'`         | Lifecycle: `draft → upcoming → active → completed/cancelled`; details are frozen once `active` |
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
  "custom_requirements": ["Must have first-aid certification"]
}
```

`min_age` and `custom_requirements` are the only enforced eligibility fields for MVP — `min_age` is checked server-side at registration and by the matching deterministic filter; `custom_requirements` is free text shown to volunteers (e.g. "requires a background check", "must speak Urdu") but not machine-validated. Do not add other structured eligibility keys (e.g. a separate `requires_background_check` boolean or `required_languages` array) unless registration validation, matching, and the Copilot schema are all updated to enforce them — an unenforced key is a silent no-op.

Note: `volunteers` has no `gender` column. Any gender-based project eligibility (e.g. "open to female volunteers only") is expressed as free text inside `custom_requirements`, not as a dedicated schema field or filter.

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
| `created_by`  | `TEXT`           | NOT NULL                             | Clerk user ID who created the event |                              |
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

**Embedding input text:** Concatenation of `skills` and `interests` only; never location or availability. Regenerated only when one of these two fields changes (see AGENTS.md AI section). Past registrations/attendance are deliberately excluded from the embedding for MVP — see "Embedding design" discussion.

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

**Embedding input text:** Concatenation of `title`, `description`, `category`, `required_skills`, and `responsibilities` only; never location or availability.

**Indexes:**
- `idx_project_embeddings_embedding` — using ivfflat on `embedding vector_cosine_ops`

---

## Row Level Security (RLS) Policies

The MVP uses **backend-only authorization**. Express verifies Clerk tokens and performs all authorization before using the Supabase service-role client. RLS remains enabled with default-deny policies as defense-in-depth against accidental direct client access.

No frontend code queries Supabase directly, so application authorization is enforced in the backend rather than with `auth.uid()` policies. Embedding tables are service-role only.

## Authorization Matrix

| Resource              | Volunteer (own)  | NGO (own)        | Any Authenticated | Public |
|-----------------------|------------------|------------------|-------------------|--------|
| Volunteer profile     | R/W              | —                | R (limited)       | —      |
| NGO profile           | —                | R/W              | R (limited)       | —      |
| Projects (draft)      | —                | R/W              | —                 | —      |
| Projects (upcoming)  | R                | R/W              | R                 | —      |
| Registrations         | R/W (own)        | R (own projects) | —                 | —      |
| Attendance            | R (own)          | R (own projects) | —                 | —      |
| Knowledge documents   | —                | R/W (own)        | —                 | —      |
| Knowledge chunks      | —                | R/W (own)        | —                 | —      |
| Embeddings            | —                | —                | —                 | —      |

All embedding access is service-role only — the backend manages embeddings transparently.