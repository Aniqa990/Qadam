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
    │  │ Clerk    │ │PostgreSQL│ │  Storage   │ │
    │  │ (Auth)  │ │+pgvector │ │(Documents) │ │
    │  └─────────┘ └──────────┘ └───────────┘ │
    └──────────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────┴────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │ Gemini  │   │ Qwen      │   │ Hugging   │
    │ API     │   │ DashScope │   │ Face API  │
    │ (LLM)   │   │ (fallback)│   │(Embeddings)│
    └─────────┘   └───────────┘   └───────────┘
```

## Technology Stack

| Layer     | Technology                                            |
|-----------|-------------------------------------------------------|
| Frontend  | React, TypeScript, Vite, React Router, Tailwind, shadcn/ui, Recharts |
| Backend   | Node.js, TypeScript, Express                          |
| Database  | Supabase PostgreSQL, pgvector extension               |
| Auth      | Clerk (session tokens)                                 |
| Storage   | Supabase Storage (RAG documents, logos)               |
| LLM       | Gemini API free-tier models → Qwen (DashScope) fallback |
| Embeddings| Hugging Face Inference API (HTTP, never local model)  |
| Validation| Zod (API inputs and AI outputs)                       |
| QR        | `qrcode` (generation), `html5-qrcode` (scanning)      |
| Charts    | Recharts                                              |
| Maps      | MapLibre GL + OpenFreeMap; BigDataCloud reverse geocoding |

## Module Boundaries

### Backend Modules

```
backend/
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   ├── clerk.ts
│   │   ├── supabase.ts
│   │   └── ai.ts
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── volunteer.controller.ts
│   │   ├── ngo.controller.ts
│   │   ├── project.controller.ts
│   │   ├── registration.controller.ts
│   │   ├── matching.controller.ts
│   │   ├── attendance.controller.ts
│   │   ├── ai.controller.ts
│   │   ├── knowledge.controller.ts
│   │   └── impact.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── volunteer.service.ts
│   │   ├── ngo.service.ts
│   │   ├── project.service.ts
│   │   ├── registration.service.ts
│   │   ├── matching.service.ts
│   │   ├── attendance.service.ts
│   │   ├── knowledge.service.ts
│   │   ├── impact.service.ts
│   │   └── ai/
│   │       ├── llm.service.ts
│   │       ├── gemini.service.ts
│   │       ├── qwen.service.ts
│   │       ├── embedding.service.ts
│   │       ├── copilot.service.ts
│   │       └── rag.service.ts
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── volunteer.routes.ts
│   │   ├── ngo.routes.ts
│   │   ├── project.routes.ts
│   │   ├── registration.routes.ts
│   │   ├── matching.routes.ts
│   │   ├── attendance.routes.ts
│   │   ├── ai.routes.ts
│   │   ├── knowledge.routes.ts
│   │   └── impact.routes.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── not-found.middleware.ts
│   │
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   ├── volunteer.validator.ts
│   │   ├── ngo.validator.ts
│   │   ├── project.validator.ts
│   │   ├── registration.validator.ts
│   │   ├── attendance.validator.ts
│   │   ├── ai.validator.ts
│   │   └── knowledge.validator.ts
│   │
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── volunteer.types.ts
│   │   ├── ngo.types.ts
│   │   ├── project.types.ts
│   │   └── express.d.ts
│   │
│   ├── utils/
│   │   ├── errors.ts
│   │   ├── response.ts
│   │   ├── distance.ts
│   │   └── logger.ts
│   │
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── clerk.ts
│   │   └── http.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

### Frontend Structure

```
frontend/
  src/
    components/         # Shared UI components (shadcn/ui + custom)
    hooks/              # Custom React hooks (useAuth, useApi, etc.)
    lib/                # API client, Clerk frontend SDK, utils
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

```
Request
   ↓
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
Supabase / External API
```

### For AI

```
Controller
   ↓
copilot.service.ts / rag.service.ts
   ↓
llm.service.ts
   ↓
Gemini
   ↓
Qwen fallback
```

## Data Flow: Key Operations

### Volunteer Matching

```
GET /api/matching/volunteers/:projectId
    → Auth + Authz (NGO only, owns project)
    → Deterministic filters (status, capacity, eligibility by age, distance)
    → Score each candidate (distance + skills + interests + embedding)
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
        → Build grounded prompt → Gemini-first/Qwen-fallback LLM service → answer
        → Return answer + source references
    → If Volunteer caller:
        → Build prompt with public project/NGO data context
        → Gemini-first/Qwen-fallback LLM service → answer
        → Return answer
    → Read/answer only — never creates or edits data
```

### QR Attendance

```
1. NGO generates QR: GET /api/attendance/events/:eventId/qr
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
    → Send brief to Gemini-first/Qwen-fallback LLM service with structured output prompt
    → Parse + validate response with Zod schema
    → Return draft to client (title, description, skills, responsibilities, eligibility, capacity)
    → NEVER writes to database
    → NGO reviews/edits in UI, then explicitly submits via POST /api/projects
```

## Security Model

- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `HF_TOKEN`) exist only on the backend.
- Frontend uses only `VITE_CLERK_PUBLISHABLE_KEY`; it does not access Supabase directly.
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