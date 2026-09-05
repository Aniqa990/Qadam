# API Contracts

## General Conventions

- **Base URL:** `/api`
- **Authentication:** `Authorization: Bearer <clerk_session_token>` on all protected endpoints (verified backend-side with Clerk's Node SDK)
- **Content-Type:** `application/json`
- **Pagination:** `?page=1&limit=20` (default limit 20, max 100)

### Standard Response Envelope

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Success (list):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

**Error:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Project not found", "details": [] } }
```

### HTTP Status Codes

| Code | Meaning              |
|------|----------------------|
| 200  | Success              |
| 201  | Created              |
| 400  | Validation error     |
| 401  | Not authenticated    |
| 403  | Not authorized       |
| 404  | Resource not found   |
| 409  | Conflict (duplicate) |
| 500  | Server error         |

---

## Auth Module — `/api/auth`

Clerk owns sign-up, sign-in, session refresh, and logout in the frontend. The backend does not implement password-based `/signup`, `/login`, `/refresh`, or logout endpoints. Protected API requests carry a Clerk session token verified server-side.

### `GET /api/auth/me`

Get current authenticated user with role and profile.

**Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "volunteer",
    "profile": {
      "id": "uuid",
      "full_name": "Jane Doe",
      "onboarding_complete": true
    }
  }
}
```

The `profile` field contains the volunteer or NGO profile object based on the user's role.

## Volunteers Module — `/api/volunteers`

### `GET /api/volunteers/profile`

Get the authenticated volunteer's full profile.

**Auth:** Required — Volunteer only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "skills": ["teaching", "mentoring", "design"],
    "interests": ["education", "youth"],
    "location_lat": 24.7136,
    "location_lng": 46.6753,
    "location_name": "Riyadh, Saudi Arabia",
    "age": 20,
    "onboarding_complete": true,
    "created_at": "2026-09-01T00:00:00Z"
  }
}
```

---

### `POST /api/volunteers/profile`

Create or update the volunteer profile (onboarding).

**Auth:** Required — Volunteer only

**Request:**
```json
{
  "full_name": "Jane Doe",
  "phone": "+1234567890",
  "skills": ["teaching", "mentoring"],
  "interests": ["education", "youth"],
  "location_lat": 24.7136,
  "location_lng": 46.6753,
  "location_name": "Riyadh, Saudi Arabia",
  "age": 20
}
```

All fields except `full_name` are optional. Setting sufficient fields sets `onboarding_complete = true` (at minimum: `full_name`, `skills`, `interests`). `age` is stored and used directly for eligibility checks — no `date_of_birth` field or age calculation.

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "onboarding_complete": true } }
```

---

### Volunteer Location Pin

During volunteer onboarding/profile, the volunteer selects an exact location on the map. The frontend sends `location_lat`/`location_lng`; the backend reverse-geocodes the pin to `location_name = "City, Country"` and stores all three values. The volunteer can update the pin later.

### `PUT /api/volunteers/profile`

Update specific profile fields.

**Auth:** Required — Volunteer only

**Request:** Same shape as POST, all fields optional (partial update).

**Response (200):** Same as POST response.

---

## NGOs Module — `/api/ngos`

### `GET /api/ngos/profile`

Get the authenticated NGO's organization profile.

**Auth:** Required — NGO only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Education For All",
    "email": "info@efa.org",
    "description": "We provide education to underserved communities",
    "logo_url": "...",
    "mission": "Quality education for every child",
    "website": "https://efa.org",
    "phone": "+1234567890",
    "categories": ["education", "youth"],
    "onboarding_complete": true,
    "created_at": "2026-09-01T00:00:00Z"
  }
}
```

---

### `POST /api/ngos/profile`

Create or update the NGO profile (onboarding).

**Auth:** Required — NGO only

**Request:**
```json
{
  "name": "Education For All",
  "description": "We provide education...",
  "logo_url": "...",
  "mission": "Quality education for every child",
  "website": "https://efa.org",
  "phone": "+1234567890",
  "categories": ["education", "youth"],
  "registration_number": "NGO-2024-001"
}
```

Required: `name`, `description`. Other fields optional. `onboarding_complete` set when `name` and `description` are present.

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "onboarding_complete": true } }
```

---

### `PUT /api/ngos/profile`

Update specific NGO profile fields.

**Auth:** Required — NGO only

**Request:** Same shape as POST, all fields optional.

**Response (200):** Same as POST response.

---

### `GET /api/ngos`

List all NGOs with completed onboarding (public directory).

**Auth:** Required (any role)

**Query:** `?page=1&limit=20&categories=education&search=health`

**Response (200):** Paginated list of NGO summary objects.

```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Education For All", "description": "...", "logo_url": "...", "categories": ["education"] }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

### `GET /api/ngos/:id`

Get a single NGO's public profile.

**Auth:** Required (any role)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Education For All",
    "description": "...",
    "mission": "...",
    "logo_url": "...",
    "website": "...",
    "categories": ["education"]
  }
}
```

---

## Projects Module — `/api/projects`

### `GET /api/projects`

List projects. Scope depends on caller role:
- **NGO caller:** Returns all own projects (including drafts).
- **Volunteer caller:** Returns only upcoming/active/completed projects.

**Auth:** Required (any role)

**Query:** `?page=1&limit=20&status=active&category=education&search=youth&near_km=25`

Optional `near_km` (volunteer only): keep only projects within the given km of the volunteer's profile pin, sorted nearest-first. Ignored for NGO callers and when the volunteer profile has no coordinates. While active, each summary also carries `distance_km` (haversine km from the volunteer's pin; `null` otherwise).

**Response (200):** Paginated list of project summaries.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "ngo_id": "uuid",
      "ngo_name": "Education For All",
      "title": "After-School Tutoring",
      "description": "...",
      "category": "education",
      "required_skills": ["teaching"],
      "capacity": 20,
      "registered_count": 12,
      "whatsapp_group_url": "https://chat.whatsapp.com/example",
      "status": "active",
      "start_date": "2026-09-15",
      "end_date": "2026-12-15",
      "location_name": "Jeddah, Saudi Arabia",
      "distance_km": 12.3
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

---

### `GET /api/projects/:id`

Get full project details.

**Auth:** Required (any role). Drafts visible only to the owning NGO.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ngo_id": "uuid",
    "ngo_name": "Education For All",
    "title": "After-School Tutoring",
    "description": "Full description here...",
    "category": "education",
    "required_skills": ["teaching", "mentoring"],
    "responsibilities": ["Tutor students in math", "Prepare lesson plans"],
    "eligibility": { "min_age": 18, "custom_requirements": [] },
    "capacity": 20,
    "whatsapp_group_url": "https://chat.whatsapp.com/example",
    "registered_count": 12,
    "status": "active",
    "start_date": "2026-09-15",
    "end_date": "2026-12-15",
    "event_date": null,
    "location_name": "Jeddah, Saudi Arabia",
    "location_lat": 21.4858,
    "location_lng": 39.1925,
    "hours_per_session": 3,
    "created_at": "2026-09-01T00:00:00Z"
  }
}
```

---

### `POST /api/projects`

Create a new project (defaults to `draft` status).

**Auth:** Required — NGO only

**Request:**
```json
{
  "title": "After-School Tutoring",
  "description": "We need volunteers to tutor...",
  "category": "education",
  "required_skills": ["teaching", "mentoring"],
  "responsibilities": ["Tutor students", "Prepare materials"],
  "eligibility": { "min_age": 18 },
  "capacity": 20,
  "whatsapp_group_url": "https://chat.whatsapp.com/example",
  "start_date": "2026-09-15",
  "end_date": "2026-12-15",
  "location_name": "Jeddah, Saudi Arabia",
  "location_lat": 21.4858,
  "location_lng": 39.1925,
  "hours_per_session": 3
}
```

Required: `title`, `description`, `category`, `capacity`, `start_date`, `end_date`, `location_name`, `location_lat`, `location_lng`. `whatsapp_group_url` is optional. The project location is selected with the map pin and `location_name` must be `"City, Country"`.

**Response (201):**
```json
{ "success": true, "data": { "id": "uuid", "status": "draft" } }
```

---

### `PUT /api/projects/:id`

Update a project. Only the owning NGO can update. **Mutation guard:** only `draft` and `upcoming` projects can be edited — once a project is `active` (or past `upcoming`), any detail update is rejected with `400 VALIDATION_ERROR`.

**Auth:** Required — NGO only (must own the project)

**Request:** Same shape as POST, all fields optional (partial update).

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "status": "draft" } }
```

Triggers embedding regeneration if `description`, `required_skills`, `responsibilities`, or `category` changed.

---

### `DELETE /api/projects/:id`

Delete a draft project. Only draft projects can be deleted.

**Auth:** Required — NGO only (must own the project)

**Response (200):**
```json
{ "success": true, "data": { "message": "Project deleted" } }
```

---

### `POST /api/projects/:id/publish`

Transition project from `draft` → `upcoming` (the project becomes volunteer-visible as "Upcoming"). Triggers embedding generation.

**Auth:** Required — NGO only (must own the project)

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "status": "upcoming" } }
```

---

### `POST /api/projects/:id/activate`

Transition project from `upcoming` → `active`. Activating freezes the project's details (edits are rejected from this point on).

**Auth:** Required — NGO only (must own the project)

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "status": "active" } }
```

---

### `POST /api/projects/:id/complete`

Transition project from `active` → `completed`.

**Auth:** Required — NGO only (must own the project)

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "status": "completed" } }
```

---

### `POST /api/projects/:id/cancel`

Cancel a project (`upcoming` or `active` → `cancelled`). Cancels all confirmed registrations.

**Auth:** Required — NGO only (must own the project)

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "status": "cancelled" } }
```

---

## Registrations Module — `/api/registrations`

### `POST /api/registrations`

Register the authenticated volunteer for a project.

**Auth:** Required — Volunteer only

**Request:**
```json
{ "project_id": "uuid" }
```

**Server-side validation:**
1. Volunteer has completed onboarding
2. Project exists and status is `upcoming` or `active`
3. Project is not at capacity (confirmed registrations < capacity)
4. Volunteer is not already registered (duplicate check)
5. Volunteer meets eligibility criteria (age, custom requirements)
6. Volunteer is not already registered for a conflicting project (optional for MVP)

**Response (201):**
```json
{ "success": true, "data": { "id": "uuid", "status": "confirmed", "registered_at": "..." } }
```

**Error cases:**
- `409` — Already registered for this project
- `400` — Project at capacity, eligibility not met, onboarding incomplete
- `404` — Project not found

---

### `GET /api/registrations`

List registrations. Scope:
- **Volunteer caller:** Own registrations.
- **NGO caller:** Registrations for own projects.

**Auth:** Required

**Query:** `?page=1&limit=20&project_id=uuid&status=confirmed`

**Response (200):** Paginated list.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "volunteer_id": "uuid",
      "volunteer_name": "Jane Doe",
      "project_id": "uuid",
      "project_title": "After-School Tutoring",
      "status": "confirmed",
      "registered_at": "2026-09-10T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

---

### `GET /api/registrations/:id`

Get a single registration.

**Auth:** Required — Volunteer (own only) or NGO (own project only)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "volunteer_id": "uuid",
    "volunteer_name": "Jane Doe",
    "project_id": "uuid",
    "project_title": "After-School Tutoring",
    "status": "confirmed",
    "registered_at": "2026-09-10T10:00:00Z"
  }
}
```

---

### `PUT /api/registrations/:id/cancel`

Cancel a registration. Volunteer can cancel own; NGO can cancel for own projects.

**Auth:** Required — Volunteer (own only) or NGO (own project only)

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "status": "cancelled", "cancelled_at": "..." } }
```

---

## Attendance Module — `/api/attendance`

### `POST /api/attendance/events`

Create an attendance event with a QR token.

**Auth:** Required — NGO only (must own the project)

**Request:**
```json
{
  "project_id": "uuid",
  "event_name": "Day 1 Morning Session",
  "event_date": "2026-09-20",
  "window_start": "2026-09-20T08:00:00Z",
  "window_end": "2026-09-20T10:00:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "event_id": "uuid",
    "token": "abc123random",
    "event_name": "Day 1 Morning Session",
    "event_date": "2026-09-20",
    "window_start": "2026-09-20T08:00:00Z",
    "window_end": "2026-09-20T10:00:00Z"
  }
}
```

---

### `GET /api/attendance/events/:eventId/qr`

Get the QR code data for an attendance event.

**Auth:** Required — NGO only (must own the project)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "event_id": "uuid",
    "token": "abc123random",
    "qr_data": "qadam://attendance/550e8400-e29b-41d4-a716-446655440000/abc123random"
  }
}
```

The frontend renders this `qr_data` string as a QR code using the `qrcode` library. QR payload format is `qadam://attendance/{event_id}/{token}`.

---

### `GET /api/attendance/events`

List attendance events for a project.

**Auth:** Required — NGO only (must own the project)

**Query:** `?project_id=uuid`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "event_id": "uuid",
      "event_name": "Day 1 Morning Session",
      "event_date": "2026-09-20",
      "window_start": "...",
      "window_end": "...",
      "checked_in_count": 8
    }
  ]
}
```

---

### `POST /api/attendance/check-in`

Check in a volunteer by scanning a QR token.

**Auth:** Required — Volunteer only

**Request:**
```json
{ "event_id": "550e8400-e29b-41d4-a716-446655440000", "token": "abc123random" }
```

**Server-side validation:**
1. `event_id` + token identify an existing valid attendance event
2. Volunteer has a confirmed registration for this project
3. Event is active (current time is within `window_start` and `window_end`)
4. Volunteer has not already checked in for this event (duplicate check)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "attendance_id": "uuid",
    "event_id": "uuid",
    "check_in": "2026-09-20T08:05:00Z"
  }
}
```

**Error cases:**
- `409` — Already checked in for this event
- `400` — Invalid token, no registration, outside window, event not found

---

### `POST /api/attendance/check-out`

Check out a previously checked-in volunteer.

**Auth:** Required — Volunteer only

**Request:**
```json
{ "event_id": "550e8400-e29b-41d4-a716-446655440000", "token": "abc123random" }
```

**Server-side validation:**
1. Same as check-in validation
2. Volunteer has an existing check-in (without check-out) for this event
3. Volunteer has not already checked out (duplicate check)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "attendance_id": "uuid",
    "check_in": "2026-09-20T08:05:00Z",
    "check_out": "2026-09-20T11:02:00Z",
    "hours": 2.95
  }
}
```

`hours` is calculated as `(check_out - check_in)` in hours, rounded to 2 decimal places.

---

### `GET /api/attendance`

List attendance records.
- **Volunteer caller:** Own attendance records.
- **NGO caller:** Attendance for own projects.

**Auth:** Required

**Query:** `?page=1&limit=20&project_id=uuid&event_id=uuid`

**Response (200):** Paginated list.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "volunteer_id": "uuid",
      "volunteer_name": "Jane Doe",
      "project_id": "uuid",
      "event_id": "uuid",
      "event_name": "Day 1 Morning Session",
      "check_in": "2026-09-20T08:05:00Z",
      "check_out": "2026-09-20T11:02:00Z",
      "hours": 2.95
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
}
```

---

### `GET /api/attendance/history`

The authenticated volunteer's 10 most recent completed events, newest first — a read-only view over the existing `attendance` / `attendance_tokens` / `projects` / `ngos` data (no history table is maintained).

**Auth:** Required — Volunteer only

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "project_title": "After-School Tutoring",
      "ngo_name": "Education For All",
      "event_id": "uuid",
      "event_name": "Day 1 Morning Session",
      "event_date": "2026-09-20",
      "location_name": "Jeddah, Saudi Arabia",
      "check_in": "2026-09-20T08:05:00Z",
      "check_out": "2026-09-20T11:02:00Z",
      "hours": 2.95
    }
  ]
}
```

**Qualification:** An event appears only after it has finished (`window_end` in the past) AND the volunteer's attendance is complete (`check_out` set — verified hours). Upcoming, still-running, and unfinished (no check-out) sessions never appear. Attendance that was already verified stays in history even if the registration or project is later cancelled — attendance is the source of truth for participation.

---

### `GET /api/attendance/:attendanceId/certificate`

Generate and download a volunteer certificate PDF for a completed attendance record.

**Auth:** Required — Volunteer only (must own the attendance row)

**Response (200):** `application/pdf` binary body with:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="qadam-certificate-<project>-<event_date>.pdf"`
- `Cache-Control: no-store`

The PDF is generated on demand from authoritative PostgreSQL data (volunteer name, NGO name, project title, event date, verified hours). Certificate details supplied by the client are never trusted. PDFs and certificate records are **not** stored in PostgreSQL or Supabase Storage.

**Eligibility (server-enforced, same as history):**
1. Attendance row belongs to the authenticated volunteer
2. `check_out` is set (verified hours exist)
3. The associated event has finished (`window_end` in the past)

**Error cases:**
- `400` `ATTENDANCE_INCOMPLETE` — no check-out yet
- `400` `EVENT_NOT_FINISHED` — event window still open / in the future
- `403` — attendance belongs to another volunteer (or caller is not a volunteer)
- `404` — attendance or event not found

---

## Matching Module — `/api/matching`

### `GET /api/matching/volunteers/:projectId`

Get ranked volunteer matches for a project.

**Auth:** Required — NGO only (must own the project)

**Query:** `?limit=20`

**Scoring weights** (applied only to candidates that already passed deterministic filtering — status, capacity, eligibility): `distance 0.50` + `skills 0.30` + `embedding_similarity 0.20`. Distance is weighted highest per product requirement — nearby, "good enough" matches should generally outrank far-away semantically-perfect ones. `distance_score` is `1 / (1 + distance_km)` when a volunteer location is set, and is excluded (weight redistributed proportionally across the remaining factors) when either party has no coordinates.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "volunteer_id": "uuid",
      "volunteer_name": "Jane Doe",
      "composite_score": 0.82,
      "reasons": {
        "distance_km": 5.2,
        "distance_score": 0.16,
        "skills_match": { "score": 0.75, "matched": ["teaching", "mentoring"], "missing": ["design"] },
        "embedding_similarity": 0.85
      }
    }
  ]
}
```

---

### `GET /api/matching/projects`

Get ranked project recommendations for the authenticated volunteer.

**Auth:** Required — Volunteer only

**Query:** `?limit=20`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "project_id": "uuid",
      "project_title": "After-School Tutoring",
      "ngo_name": "Education For All",
      "composite_score": 0.78,
      "reasons": {
        "distance_km": 3.1,
        "distance_score": 0.24,
        "skills_match": { "score": 0.67, "matched": ["teaching"], "missing": ["mentoring"] },
        "embedding_similarity": 0.82
      }
    }
  ]
}
```

---

## AI Module — `/api/ai`

### `POST /api/ai/copilot/draft`

Generate a structured project draft from a natural-language brief. **Never writes to the database.** Returns a draft for the NGO to review and approve.

**Auth:** Required — NGO only

**Request:**
```json
{
  "brief": "I need 15 volunteers for a weekend beach cleanup event in Jeddah. Volunteers should be physically fit and care about the environment. The event includes trash collection and sorting."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "title": "Jeddah Beach Cleanup",
    "description": "Join us for a weekend beach cleanup initiative focused on...",
    "category": "environment",
    "required_skills": ["physical fitness", "teamwork"],
    "responsibilities": [
      "Collect and sort beach trash and debris",
      "Work in teams to cover assigned beach sections",
      "Record collected items for environmental impact tracking"
    ],
    "eligibility": {
      "min_age": 16,
      "custom_requirements": ["Must be physically fit for outdoor manual labor"]
    },
    "capacity": 15
  }
}
```

The response is Zod-validated. If Gemini returns malformed or unparseable output, the endpoint returns a `502` with a user-friendly error.

**Error cases:**
- `400` — Missing or empty brief
- `502` — AI provider error (timeout, malformed response, rate limit)

---

### `POST /api/ai/assistant/chat`

Global Knowledge Assistant — a single read/answer-only endpoint for the floating chat widget. Behavior differs based on the caller's role (resolved server-side).

**Auth:** Required (any authenticated role)

**Request:**
```json
{
  "message": "What projects are available in Jeddah this month?"
}
```

**Server-side behavior:**
- **NGO caller:** Grounds the response in that NGO's uploaded knowledge documents (RAG) and their own verified impact metrics. Uses `rag.service.ts` for knowledge retrieval and a lightweight metrics summary path.
- **Volunteer caller:** Answers general platform questions using public project and NGO data. No RAG grounding (volunteers don't have knowledge bases).
- **Never** creates, edits, or publishes anything.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "answer": "There are 3 active projects in Jeddah this month:\n1. After-School Tutoring by Education For All...\n2. Beach Cleanup by Green Initiative...\n3. Food Drive by Community Care...",
    "sources": [
      { "type": "knowledge_chunk", "document_name": "Q4 Programs.pdf", "chunk_index": 3 },
      { "type": "project", "project_id": "uuid", "project_title": "After-School Tutoring" }
    ]
  }
}
```

`sources` is included when the answer is grounded in retrieved documents or specific project data. May be empty for general platform questions.

**Error cases:**
- `400` — Missing or empty message
- `502` — AI provider error (graceful fallback: "I'm unable to answer right now. Please try again.")

---

## Knowledge Module — `/api/knowledge`

### `POST /api/knowledge/documents`

Upload a document for RAG processing.

**Auth:** Required — NGO only

**Request:** `multipart/form-data`
- `file`: The document file (PDF, TXT, DOCX — max 10 MB)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "file_name": "Q4 Programs.pdf",
    "file_type": "application/pdf",
    "file_size": 245000,
    "status": "uploaded"
  }
}
```

The ingestion pipeline (text extraction → chunking → embedding → pgvector) runs asynchronously after upload. The document transitions: `uploaded` → `processing` → `ready` (or `failed`).

---

### `GET /api/knowledge/documents`

List all documents for the authenticated NGO.

**Auth:** Required — NGO only

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "file_name": "Q4 Programs.pdf",
      "file_type": "application/pdf",
      "file_size": 245000,
      "status": "ready",
      "chunk_count": 12,
      "created_at": "2026-09-01T00:00:00Z"
    }
  ]
}
```

---

### `DELETE /api/knowledge/documents/:id`

Delete a document and all its chunks.

**Auth:** Required — NGO only (must own the document)

**Response (200):**
```json
{ "success": true, "data": { "message": "Document deleted" } }
```

---

## Geocoding Module — `/api/geocoding`

Location support for the map pickers. Reverse geocoding (pin → `"City, Country"`) is not a standalone endpoint: it happens implicitly when a volunteer profile or project is saved with a pin, server-side via BigDataCloud (Nominatim fallback). This module only exposes forward geocoding (place search) used by the location search box.

### `GET /api/geocoding/search`

Search for places by free text. Used by the location pickers so users can search a place, select a result (map centers + pin updates), then optionally fine-tune the pin before saving.

**Auth:** Required (any role — both volunteers and NGOs pick locations)

**Query:** `?q=karachi` (2–100 chars after trim)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "label": "Karachi, Karachi District, Sindh, Pakistan",
      "lat": 24.8607,
      "lng": 67.0011
    }
  ]
}
```

Suggestions are display-only hints — the selected coordinates become the pin, and `location_name` is still resolved server-side from the final pin on save. Provider failure returns `200` with an empty `data` array (graceful degradation to manual pin-dropping), never a 5xx.

**Error cases:**
- `400` — Missing, too short, or too long `q`

---

## Impact Module — `/api/impact`

### `GET /api/impact/volunteer`

Get the authenticated volunteer's personal impact metrics.

**Auth:** Required — Volunteer only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_hours": 48.5,
    "total_projects": 5,
    "total_events_attended": 12,
    "causes": [
      { "category": "education", "hours": 30.0, "projects": 3 },
      { "category": "environment", "hours": 18.5, "projects": 2 }
    ],
    "recent_activity": [
      { "project_title": "After-School Tutoring", "date": "2026-09-20", "hours": 3.0 }
    ]
  }
}
```

**Calculation:** Aggregated from `attendance` records where `check_out IS NOT NULL` and `hours > 0`.

---

### `GET /api/impact/ngo`

Get the authenticated NGO's verified impact metrics.

**Auth:** Required — NGO only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_hours": 1250.0,
    "total_volunteers": 85,
    "total_projects": 8,
    "active_projects": 2,
    "completed_projects": 5,
    "attendance_rate": 0.7647,
    "by_cause": [
      { "category": "education", "projects": 4, "volunteers": 50, "hours": 800.5 },
      { "category": "environment", "projects": 4, "volunteers": 35, "hours": 449.5 }
    ],
    "by_location": [
      { "location": "Jeddah, Saudi Arabia", "projects": 5, "volunteers": 60, "hours": 900.0 },
      { "location": "Riyadh, Saudi Arabia", "projects": 3, "volunteers": 25, "hours": 350.0 }
    ],
    "by_month": [
      { "month": "2026-07", "hours": 120.0 },
      { "month": "2026-08", "hours": 210.0 },
      { "month": "2026-09", "hours": 180.0 }
    ]
  }
}
```

**Calculation:** All metrics are aggregated in a single PostgreSQL round trip by the `ngo_impact_metrics` function (migration 013) over the `projects` / `registrations` / `attendance` rows owned by the authenticated NGO — no metrics table, no AI. `total_hours` counts only verified (check-out completed) hours; attendance is the source of truth for participation and survives later registration/project cancellation. `total_volunteers` is distinct volunteers with a confirmed registration on the NGO's projects, and `attendance_rate` is the share of those volunteers with at least one check-in (0 when nobody is registered; hours per cause/location/month are rounded to 2 decimals and sorted by hours descending, months chronological). No new indexes are required — the aggregation uses `idx_projects_ngo_id`, `idx_registrations_project_id`, and `idx_attendance_project_id`.

---