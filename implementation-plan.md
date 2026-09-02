# Implementation Plan

## Overview

The implementation is organized into 8 ordered phases. Each phase builds on the previous one and produces a testable increment. The plan follows the current Qadam architecture:

* React + Vite + TypeScript frontend
* Node.js + TypeScript + Express modular monolith
* Clerk for authentication
* Supabase PostgreSQL + pgvector + Storage
* Hugging Face Inference API for embeddings
* Gemini free-tier models as the primary LLM
* Alibaba Cloud DashScope Qwen models as the automatic LLM fallback
* MapLibre GL + OpenFreeMap for map display and pin selection
* BigDataCloud reverse geocoding for `"City, Country"` location names
* REST APIs between frontend and backend

The backend follows a conventional centralized layered structure:

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── services/
│   │   └── ai/
│   ├── routes/
│   ├── middleware/
│   ├── validators/
│   ├── types/
│   ├── utils/
│   ├── lib/
│   ├── app.ts
│   └── server.ts
├── tests/
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

Backend request flow:

```text
Route
  ↓
Middleware
  ↓
Validator
  ↓
Controller
  ↓
Service
  ↓
Database / External API
```

Features not listed in a phase are explicitly excluded from that phase.

---

# Phase 1: Project Scaffolding & Infrastructure

**Scope:** Initialize the monorepo, configure frontend/backend tooling, establish Supabase, Clerk integration foundations, shared patterns, and external-service configuration.

### Deliverables

**Frontend**

* Initialize Vite + React + TypeScript project (`frontend/`)
* Configure React Router
* Configure Tailwind CSS + shadcn/ui
* Configure TypeScript strict mode
* Create base application shell structure
* Create frontend `.env.example` containing only public configuration

**Backend**

* Initialize Node.js + TypeScript + Express project (`backend/`)
* Configure TypeScript strict mode
* Establish the centralized backend structure:

  * `config/`
  * `controllers/`
  * `services/`
  * `services/ai/`
  * `routes/`
  * `middleware/`
  * `validators/`
  * `types/`
  * `utils/`
  * `lib/`
* Create `app.ts` and `server.ts`
* Create global error handling middleware (`error.middleware.ts`)
* Create Zod validation middleware (`validate.middleware.ts`)
* Create shared response helpers and typed error classes
* Configure CORS
* Create backend `.env.example`

**Database / infrastructure**

* Initialize Supabase project
* Enable `pgvector`
* Create backend-only Supabase service-role client (`lib/supabase.ts`)
* Do not create or use Supabase Auth
* Configure Clerk application
* Configure Clerk backend verification
* Configure Clerk webhook secret for `user.created`
* Configure Gemini, Qwen/DashScope, Hugging Face, and BigDataCloud environment variables
* Configure MapLibre/OpenFreeMap usage on the frontend

**Verification**

* `GET /api/health` returns successfully
* Frontend starts successfully
* Backend starts successfully
* Environment validation fails clearly when required backend secrets are missing
* Clerk frontend and backend configuration can be initialized without exposing secrets

### Not in this phase

* No application feature implementation
* No application database tables
* No profile forms
* No projects
* No registrations
* No attendance
* No AI feature implementation

---

# Phase 2: Clerk Authentication & User Resolution

**Scope:** Implement authentication using Clerk and establish the server-side identity/role resolution flow.

Clerk owns sign-up, sign-in, sign-out, and session management. The Express backend does not implement its own password authentication, JWT issuance, refresh-token flow, or Supabase Auth.

### Deliverables

**Frontend**

* Add `<ClerkProvider>`
* Configure Clerk authentication
* Use Clerk's `SignIn` / `SignUp` components or equivalent Clerk-supported flows
* Create `AuthProvider` / authentication wrapper only where application-specific state is needed
* Create `useAuth` integration
* Configure protected route handling
* Implement role-aware redirects
* Redirect authenticated users with incomplete profiles to the appropriate onboarding page

**Backend**

* Configure Clerk session-token verification using Clerk's official backend SDK/middleware
* Create `auth.middleware.ts`

  * Verify the Clerk session
  * Extract Clerk user ID from the verified session
  * Attach authenticated identity to the request
* Create `resolveUser.middleware.ts`

  * Resolve the Clerk user to the corresponding Volunteer or NGO profile
  * Attach role and profile information to the request
* Create any required request identity types under `types/`
* Implement `GET /api/auth/me`

  * Return authenticated Clerk user identity
  * Return role
  * Return profile
  * Return onboarding status
* Implement Clerk webhook handling:

  * `user.created` → create the appropriate application profile after role is established
* Store Clerk user IDs as `TEXT` in application profile tables
* Store role in Clerk metadata and keep application authorization checks server-side

**Backend structure for this phase**

```text
backend/src/
├── controllers/
│   └── auth.controller.ts
├── services/
│   └── auth.service.ts
├── routes/
│   └── auth.routes.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── resolveUser.middleware.ts
│   └── error.middleware.ts
├── validators/
│   └── auth.validator.ts
├── types/
│   └── auth.types.ts
└── lib/
    └── clerk.ts
```

**Authorization pipeline**

Every protected request follows:

```text
Clerk session token
    ↓
Authenticate
    ↓
Resolve Clerk user ID
    ↓
Resolve Volunteer/NGO profile
    ↓
Check role / ownership
    ↓
Validate request with Zod
    ↓
Controller
    ↓
Service
    ↓
Execute operation
```

### Not in this phase

* No Supabase Auth
* No custom password hashing
* No custom JWT issuance
* No refresh-token endpoint
* No authentication tables owned by Supabase Auth
* No profile onboarding forms beyond the auth-to-onboarding redirect

---

# Phase 3: Volunteer & NGO Onboarding

**Scope:** Implement application profiles, onboarding completion, volunteer location pinning, and NGO organization information.

### Deliverables

**Database migrations**

* `volunteers` table
* `ngos` table
* Appropriate indexes, constraints, and RLS/default-deny protection
* `auth_user_id TEXT` linked logically to Clerk identity
* Volunteer fields include:

  * `full_name`
  * `age`
  * `skills`
  * `interests`
  * `experience`
  * `location_name`
  * `location_lat`
  * `location_lng`
  * `onboarding_complete`
  * No `gender` field on the volunteer profile — a gender-based project restriction, if ever needed, is expressed as free text in a project's `eligibility.custom_requirements` (Phase 4), not stored on the volunteer.
* NGO fields include:

  * organization details
  * `logo_url`
  * `categories`
  * `onboarding_complete`
* No NGO profile location fields

**Backend**

Use the centralized structure:

```text
backend/src/
├── controllers/
│   ├── volunteer.controller.ts
│   └── ngo.controller.ts
├── services/
│   ├── volunteer.service.ts
│   └── ngo.service.ts
├── routes/
│   ├── volunteer.routes.ts
│   └── ngo.routes.ts
├── validators/
│   ├── volunteer.validator.ts
│   └── ngo.validator.ts
└── types/
    ├── volunteer.types.ts
    └── ngo.types.ts
```

**Volunteer backend**

* `GET /api/volunteers/profile`
* `POST /api/volunteers/profile`
* `PUT /api/volunteers/profile`
* Zod validation
* Ownership authorization

**NGO backend**

* `GET /api/ngos/profile`
* `POST /api/ngos/profile`
* `PUT /api/ngos/profile`
* `GET /api/ngos`
* `GET /api/ngos/:id`
* Zod validation
* Ownership authorization where applicable

**Volunteer location flow**

* Frontend provides a MapLibre map with OpenFreeMap tiles
* Volunteer selects an exact profile location pin
* Browser geolocation may be used as an optional starting point
* Volunteer can manually move the pin before saving
* Frontend sends exact `location_lat` and `location_lng`
* Backend reverse-geocodes the coordinates using BigDataCloud
* Backend stores:

  * exact latitude
  * exact longitude
  * human-readable `"City, Country"` `location_name`
* Exact coordinates remain authoritative for distance calculations
* `location_name` is a display label, not the source of geographic distance

**Embedding lifecycle**

* No embeddings are generated yet; Phase 5 handles embedding generation after profile/project data exists

**Frontend**

* `VolunteerOnboardingPage`

  * personal information
  * skills/interests
  * experience
  * exact map location
  * review
* `VolunteerProfilePage`

  * edit profile
  * update location pin
* `NgoOnboardingPage`

  * organization details
  * logo upload
* `NgoProfilePage`

  * edit organization details
  * update logo
* Shared skills/interests and location-picker components

### Important location rule

NGOs do **not** set an organization profile location.

A location is required when an NGO creates a project. The project location is handled in Phase 4.

### Not in this phase

* No project creation
* No registrations
* No matching
* No attendance
* No AI generation
* No availability data or availability selector
* No embedding generation

---

# Phase 4: Project Creation & Management

**Scope:** Implement project creation, management, publishing, status transitions, and project location pinning.

### Deliverables

**Database migrations**

* `projects` table
* Indexes
* Foreign keys
* Check constraints
* RLS/default-deny protection

Project fields include, as applicable:

* `ngo_id`
* `title`
* `category`
* `description`
* `required_skills`
* `responsibilities`
* `eligibility`
* `capacity`
* `status`
* `location_name`
* `location_lat`
* `location_lng`
* optional `whatsapp_group_url`
* timestamps

Do not add a `date_of_birth` field or a volunteer/NGO availability field.

**Backend**

Follow:

```text
project.routes.ts
      ↓
project.controller.ts
      ↓
project.service.ts
```

Endpoints:

* `GET /api/projects`
* `GET /api/projects/:id`
* `POST /api/projects`
* `PUT /api/projects/:id`
* `DELETE /api/projects/:id` — draft only
* `POST /api/projects/:id/publish`
* `POST /api/projects/:id/activate`
* `POST /api/projects/:id/complete`
* `POST /api/projects/:id/cancel`
* Status transition validation
* Zod validation
* Ownership authorization

Backend files:

```text
backend/src/
├── controllers/
│   └── project.controller.ts
├── services/
│   └── project.service.ts
├── routes/
│   └── project.routes.ts
├── validators/
│   └── project.validator.ts
└── types/
    └── project.types.ts
```

**Project location flow**

* NGO selects the exact project location on a MapLibre map
* NGO can manually adjust the pin
* Frontend sends exact coordinates
* Backend reverse-geocodes the coordinates through BigDataCloud
* Store:

  * `location_lat`
  * `location_lng`
  * `"City, Country"` `location_name`
* The exact coordinates are used later for distance matching
* After publication, volunteers and NGOs can see the project pin and location on the project detail map

**Frontend**

* `NgoDashboardPage`
* `NgoProjectsPage`
* `CreateProjectPage`
* `EditProjectPage`
* `ProjectDetailPage`
* `ProjectsPage`
* `ProjectCard`
* `ProjectFilters`
* `HomePage`
* Reusable `LocationPicker`
* Project detail map displaying the exact project pin

The Project Copilot is intentionally not implemented here; it is added in Phase 7.

### Not in this phase

* No registrations
* No attendance
* No matching
* No embeddings
* No Copilot implementation
* No RAG
* No impact dashboards

---

# Phase 5: Registration & Hybrid Matching

**Scope:** Implement volunteer registration and the hybrid matching pipeline using deterministic eligibility, skills/interests, exact geographic distance, and semantic embedding similarity.

### Deliverables

**Database migrations**

* `registrations`
* `volunteer_embeddings`
* `project_embeddings`
* Appropriate unique constraints, indexes, pgvector indexes, and RLS/default-deny protection

**Registration backend**

Follow:

```text
registration.routes.ts
        ↓
registration.controller.ts
        ↓
registration.service.ts
```

Endpoints:

* `POST /api/registrations`

  * authenticated volunteer only
  * onboarding check
  * eligibility validation
  * capacity validation
  * duplicate-registration validation
* `GET /api/registrations`
* `GET /api/registrations/:id`
* `PUT /api/registrations/:id/cancel`
* Zod validation

**Matching backend**

Follow:

```text
matching.routes.ts
        ↓
matching.controller.ts
        ↓
matching.service.ts
```

* `GET /api/matching/volunteers/:projectId`
* `GET /api/matching/projects`
* Deterministic filtering
* Multi-factor scoring
* Ranking
* Per-factor explanations

### Matching order

```text
1. Load project and candidate volunteers
2. Apply hard constraints
3. Calculate geographic distance
4. Calculate skills score
5. Calculate interests score
6. Calculate embedding similarity
7. Calculate weighted composite score
8. Rank candidates
9. Return top-N + score breakdown + explanations
```

### Matching weights

Distance has the highest individual weight:

| Factor               |   Weight |
| -------------------- | -------: |
| Distance             |     0.35 |
| Skills               |     0.30 |
| Embedding similarity |     0.20 |
| Interests            |     0.15 |
| **Total**            | **1.00** |

Distance is calculated using the volunteer's exact profile coordinates and the project's exact coordinates.

Example:

```text
distance_score =
  max(0, 1 - distance_km / DISTANCE_MAX_KM)
```

The exact maximum distance is a configurable application constant.

### Embedding rules

**Volunteer embedding input**

```text
skills + interests + experience
```

**Project embedding input**

```text
title + category + description + required_skills + responsibilities
```

Embeddings must **not** contain:

* location
* coordinates
* location name
* registration state
* availability
* capacity
* other dynamic eligibility/filter fields

Distance and deterministic rules remain outside the embedding model.

### Embedding service

`backend/src/services/ai/embedding.service.ts`

Responsibilities:

* Call Hugging Face Inference API
* Generate `vector(384)` embeddings
* Batch embedding generation where appropriate
* Handle timeout/rate-limit/network failures
* Reuse stored embeddings
* Detect content changes using hashes

Lifecycle:

* Generate volunteer embedding when relevant profile content changes
* Generate project embedding when relevant project content changes
* Regenerate only when embedding input content changes
* Do not generate embeddings on page load

### Frontend

* Registration button on `ProjectDetailPage`
* `VolunteerProjectsPage`

  * recommended projects
  * registered projects
* `VolunteerRegistrationsPage`
* `MatchingPage`
* `MatchCard`
* Distance display and score breakdown
* Project map/pin display on project detail pages

### Not in this phase

* No attendance
* No Copilot
* No RAG
* No impact dashboards
* No availability matching or availability fields

---

# Phase 6: QR Attendance

**Scope:** Implement project event/session attendance using event-specific QR tokens and verified check-in/check-out records.

### Deliverables

**Database migrations**

* `attendance_tokens`
* `attendance`
* Unique constraints
* Check constraints
* Indexes
* RLS/default-deny protection

### QR payload

The QR payload must include both the event ID and token:

```text
qadam://attendance/{event_id}/{token}
```

The event ID is a lookup hint and must still be validated server-side.

### Backend

Follow:

```text
attendance.routes.ts
        ↓
attendance.controller.ts
        ↓
attendance.service.ts
```

Endpoints:

* `POST /api/attendance/events`

  * NGO/project owner only
  * create event/session
  * create token
* `GET /api/attendance/events`
* `GET /api/attendance/events/:eventId/qr`
* `POST /api/attendance/check-in`
* `POST /api/attendance/check-out`
* `GET /api/attendance`

Server-side validation includes:

* authenticated Clerk user
* valid volunteer registration
* project/event ownership where applicable
* event existence and status
* event ID + token match
* token validity
* attendance window
* duplicate check-in prevention
* duplicate check-out prevention
* existing check-in before check-out

Attendance remains the source of truth for verified volunteer participation and hours.

### Frontend

* `AttendanceManagementPage`
* `CreateEventForm`
* `QRCodeDisplay`
* `QRScannerPage`
* `ScanResult`

Use:

* `qrcode` for QR generation
* `html5-qrcode` for browser scanning

### Not in this phase

* No impact dashboards
* No AI features
* No matching changes
* No registration logic changes

---

# Phase 7: AI Features — Copilot + Global Knowledge Assistant

**Scope:** Implement the two distinct AI surfaces and the NGO knowledge RAG pipeline.

The two surfaces must remain separate:

1. **Project Copilot** — only on project creation/editing pages
2. **Global Knowledge Assistant** — floating chat available to authenticated Volunteers and NGOs

### LLM provider architecture

Gemini free-tier models are the primary LLM provider.

Qwen through Alibaba Cloud DashScope is the automatic fallback.

```text
copilot.service.ts ─┐
                    ├──► llm.service.ts
rag.service.ts ─────┘          │
                               ├── Gemini first
                               │
                               └── Qwen fallback
```

AI services are located under:

```text
backend/src/services/ai/
├── llm.service.ts
├── gemini.service.ts
├── qwen.service.ts
├── embedding.service.ts
├── copilot.service.ts
└── rag.service.ts
```

Implement:

* `gemini.service.ts`
* `qwen.service.ts`
* `llm.service.ts`

Both provider services implement the same internal interface.

`llm.service.ts`:

* tries Gemini first
* falls back to Qwen when Gemini times out, errors, or is rate-limited
* logs the provider used
* hides provider-specific details from callers

The rest of the application must never call Gemini or Qwen directly.

### Copilot

**Backend**

* `copilot.service.ts`
* `POST /api/ai/copilot/draft`
* NGO authorization
* Structured-output prompt
* `CopilotDraftSchema`
* Zod validation
* Return draft only
* Never write the AI result directly to the database

Draft may contain:

* title
* description
* category
* required skills
* responsibilities
* eligibility
* capacity

The NGO must review/edit the draft and explicitly submit the project through the normal project creation API.

**Frontend**

* `CopilotPanel`
* Inline panel/drawer on:

  * `/ngo/projects/new`
  * `/ngo/projects/:id/edit`
* Brief input
* Generate button
* Loading state
* Draft preview
* `Apply to Form`

### Global Knowledge Assistant

**Frontend**

* `FloatingAssistant`
* fixed bottom-right chat icon
* mounted once in `ProtectedLayout`
* visible to both roles
* popup/side-panel chat
* does not navigate away from the current page

**Backend**

* `POST /api/ai/assistant/chat`

Volunteer caller:

* general platform questions
* public NGO/project information

NGO caller:

* NGO's own uploaded knowledge base through RAG
* own verified impact information where applicable

Role and identity are resolved server-side.

### RAG database

**Database migrations**

* `knowledge_documents`
* `knowledge_chunks`
* `vector(384)` embeddings
* pgvector index
* RLS/default-deny protection

### RAG ingestion

Pipeline:

```text
Upload
  ↓
Supabase Storage
  ↓
Text extraction
  ↓
Chunking
  ↓
Hugging Face embedding
  ↓
pgvector
  ↓
Ready
```

Supported formats:

* PDF via `pdf-parse`
* DOCX via `mammoth`
* TXT natively

MVP bounds:

* maximum 10 MB per document
* maximum 200 chunks per document
* approximately 500-token chunks
* approximately 50-token overlap

Document status:

* `uploaded`
* `processing`
* `ready`
* `failed`

### RAG query

```text
Question
  ↓
Authenticate + resolve NGO
  ↓
Embed question with HF
  ↓
pgvector similarity search within that NGO's documents
  ↓
Retrieve top-K chunks
  ↓
Build grounded prompt
  ↓
Gemini
  ↓
Qwen fallback if required
  ↓
Return answer + sources
```

If retrieved context is insufficient, return a clear "not enough information" response rather than inventing an answer.

### Frontend

* `KnowledgePage`
* `DocumentUpload`
* document list/status/delete
* `CopilotPanel`
* `FloatingAssistant`
* chat message list
* source reference display
* loading/error states

### Not in this phase

* No impact dashboard implementation
* No third AI surface
* No merging Copilot and Knowledge Assistant
* No direct provider calls from routes/controllers
* No AI source of truth for registration, capacity, attendance, authorization, identity, or eligibility

---

# Phase 8: Impact Dashboards & Final Polish

**Scope:** Implement verified impact reporting and final UX/accessibility polish.

### Backend

**Impact endpoints**

* `GET /api/impact/volunteer`
* `GET /api/impact/ngo`
* `POST /api/impact/ngo/narrative`

Metrics are calculated from authoritative application data:

* `attendance`
* `registrations`
* `projects`

Volunteer metrics:

* verified hours
* completed projects
* causes/categories
* recent activity

NGO metrics:

* verified volunteer hours
* volunteers
* projects
* categories
* monthly trends
* top volunteers

AI narrative generation:

* Use `llm.service.ts`
* Gemini first, Qwen fallback
* Generate from verified metrics only
* Never allow the LLM to invent metric values

### Frontend

* `VolunteerImpactPage`
* `NgoImpactPage`
* `NarrativePanel`
* Recharts:

  * `BarChart`
  * `PieChart`
  * `LineChart`

### Polish

* Consistent loading states
* Consistent error states
* Retry buttons
* Helpful empty states
* Responsive/mobile fixes
* Accessibility:

  * ARIA labels
  * keyboard navigation
  * focus management
* Navigation polish
* Active route states
* Breadcrumbs where useful
* Project/NGO map displays verified and stored coordinates

### Not in this phase

* No new major features
* No architecture changes
* No premature scalability infrastructure
* No replacement of authoritative database calculations with AI

---

# Dependency Graph

```text
                         ┌──────────────────────────────┐
                         │ Phase 1: Scaffolding          │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │ Phase 2: Clerk Auth           │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │ Phase 3: Profiles & Location  │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │ Phase 4: Projects             │
                         └──────────────┬───────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
          ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
          │ Phase 5:         │ │ Phase 6:         │ │ Phase 7:         │
          │ Registration &   │ │ QR Attendance    │ │ AI Copilot +     │
          │ Matching         │ │                  │ │ RAG Assistant    │
          └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
                   │                   │                    │
                   └───────────────────┼────────────────────┘
                                       ▼
                         ┌──────────────────────────────┐
                         │ Phase 8: Impact & Polish      │
                         └──────────────────────────────┘
```

### Dependency details

* Phase 2 depends on Phase 1.
* Phase 3 depends on Phase 2.
* Phase 4 depends on Phase 3.
* Phase 5 depends on Phases 3 and 4 because matching requires volunteer and project data.
* Phase 6 depends on Phases 4 and 5 because attendance requires published projects and valid volunteer registrations.
* Phase 7 depends on Phases 3 and 4 for role-aware AI, project Copilot, and NGO knowledge ownership. It can be developed in parallel with Phases 5 and 6 once those foundations exist.
* Phase 8 depends on Phases 5 and 6 for authoritative registration and attendance data, and on Phase 7 for the AI narrative path.

---

# Estimated Effort — Hackathon Context

| Phase     |          Effort | Priority |
| --------- | --------------: | -------- |
| 1         |       2–3 hours | Critical |
| 2         |       2–3 hours | Critical |
| 3         |       4–5 hours | Critical |
| 4         |       5–6 hours | Critical |
| 5         |       6–8 hours | Critical |
| 6         |       4–5 hours | Critical |
| 7         |       7–9 hours | High     |
| 8         |       4–5 hours | Medium   |
| **Total** | **34–44 hours** |          |

For a 3–4 person hackathon team, parallel development is possible after the shared foundation is stable.

Recommended parallelization:

```text
Developer A

Phase 3 → Phase 4 → Projects / NGO flows


Developer B

Phase 3 → Phase 5 → Registration + Matching


Developer C

Phase 2 → Shared backend foundation
              ↘ Phase 6 → Attendance
              ↘ Phase 7 → AI


Developer D (if available)

Frontend shell → shared components → maps → dashboards → integration/testing
```

The team should prioritize a complete end-to-end core flow over implementing every optional polish item:

```text
Clerk Auth

   ↓

Volunteer/NGO Onboarding

   ↓

NGO Project Creation + Location Pin

   ↓

Volunteer Project Discovery

   ↓

Registration

   ↓

Hybrid Matching

   ↓

QR Attendance

   ↓

Impact Metrics

Then add:

   ├── Project Copilot
   └── Global Knowledge Assistant / RAG
```

---

# Implementation Rules

The implementation must remain aligned with the architecture and API/database contracts.

1. Clerk is the authentication provider.

2. Supabase PostgreSQL is the application database and source of truth.

3. The frontend communicates with the backend through REST APIs; it does not directly access application data.

4. All protected requests authenticate and authorize server-side.

5. Use Zod for API input and AI structured-output validation.

6. Store volunteer and project exact coordinates and a cached `"City, Country"` display name.

7. Use MapLibre + OpenFreeMap for map UI.

8. Use BigDataCloud for reverse geocoding.

9. Do not introduce availability fields or availability-based matching.

10. Embedding inputs must never contain location or dynamic eligibility/filter data.

11. Distance must have the highest matching weight at `0.35`.

12. Gemini is the primary LLM provider; Qwen/DashScope is the fallback.

13. Keep LLM providers behind `llm.service.ts`.

14. Hugging Face is called through its API; do not run embedding models inside the Node.js server.

15. QR payloads must include both `event_id` and token.

16. NGO `logo_url` belongs to the NGO profile.

17. Project `whatsapp_group_url` is optional.

18. AI never becomes the source of truth for core application data.

19. Reuse stored embeddings and avoid unnecessary external API calls.

20. Do not introduce microservices, Kafka, Redis, Pinecone, Qdrant, Elasticsearch, or other infrastructure unless explicitly required.

21. Keep the MVP simple, testable, deployable, and understandable by a small hackathon team.

22. Backend code must follow the centralized structure:

    * Routes define endpoints.
    * Middleware handles authentication, identity resolution, authorization-related request context, and common request processing.
    * Validators handle Zod request validation.
    * Controllers remain thin and translate HTTP requests/responses.
    * Services contain business logic and external-service integration.
    * AI services are located under `services/ai/`.
    * Shared utilities belong under `utils/` and reusable integrations under `lib/`.

23. Do not introduce `modules/`, per-domain repository layers, use-case layers, dependency-injection frameworks, or unnecessary abstractions unless a concrete requirement emerges.

24. Controllers and routes must never call Gemini, Qwen, Hugging Face, BigDataCloud, or other external providers directly. Those integrations belong in the appropriate service layer.

25. Reuse existing services and utilities rather than duplicating business logic across controllers or routes.
