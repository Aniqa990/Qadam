# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                    React Client (Vite)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Volunteer    │  │  NGO         │  │  App Shell    │  │
│  │  Routes       │  │  Routes      │  │  (Auth +      │  │
│  │               │  │              │  │   Floating    │  │
│  │               │  │              │  │   Assistant)  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         └────────────┬────┘──────────────────┘           │
│                      │ fetch / REST                      │
└──────────────────────┼───────────────────────────────────┘
                       │ HTTP + JWT
┌──────────────────────┼───────────────────────────────────┐
│                 Express Server                            │
│  ┌───────────────────┴───────────────────────────────┐   │
│  │  Middleware: CORS → JSON → Auth → Resolve User     │   │
│  └───────────────────┬───────────────────────────────┘   │
│         ┌────────────┼────────────────┐                  │
│  ┌──────┴───┐ ┌──────┴───┐ ┌─────────┴──┐ ┌──────────┐ │
│  │ auth/    │ │volunteers│ │ projects/  │ │ ai/      │ │
│  │          │ │ ngos/    │ │registrat.  │ │knowledge/│ │
│  │          │ │          │ │attendance/ │ │matching/ │ │
│  └──────┬───┘ └──────┬───┘ └─────────┬──┘ └────┬─────┘ │
│         └─────────────┼───────────────┘──────────┘      │
│                       │                                   │
│  ┌────────────────────┴───────────────────────────────┐  │
│  │  lib/ — Supabase clients, HF client, shared utils  │  │
│  └────────────────────┬───────────────────────────────┘  │
└───────────────────────┼──────────────────────────────────┘
                        │
    ┌───────────────────┼──────────────────────┐
    │     Supabase       │                      │
    │  ┌─────────┐ ┌────┴─────┐ ┌───────────┐ │
    │  │  Auth   │ │PostgreSQL│ │  Storage   │ │
    │  │  (JWT)  │ │+pgvector │ │(Documents) │ │
    │  └─────────┘ └──────────┘ └───────────┘ │
    └──────────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────┴────┐   ┌─────┴─────┐       │
    │ Gemini  │   │ Hugging   │       │
    │ API     │   │ Face API  │       │
    │ (LLM)   │   │(Embeddings)│       │
    └─────────┘   └───────────┘       │
```

## Technology Stack

| Layer     | Technology                                            |
|-----------|-------------------------------------------------------|
| Frontend  | React, TypeScript, Vite, React Router, Tailwind, shadcn/ui, Recharts |
| Backend   | Node.js, TypeScript, Express                          |
| Database  | Supabase PostgreSQL, pgvector extension               |
| Auth      | Clerk (session tokens)                                 |
| Storage   | Supabase Storage (RAG documents, logos)               |
| LLM       | Gemini API (text generation, summarization)           |
| Embeddings| Hugging Face Inference API (HTTP, never local model)  |
| Validation| Zod (API inputs and AI outputs)                       |
| QR        | `qrcode` (generation), `html5-qrcode` (scanning)      |
| Charts    | Recharts                                              |

## Module Boundaries

### Backend Modules

Each module lives in `backend/src/modules/<name>/` and contains its own routes, controllers, services, validation schemas, and types.

| Module          | Responsibility                                         |
|-----------------|--------------------------------------------------------|
| `auth/`         | Clerk token verification, role resolution from Clerk metadata, user resolution |
| `volunteers/`   | Volunteer profile CRUD, skills, interests, availability, location |
| `ngos/`         | NGO organization profile CRUD, NGO user management     |
| `projects/`     | Project CRUD, lifecycle management (draft → published → active → completed / cancelled) |
| `registrations/`| Volunteer sign-up for projects, capacity enforcement, duplicate checks, eligibility validation |
| `attendance/`   | QR token generation, check-in/check-out validation, verified hours calculation |
| `matching/`     | Hybrid matching pipeline: deterministic filtering + multi-factor scoring + embedding similarity |
| `ai/`           | AI service abstractions: `gemini.service.ts`, `embedding.service.ts`, `copilot.service.ts`, `rag.service.ts` |
| `knowledge/`    | NGO document ingestion pipeline, RAG query orchestration |

### Shared Code

| Directory         | Contents                                              |
|-------------------|-------------------------------------------------------|
| `config/`         | Environment variables, Supabase config, constants     |
| `middleware/`      | `auth.middleware.ts`, `validate.middleware.ts`, `error.middleware.ts` |
| `lib/`            | Supabase admin client, Clerk backend client, HF HTTP client |
| `utils/`          | Error classes, response helpers, date utilities       |

### Frontend Structure

```
frontend/
  src/
    components/         # Shared UI components (shadcn/ui + custom)
    hooks/              # Custom React hooks (useAuth, useApi, etc.)
    lib/                # API client, Supabase browser client, utils
    pages/              # Route-level page components
      auth/             # Login, Register, Onboarding
      volunteer/        # Volunteer-specific pages
      ngo/              # NGO-specific pages
      shared/           # Pages accessible to both roles
    routes/             # Route definitions and guards
    types/              # Shared TypeScript types
    App.tsx             # App shell with router + floating assistant
    main.tsx            # Entry point
```

## Request Lifecycle

Every protected API request follows this pipeline:

```
Client Request (JWT in Authorization: Bearer <token>)
    │
    ▼
1. Express Middleware (CORS, body-parser, request logging)
    │
    ▼
2. Authentication — verify session token via Clerk (`@clerk/backend`)
    │  → extract auth user ID
    │  → reject with 401 if invalid/expired
    │
    ▼
3. User Resolution — determine role and domain identity
    │  → look up volunteer or NGO profile by auth user ID
    │  → attach { userId, role, domainId } to req
    │
    ▼
4. Authorization — verify role-level permission for this route
    │  → e.g., only NGO can create projects
    │  → reject with 403 if insufficient role
    │
    ▼
5. Input Validation — Zod schema parsing
    │  → validate params, query string, request body
    │  → reject with 400 + field errors if invalid
    │
    ▼
6. Controller → Service — execute business logic
    │  → service layer performs operations
    │  → queries/mutates PostgreSQL
    │  → calls AI services if needed (behind abstractions)
    │
    ▼
7. Response — structured JSON response
    │  → { success: true, data: ... }
    │  → only authorized data returned
    │
    ▼
Client receives response
```

## Data Flow: Key Operations

### Volunteer Matching

```
GET /api/matching/volunteers/:projectId
    → Auth + Authz (NGO only, owns project)
    → Deterministic filters (status, capacity, eligibility (age, gender), distance)
    → Score each candidate (skills + interests + embedding + distance)
    → Rank by composite score descending
    → Return top-N with per-factor breakdown
```

### RAG Query (Knowledge Assistant)

```
POST /api/ai/assistant/chat { message }
    → Auth + User Resolution (role + identity)
    → If NGO caller:
        → Embed question via Hugging Face API
        → pgvector similarity search over that NGO's knowledge chunks
        → Retrieve top-K relevant chunks
        → Build grounded prompt → Gemini API → answer
        → Return answer + source references
    → If Volunteer caller:
        → Build prompt with public project/NGO data context
        → Gemini API → answer
        → Return answer
    → Read/answer only — never creates or edits data
```

### QR Attendance

```
1. NGO generates QR: GET /api/attendance/:eventId/qr
    → Backend creates time-limited token, stores in DB
    → Returns token → frontend renders QR code

2. Volunteer scans QR: POST /api/attendance/check-in
    → Backend validates: auth user, valid registration, event status,
      token validity, no duplicate check-in, within attendance window
    → Creates attendance record with check_in time

3. Volunteer scans again: POST /api/attendance/check-out
    → Same validation + checks for existing check-in, no duplicate check-out
    → Updates record with check_out time + calculated hours
```

### Project Copilot

```
POST /api/ai/copilot/draft { brief }
    → Auth + Authz (NGO only)
    → Send brief to Gemini with structured output prompt
    → Parse + validate response with Zod schema
    → Return draft to client (title, description, skills, responsibilities, eligibility, capacity)
    → NEVER writes to database
    → NGO reviews/edits in UI, then explicitly submits via POST /api/projects
```

## Security Model

- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `HF_TOKEN`) exist only on the backend.
- Frontend uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- All IDs (user, NGO, project, registration, attendance) are derived server-side from the JWT — never trusted from the client.
- Every protected endpoint enforces: authenticate → resolve user → check authorization → validate input → execute.

## Error Handling

Typed error classes map to HTTP status codes:

| Error              | Status | Use Case                                      |
|--------------------|--------|-----------------------------------------------|
| `ValidationError`  | 400    | Zod validation failure                        |
| `AuthenticationError` | 401 | Missing or invalid JWT                        |
| `AuthorizationError`  | 403 | Insufficient role or ownership               |
| `NotFoundError`    | 404    | Entity not found                              |
| `ConflictError`    | 409    | Duplicate registration, duplicate attendance  |
| `AppError`         | 500    | Unexpected server error                       |

AI provider errors (timeout, rate limit, malformed response, empty response) are caught and returned as graceful degradation — the core application continues functioning with a user-friendly message.