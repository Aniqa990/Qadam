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

React
TypeScript
Vite
React Router
Tailwind CSS
shadcn/ui

The React application communicates with the backend exclusively through HTTP REST APIs.

Do not put business logic, authorization logic, AI API calls, or database access in React components.

React is responsible for:

UI
user interaction
local UI state
form handling
displaying API results
browser APIs such as camera access for QR scanning

# Backend:

Use:

Node.js
TypeScript
Express

The Node.js backend is the single application backend and AI orchestration layer.

Organize backend code by domain rather than by technical type.

Preferred structure:

backend/
    src/
        config/
        middleware/
        modules/
            auth/
            volunteers/
            ngos/
            projects/
            registrations/
            attendance/
            matching/
            ai/
            knowledge/
        lib/
        utils/
        app.ts
        server.ts

Each module should contain its relevant:

routes
controllers
services
validation schemas
types

Do not create separate servers for matching, RAG, AI, or attendance.

## Database

Use Supabase PostgreSQL as the primary database.

Use:

PostgreSQL
Supabase Auth
Supabase Storage
pgvector

PostgreSQL is the source of truth.

Use UUID primary keys.

Use foreign keys, unique constraints, check constraints, and indexes where appropriate.

Never trust client-supplied:

user IDs
NGO IDs
project IDs
registration IDs
attendance IDs

Derive authenticated user identity from the authenticated request on the backend.

Authorization must always be checked server-side.

Use Row Level Security where appropriate.

## Backend Security

The React client must never have access to:

SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
HF_TOKEN

Never expose secrets through frontend environment variables.

The frontend may use only public Supabase configuration when required.

Never use VITE_ environment variables for secrets.

All protected API endpoints must:

Authenticate the request.
Determine the authenticated user.
Verify authorization.
Validate request input.
Perform the operation.
Return only authorized data.

Use Zod for API input validation.

## AI:

Use only free resources.

Primary AI providers:

Gemini API for LLM generation
Hugging Face Inference API for embeddings
Supabase pgvector for vector storage and similarity search

Do not use paid AI APIs.

Do not run or download Hugging Face embedding models inside the Node.js server.

The Node.js backend should call Hugging Face through its API.

Keep AI providers behind service abstractions.

Example:

ai/
    services/
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

## Matching

Volunteer matching must use a hybrid approach.

First perform deterministic filtering:

* project status
* project capacity
* volunteer availability
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

matching skills
matching interests
previous experience
availability
distance
project relevance

Do not use an LLM as the primary ranking mechanism.

## NGO Knowledge RAG

NGO knowledge RAG uses:

* Supabase Storage for source documents.
* Node.js for ingestion orchestration.
* Text extraction.
* Chunking.
* Hugging Face embeddings.
* Supabase pgvector.
* Gemini for answer generation.

Document ingestion:

document
→ text extraction
→ chunking
→ embeddings
→ pgvector

Question answering:

question
→ question embedding
→ pgvector similarity search
→ relevant chunks
→ Gemini
→ answer

The generated answer must be grounded only in retrieved NGO knowledge when answering knowledge-base questions.

Return source document/chunk references when practical.

Never invent NGO policies or facts.

If the retrieved context is insufficient, the assistant should say that the available NGO knowledge does not contain enough information.

For MVP, document ingestion should be bounded by reasonable file size/page limits.

Do not process arbitrarily large documents in a single synchronous HTTP request.


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

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
GEMINI_MODEL=

HF_TOKEN=
HF_EMBEDDING_MODEL=

Frontend .env may contain only public configuration.

Never place:

* SUPABASE_SERVICE_ROLE_KEY
* GEMINI_API_KEY
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