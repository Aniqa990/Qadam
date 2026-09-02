# Qadam Development Rules

## Product

Qadam is an AI-powered social-good volunteer platform connecting NGOs with suitable volunteers and measuring community impact.

Core features:

1. Volunteer registration and profiles
2. Skills-based and AI-assisted volunteer matching
3. NGO project creation and management
4. AI NGO Copilot
5. QR attendance
6. NGO knowledge RAG assistant

## Architecture

Use a modular monolithic architecture.

# Frontend:

Use:

* React
* TypeScript
* Vite
* React Router
* Tailwind CSS
* shadcn/ui

The React application communicates with the backend exclusively through HTTP REST APIs.

Do not put business logic, authorization logic, AI API calls, or database access in React components.

React is responsible for:

* UI
* user interaction
* local UI state
* form handling
* displaying API results
* browser APIs such as camera access for QR scanning

# Backend:

Use:

* Node.js
* TypeScript
* Express

## Backend Structure

Use a standard layered Node.js + Express + TypeScript architecture.

backend/src/
├── config/        # Environment and application configuration
├── controllers/   # HTTP request/response handling only
├── services/      # Business logic and external integrations
├── routes/        # Express route definitions
├── middleware/    # Authentication, validation, error handling
├── validators/    # Zod request schemas
├── types/         # Shared TypeScript types
├── utils/         # Small shared utility functions
├── lib/           # External client initialization
├── app.ts         # Express app configuration
└── server.ts      # Server startup

Use this request flow:

Route → Middleware → Validator → Controller → Service → Database/API

Controllers must remain thin. They should:
- read validated request data
- access authenticated user information
- call the appropriate service
- return the HTTP response

Controllers must not contain business logic or direct database queries.

Services contain domain/business logic and may call:
- Supabase
- external APIs
- AI service abstractions
- utility functions

Routes should only define endpoints and attach middleware/controllers.

Do not introduce repositories, use-cases, dependency-injection containers,
factories, or other abstraction layers unless explicitly required.

AI services belong under:

services/ai/

AI provider implementations must remain hidden behind llm.service.ts.
Controllers must never call Gemini, Qwen, or Hugging Face directly.

## Database

Use Supabase PostgreSQL as the primary database.

Use:

* PostgreSQL
* Clerk (authentication — see "Clerk Auth Migration" below; Supabase Auth is no longer used)
* Supabase Storage
* pgvector

PostgreSQL is the source of truth.

Use UUID primary keys.

Use foreign keys, unique constraints, check constraints, and indexes where appropriate.

Never trust client-supplied:

* user IDs
* NGO IDs
* project IDs
* registration IDs
* attendance IDs

Derive authenticated user identity from the authenticated request on the backend.

Authorization must always be checked server-side.

Use Row Level Security where appropriate.

Store `skills` and `interests` as `TEXT[]` with GIN indexes, not normalized lookup tables, for MVP — see "Skills/interests: arrays vs normalized tables" discussion. Revisit only if the product needs admin-curated taxonomies, multi-language labels, or skill-level analytics.

Location fields (`location_name`) must be stored as `"City, Country"` (e.g. `"Karachi, Pakistan"`), never as a bare city or country. Exact pinned coordinates (`location_lat`/`location_lng`) must always be stored alongside the location string; never derive coordinates from a city centroid. Use **MapLibre GL with OpenFreeMap** for map display and pin selection. OpenFreeMap provides free public vector tiles with no API key or request quota. Use **BigDataCloud Reverse Geocoding** to convert selected coordinates into the `"City, Country"` string; use its server-side endpoint for arbitrary map pins and cache the resolved string in the row.

## Clerk Auth Migration

Auth moves from Supabase Auth to Clerk. This changes identity, not authorization — every existing "authenticate → resolve user → authorize" rule in this document still applies.

Frontend: use `@clerk/clerk-react` (`<ClerkProvider>`, `<SignIn>`, `<SignUp>`, `useAuth()`). Clerk owns sign-up, sign-in, session refresh, and MFA — the previous `/api/auth/signup|login|refresh` endpoints are removed.

Backend: verify the Clerk session token on every protected request using `@clerk/backend` (or `clerk-sdk-node`'s Express middleware), not a hand-rolled JWT check. The verified token's `sub` claim is the Clerk user ID — store it in `volunteers.auth_user_id` / `ngos.auth_user_id` as `TEXT` (Clerk IDs look like `user_2abc...`, not UUIDs; drop the `FK → auth.users` since that table no longer exists). Role (`volunteer` | `ngo`) is stored in Clerk's `publicMetadata`, set once at sign-up via a Clerk webhook (`user.created`) that also creates the matching `volunteers`/`ngos` row.

Pick one RLS strategy and apply it consistently — do not mix them:

Use **backend-only authorization** for the MVP. Express verifies Clerk tokens and performs all authorization before using the Supabase service-role client. Keep RLS enabled with default-deny policies as defense-in-depth; do not rely on `auth.uid()` policies because the frontend never queries Supabase directly.

## Backend Security

The React client must never have access to:

SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
HF_TOKEN

Never expose secrets through frontend environment variables.

The frontend may use only public Supabase configuration when required.

Never use VITE_ environment variables for secrets.

All protected API endpoints must:

* Authenticate the request.
* Determine the authenticated user.
* Verify authorization.
* Validate request input.
* Perform the operation.
* Return only authorized data.

Use Zod for API input validation.

## AI:

Use only free resources.

Primary AI providers:

* Gemini API free-tier models for LLM generation, with Alibaba Cloud DashScope Qwen free-tier models as the automatic fallback when Gemini errors, times out, or is rate-limited
* Hugging Face Inference API for embeddings
* Supabase pgvector for vector storage and similarity search

Do not use paid AI APIs.

`gemini.service.ts` and a new `qwen.service.ts` must implement the same internal interface (e.g. `generate(prompt, options) -> string`). `copilot.service.ts` and `rag.service.ts` call a thin `llm.service.ts` wrapper that tries Gemini first and falls back to Qwen on failure, logging which provider actually served the request. Never let the caller (routes/controllers) know or care which provider answered — that defeats the point of the abstraction. Structured-output validation (Zod) applies identically regardless of which provider produced the response, since prompt/response shape must stay provider-agnostic.

Do not run or download Hugging Face embedding models inside the Node.js server.

The Node.js backend should call Hugging Face through its API.

Keep AI providers behind service abstractions.

Example:

services/

    ai/

        gemini.service.ts

        embedding.service.ts

        rag.service.ts

        copilot.service.ts

        matching.service.ts

The rest of the application should not directly call Gemini or Hugging Face.

Do NOT introduce microservices, Kafka, Redis, Elasticsearch, Pinecone, Qdrant, or other infrastructure unless explicitly requested.




AI must never be the source of truth for:

* Attendance
* Volunteer registration
* Capacity
* Authorization
* User identity
* Eligibility

AI may:

* Generate project drafts
* Suggest volunteer matches
* Summarize information
* Generate explanations
* answer grounded knowledge questions
* improve project descriptions
* summarize verified metrics

All AI-generated structured data must be validated with Zod before use.

AI-generated project content must be shown as a draft requiring NGO approval before publication.

Handle:

* provider errors
* timeouts
* malformed responses
* rate limits
* empty responses

Gracefully.

Never allow an AI failure to corrupt core application data.

## AI Assistant Surfaces (UI Placement)

Qadam ships exactly two AI-facing surfaces in the UI. Do not create a third, and do not merge these two into one chat window.

1. Global Knowledge Assistant (floating widget)
A single floating chat icon, fixed to a bottom corner of the viewport, mounted once at the app-shell/layout level (not per-page).
Visible to both authenticated roles: Volunteer and NGO.
Opens a popup/side-panel chat window on click. Does not navigate away from the current page.
Backend contract: POST /api/ai/assistant/chat
Volunteer callers: answers general platform questions and questions about public NGO/project data.
NGO callers: Grounded in that NGO's own uploaded knowledge base (RAG over their documents) and their own verified impact metrics.
Always resolves the caller's role and identity server-side from the authenticated session — never from a client-supplied flag.
Internally may route to rag.service.ts (knowledge questions) and/or a lightweight metrics-summary path (impact questions), but the client only ever calls this one endpoint.
This surface never creates, edits, or publishes a project. It is read/answer-only.

2. Project Copilot (in-flow only)
Lives only inside the NGO's "Create Project" / "Edit Project" screen, as an inline panel or drawer next to the project form — not in the floating widget, not on any other page.
Visible only to authenticated NGO users, only within that flow.
Backend contract: POST /api/ai/copilot/draft
Accepts a short natural-language brief, returns a Zod-validated structured draft (title, description, category, required skills, responsibilities, eligibility, capacity).
Never writes to the database. The NGO must review, optionally edit, then explicitly Approve, which triggers the normal project-create/update endpoint.
copilot.service.ts and rag.service.ts may both depend on the same gemini.service.ts and embedding.service.ts, but the two HTTP endpoints above stay separate because their auth scope, grounding data, and side effects differ.

Marketing/UI copy may still refer to this collectively as "the Qadam AI Assistant" — that branding is a presentation choice and does not change the two-endpoint, two-surface backend split above.

## Matching

Volunteer matching must use a hybrid approach. **Availability is not stored or matched in the MVP.**

First perform deterministic filtering:

* project status
* project capacity
* eligibility requirements
* location/distance when available

Only candidates passing deterministic filters should be semantically scored.

Use Hugging Face embeddings for semantic similarity between:

Volunteer:

* skills
* interests
* experience
* project description

and Project:

* required skills
* project category
* project description
* responsibilities

Store reusable embeddings in pgvector.

Do NOT generate embeddings on every recommendation request.

Generate or update embeddings when:

* a volunteer profile changes
* volunteer skills change
* a project is created
* a project description changes
* project requirements change

Use pgvector similarity to retrieve candidates/projects.

Matching must be explainable.

Expose reasons such as:

* matching skills
* matching interests
* previous experience
* distance
* project relevance

Do not use an LLM as the primary ranking mechanism.

### Composite scoring weights

Only candidates that already pass deterministic filtering are scored. Composite score is a weighted sum:

* distance: 0.35 (highest weight — nearby matches should generally outrank far-away semantically-perfect ones)
* skills match: 0.30
* interests match: 0.15
* embedding similarity: 0.20

`distance_score = 1 / (1 + distance_km)`. If either party has no coordinates, drop the distance term and renormalize the remaining weights proportionally rather than defaulting distance to 0 or 1.

Tune these constants centrally (a single config object in `matching.service.ts`), not inline per call site.

## NGO Knowledge RAG

NGO knowledge RAG uses:

* Supabase Storage for source documents — single `knowledge` bucket, path-scoped as `knowledge/{ngo_id}/{document_id}/{file_name}`. Do not create a bucket per NGO: buckets are an infra-provisioning concept, not a data-partitioning one, and a per-NGO bucket buys nothing here since access control is already enforced by the `knowledge_documents.ngo_id` column, backend authorization, and (optionally) a Storage RLS policy matching the `{ngo_id}` path segment against the caller's NGO id.
* Node.js for ingestion orchestration.
* Text extraction.
* Chunking.
* Hugging Face embeddings.
* Supabase pgvector.
* Gemini for answer generation.

Document ingestion:

document
* → text extraction
* → chunking
* → embeddings
* → pgvector

Question answering:

question
* → question embedding
* → pgvector similarity search
* → relevant chunks
* → Gemini
* → answer

The generated answer must be grounded only in retrieved NGO knowledge when answering knowledge-base questions.

Return source document/chunk references when practical.

Never invent NGO policies or facts.

If the retrieved context is insufficient, the assistant should say that the available NGO knowledge does not contain enough information.

For MVP, document ingestion should be bounded by reasonable file size/page limits (10 MB max, enforced by `chk_knowledge_file_size`).

Do not process arbitrarily large documents in a single synchronous HTTP request. `POST /api/knowledge/documents` returns `201` immediately after the file is stored (`status: 'uploaded'`), then kicks off ingestion out-of-band within the same Node process (e.g. `setImmediate`/a fire-and-forget async function — no queue, no worker process needed for MVP). The document row's `status` column is the source of truth (`uploaded → processing → ready|failed`); the frontend polls `GET /api/knowledge/documents` (or a `GET /api/knowledge/documents/:id`) every few seconds while status is `processing`. This avoids both a 30+ second blocked request and any new infrastructure.

This RAG capability is surfaced only through the Global Knowledge Assistant widget described above — see "AI Assistant Surfaces".

## Attendance

Attendance is based on registration plus QR check-in/check-out.

Use browser-based QR scanning.

Preferred libraries:

qrcode for QR generation
html5-qrcode for browser scanning

QR scanning occurs in the React client.

The client sends the scanned attendance token to the Node.js backend.

The backend validates:

* authenticated user
* valid registration
* valid project
* event status
* attendance token
* duplicate check-in
* duplicate check-out
* allowed attendance window when applicable

Never allow the client to directly mark attendance as verified.

Attendance is stored in PostgreSQL.

Attendance is the source of truth for verified volunteer participation.

QR payload encodes both `event_id` and `token` (e.g. `qadam://attendance/{event_id}/{token}`), not the token alone. This lets the client fail fast with a clear "wrong event" error before hitting the network, and lets the backend do an indexed `WHERE event_id = $1 AND token = $2` lookup instead of a token-only scan. Still re-validate everything server-side (token match, window, duplicate check) — the client-supplied `event_id` is only a lookup hint, never trusted for authorization.

No hard cap on attendance events (sessions) per project for MVP — a multi-day project naturally needs one per day. If abuse becomes a concern later, add a soft limit (e.g. flag for review past 30 events/project) rather than a hard block.

## Coding style

Use TypeScript strict mode.

Prefer small, composable functions.

Prefer domain services over duplicated logic.

Keep controllers thin.

Use clear domain naming.

Avoid unnecessary abstractions.

Do not over-engineer.

Do not introduce dependencies unless they solve a concrete requirement.

Before adding a package, check whether native Node.js, browser APIs, or existing dependencies can solve the requirement.

## UI

Use React, Tailwind CSS, and shadcn/ui.

Design should feel modern, trustworthy, warm, and community-focused.

Prioritize:

* accessibility
* responsive design
* clear empty states
* loading states
* error states
* mobile usability

Avoid excessive animations.

## AI coding workflow

Before making large changes:

1. Inspect the existing architecture.
2. Identify affected files.
3. Check existing services/components before creating new ones.
4. Propose a concise implementation plan.
5. Implement only the requested scope.
6. Run typecheck.
7. Run lint.
8. Run relevant tests.
9. Fix errors caused by the change.
10. Report changed files and verification results.

Do not rewrite unrelated code.

Do not create duplicate components, routes, services, hooks, or utilities.

Keep API contracts and database types synchronized.

## Testing

For business-critical functionality test:

* authentication
* authorization
* project creation
* registration
* duplicate registration
* attendance
* duplicate attendance
* matching score
* AI output validation
* AI failure handling

AI tests should focus on:

* schema validity
* grounding
* authorization
* failure handling

Do not require exact natural-language output from Gemini in tests.

## Environment variables

Use:

* SUPABASE_URL=
* SUPABASE_SERVICE_ROLE_KEY=

* CLERK_PUBLISHABLE_KEY=
* CLERK_SECRET_KEY=
* CLERK_WEBHOOK_SECRET=

* GEMINI_API_KEY=
* GEMINI_MODEL=

* DASHSCOPE_API_KEY=
* QWEN_MODEL=

* HF_TOKEN=
* HF_EMBEDDING_MODEL=
* BDC_API_KEY=

Frontend .env may contain only public configuration: `VITE_SUPABASE_URL` and `VITE_CLERK_PUBLISHABLE_KEY`. (Note: `SUPABASE_ANON_KEY` is no longer needed on the frontend once the frontend never talks to Supabase directly — all data access goes through the Express API.)

Never place:

* SUPABASE_SERVICE_ROLE_KEY
* CLERK_SECRET_KEY
* CLERK_WEBHOOK_SECRET
* GEMINI_API_KEY
* DASHSCOPE_API_KEY
* HF_TOKEN

in frontend environment variables.

Never commit .env files.
Never commit `.env.local`.
Provide .env.example without real credentials.

## Performance

Avoid unnecessary API calls.

Paginate lists that can grow.

Use database indexes for frequently queried fields.

Do not calculate semantic embeddings on every page load.

Reuse stored embeddings.

Do not call Gemini when deterministic logic is sufficient.

Do not call Hugging Face when an existing embedding can be reused.

Keep AI requests bounded.

Do not perform thousands of embedding requests inside a single synchronous HTTP request.

For MVP document ingestion, enforce reasonable document size/page limits.

Heavy background processing should only be introduced if the MVP actually requires it.

Do not introduce queues, Redis, workers, or additional infrastructure prematurely.

## Important

Do not change the architecture without explaining why.

Do not add functionality outside the requested task.

Do not generate placeholder implementations when the requested feature can be implemented properly.

Prioritize a working, deployable MVP over theoretical scalability.

The system should remain simple enough for a small hackathon team to understand, debug, and deploy.

Core application functionality must continue working even when an AI provider is unavailable.