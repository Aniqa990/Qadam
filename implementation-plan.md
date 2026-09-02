# Implementation Plan

## Overview

The implementation is organized into 8 ordered phases. Each phase builds on the previous one, producing a working increment that can be tested end-to-end. Phases are scoped tightly — features not listed are explicitly excluded.

---

## Phase 1: Project Scaffolding & Infrastructure

**Scope:** Initialize the monorepo with frontend and backend projects, configure tooling, set up Supabase, and establish shared patterns.

**Deliverables:**
- Initialize Vite + React + TypeScript frontend project (`frontend/`)
- Initialize Node.js + TypeScript + Express backend project (`backend/`)
- Configure Tailwind CSS + shadcn/ui on the frontend
- Configure TypeScript strict mode in both projects
- Set up backend module directory structure (`config/`, `middleware/`, `modules/`, `lib/`, `utils/`)
- Create `.env.example` files for both frontend and backend
- Create `app.ts` and `server.ts` entry points
- Set up global error handling middleware (`error.middleware.ts`)
- Set up Zod validation middleware (`validate.middleware.ts`)
- Create shared response helpers and error classes (`utils/`)
- Initialize Supabase project (local or cloud), enable `pgvector` extension
- Create Supabase client instances (`lib/supabase.ts` — admin client + auth client)
- Set up CORS middleware
- Verify: backend responds to `GET /api/health`

**Not in this phase:**
- No application features
- No database tables
- No authentication flow
- No UI pages

---

## Phase 2: Authentication & User Resolution

**Scope:** Implement sign-up, login, logout, session management, and server-side user resolution for both Volunteer and NGO roles.

**Deliverables:**
- **Backend `auth/` module:**
  - `POST /api/auth/signup` — create Supabase Auth user with role metadata
  - `POST /api/auth/login` — authenticate and return JWT
  - `POST /api/auth/logout` — invalidate session
  - `GET /api/auth/me` — return current user with role and profile status
  - `POST /api/auth/refresh` — refresh token
- **Backend middleware:**
  - `auth.middleware.ts` — verify JWT, extract `auth.uid()`
  - `resolveUser.middleware.ts` — look up volunteer or NGO profile, attach to `req`
- **Frontend:**
  - `AuthProvider` context (session state, login, logout, refresh)
  - `useAuth` hook
  - API client with automatic JWT attachment and refresh
  - `LoginPage` + `LoginForm`
  - `RegisterPage` + `RegisterForm` (with role selection)
  - Route guards (`ProtectedLayout`, `VolunteerGuard`, `NgoGuard`)
  - Redirect logic: post-login → role-based home or onboarding

**Not in this phase:**
- Profile forms (onboarding)
- Any feature beyond auth
- Database tables beyond `auth.users`

---

## Phase 3: Volunteer & NGO Onboarding

**Scope:** Implement profile creation and editing for both roles, with onboarding completion tracking.

**Deliverables:**
- **Database migrations:**
  - `volunteers` table (with all columns, indexes, constraints)
  - `ngos` table (with all columns, indexes, constraints)
  - RLS policies for both tables
- **Backend `volunteers/` module:**
  - `GET /api/volunteers/profile`
  - `POST /api/volunteers/profile` (create/update, sets `onboarding_complete`)
  - `PUT /api/volunteers/profile` (partial update)
  - Zod validation schemas for volunteer input
- **Backend `ngos/` module:**
  - `GET /api/ngos/profile`
  - `POST /api/ngos/profile` (create/update, sets `onboarding_complete`)
  - `PUT /api/ngos/profile` (partial update)
  - `GET /api/ngos` (public directory listing)
  - `GET /api/ngos/:id` (public profile)
  - Zod validation schemas for NGO input
- **Frontend:**
  - `VolunteerOnboardingPage` — multi-step form (personal info → skills/interests → availability/location → review)
  - `VolunteerProfilePage` — edit profile
  - `NgoOnboardingPage` — organization details form
  - `NgoProfilePage` — edit organization details
  - Shared form components (skills multi-select, location picker, availability selector)

**Not in this phase:**
- Projects
- Matching
- Any AI features
- Embeddings

---

## Phase 4: Project Creation & Management

**Scope:** Implement the full project lifecycle — CRUD, status transitions, and the NGO project management UI.

**Deliverables:**
- **Database migrations:**
  - `projects` table (all columns, indexes, constraints, check constraints)
  - RLS policies for projects
- **Backend `projects/` module:**
  - `GET /api/projects` (scope-aware: NGO sees own, volunteer sees published+)
  - `GET /api/projects/:id`
  - `POST /api/projects`
  - `PUT /api/projects/:id`
  - `DELETE /api/projects/:id` (draft only)
  - `POST /api/projects/:id/publish`
  - `POST /api/projects/:id/activate`
  - `POST /api/projects/:id/complete`
  - `POST /api/projects/:id/cancel`
  - Status transition validation
  - Zod validation schemas
- **Frontend:**
  - `NgoDashboardPage` — project overview with stats
  - `NgoProjectsPage` — project list with status badges and actions
  - `CreateProjectPage` — project form (without Copilot — that's Phase 7)
  - `EditProjectPage` — project form + status controls
  - `ProjectDetailPage` — shared project detail view
  - `ProjectsPage` — browse/filter public projects
  - `ProjectCard` component
  - `ProjectFilters` component (category, search, status)
  - `HomePage` — landing page with featured projects

**Not in this phase:**
- Registrations
- Attendance
- Copilot panel
- Matching
- Embeddings

---

## Phase 5: Registration & Matching

**Scope:** Implement volunteer registration with all validation rules, and the hybrid matching pipeline (deterministic filters + scoring + embedding similarity).

**Deliverables:**
- **Database migrations:**
  - `registrations` table (with unique constraint, indexes)
  - `volunteer_embeddings` table (with pgvector column, index)
  - `project_embeddings` table (with pgvector column, index)
  - RLS policies for all three
- **Backend `registrations/` module:**
  - `POST /api/registrations` (with capacity, duplicate, eligibility, onboarding checks)
  - `GET /api/registrations` (scope-aware)
  - `GET /api/registrations/:id`
  - `PUT /api/registrations/:id/cancel`
  - Zod validation
- **Backend `matching/` module:**
  - `GET /api/matching/volunteers/:projectId` — ranked matches for a project
  - `GET /api/matching/projects` — recommended projects for a volunteer
  - Deterministic filter query
  - Multi-factor scoring (skills 0.35 + interests 0.20 + embedding 0.30 + availability 0.10 + distance 0.05)
  - Explanation/reasons generation
- **Backend `ai/services/embedding.service.ts`:**
  - `generateEmbedding()` — call HF Inference API
  - `generateEmbeddings()` — batch call
  - Error handling (timeout, rate limit, network)
- **Embedding lifecycle:**
  - Generate project embedding on publish
  - Regenerate project embedding on description/skills/category change
  - Generate/regenerate volunteer embedding on profile update
  - Content hash change detection
- **Frontend:**
  - Registration button on `ProjectDetailPage`
  - `VolunteerProjectsPage` — recommended + registered projects
  - `VolunteerRegistrationsPage` — registration list with cancel
  - `MatchingPage` — ranked volunteer matches with score breakdown
  - `MatchCard` component with reasons display

**Not in this phase:**
- Attendance
- AI Copilot
- RAG / Knowledge Assistant
- Impact dashboards

---

## Phase 6: QR Attendance

**Scope:** Implement the full attendance flow — event creation, QR generation, browser-based scanning, check-in/check-out, and verified hours calculation.

**Deliverables:**
- **Database migrations:**
  - `attendance_tokens` table (with unique constraints)
  - `attendance` table (with unique constraint, check constraint, indexes)
  - RLS policies
- **Backend `attendance/` module:**
  - `POST /api/attendance/events` — create event with token
  - `GET /api/attendance/events` — list events for a project
  - `GET /api/attendance/events/:eventId/qr` — get QR data
  - `POST /api/attendance/check-in` — validate + create record
  - `POST /api/attendance/check-out` — validate + update with hours
  - `GET /api/attendance` — list attendance records (scope-aware)
  - All server-side validations: auth user, valid registration, event status, token validity, duplicate check, attendance window
- **Frontend:**
  - `AttendanceManagementPage` — create events, display QR codes, view records
  - `CreateEventForm` — event name, date, window
  - `QRCodeDisplay` — renders QR code using `qrcode` library
  - `QRScannerPage` — camera-based scanning using `html5-qrcode`
  - `ScanResult` — check-in/check-out confirmation or error display

**Not in this phase:**
- Impact dashboards
- AI features
- Any changes to matching or registration logic

---

## Phase 7: AI Features (Copilot + Knowledge Assistant)

**Scope:** Implement both AI surfaces as distinct features — the Project Copilot panel and the Global Knowledge Assistant — plus the RAG ingestion pipeline.

**Deliverables:**
- **Database migrations:**
  - `knowledge_documents` table
  - `knowledge_chunks` table (with `vector(384)` column, ivfflat/hnsw index)
  - RLS policies
- **Backend `ai/services/gemini.service.ts`:**
  - `generateText()` — Gemini API wrapper with error handling
  - Timeout, rate limit, malformed, empty response handling
- **Backend `ai/services/copilot.service.ts`:**
  - `generateDraft()` — prompt construction + Gemini call + Zod validation
  - `CopilotDraftSchema` — Zod schema for structured output
- **Backend `ai/services/rag.service.ts`:**
  - `query()` — embed question → pgvector search → build grounded prompt → Gemini → answer
  - Source reference extraction
  - Confidence threshold (insufficient context → "not enough information")
- **Backend `ai/` routes:**
  - `POST /api/ai/copilot/draft` — NGO only, never writes to DB
  - `POST /api/ai/assistant/chat` — role-aware, RAG for NGO, public data for volunteer
- **Backend `knowledge/` module:**
  - `POST /api/knowledge/documents` — upload + ingest pipeline
  - `GET /api/knowledge/documents` — list NGO's documents
  - `DELETE /api/knowledge/documents/:id` — delete doc + chunks
  - Ingestion pipeline: storage upload → text extraction → chunking → embedding → pgvector
  - Text extraction (pdf-parse for PDF, mammoth for DOCX, native for TXT)
  - Chunking (~500 tokens, ~50 token overlap)
  - Document status management (uploaded → processing → ready/failed)
  - MVP bounds: 10 MB max, 200 chunks max
- **Frontend:**
  - `CopilotPanel` component — inline panel/drawer on Create/Edit Project pages only
  - Copilot UI: text input for brief → loading state → draft display → "Apply to Form" button
  - `FloatingAssistant` component — fixed bottom-right icon, popup/side-panel chat
  - Chat UI: message input, message list, loading state, source references display
  - `KnowledgePage` — document upload, list, status, delete
  - `DocumentUpload` component with file picker and progress

**Not in this phase:**
- Impact dashboards
- Changes to matching, registration, or attendance
- Any merging of the two AI surfaces into one

---

## Phase 8: Impact Dashboards & Polish

**Scope:** Implement volunteer and NGO impact views, AI narrative generation, and final polish (loading states, error states, empty states, responsive design).

**Deliverables:**
- **Backend `impact/` module (or within existing modules):**
  - `GET /api/impact/volunteer` — personal metrics (hours, projects, causes, activity)
  - `GET /api/impact/ngo` — organization metrics (hours, volunteers, projects, categories, monthly)
  - `POST /api/impact/ngo/narrative` — AI-generated impact summary
  - All metrics calculated from `attendance` + `registrations` + `projects` tables
- **Frontend:**
  - `VolunteerImpactPage` — stats cards, hours chart (Recharts), causes breakdown, recent activity
  - `NgoImpactPage` — stats cards, hours-over-time chart, category breakdown, top volunteers table
  - `NarrativePanel` — "Generate AI Summary" button + narrative display
  - Charts using Recharts (BarChart, PieChart, LineChart as appropriate)
- **Polish:**
  - Consistent loading states on all pages
  - Consistent error states with retry buttons
  - Clear empty states with helpful CTAs
  - Mobile-responsive layout testing and fixes
  - Accessibility pass (ARIA labels, keyboard navigation, focus management)
  - Navigation polish (active states, breadcrumbs where needed)

**Not in this phase:**
- New features
- Architecture changes
- Performance optimization beyond basic pagination and indexes

---

## Dependency Graph

```
Phase 1: Scaffolding
    │
    ▼
Phase 2: Auth
    │
    ▼
Phase 3: Onboarding ──────────────────────┐
    │                                      │
    ▼                                      │
Phase 4: Projects                         │
    │                                      │
    ├──► Phase 5: Registration & Matching │
    │         │                            │
    │         ▼                            │
    │    Phase 6: Attendance               │
    │         │                            │
    │         ▼                            │
    └──► Phase 7: AI (Copilot + RAG) ◄────┘
              │
              ▼
         Phase 8: Impact & Polish
```

Phases 5, 6, and 7 all depend on Phase 4 (projects) and Phase 3 (profiles). They have some independence from each other — Phase 6 (attendance) depends on Phase 5 (registrations), but Phase 7 (AI) could theoretically be developed in parallel with Phase 6 if the team is large enough.

---

## Estimated Effort (Hackathon Context)

| Phase | Effort        | Priority    |
|-------|---------------|-------------|
| 1     | 2–3 hours     | Critical    |
| 2     | 3–4 hours     | Critical    |
| 3     | 4–5 hours     | Critical    |
| 4     | 5–6 hours     | Critical    |
| 5     | 6–8 hours     | Critical    |
| 6     | 4–5 hours     | Critical    |
| 7     | 6–8 hours     | High        |
| 8     | 4–5 hours     | Medium      |
| **Total** | **34–44 hours** |         |

For a hackathon team of 3–4, this is achievable in a focused weekend if Phases 1–6 are completed first and Phase 7–8 are scoped tightly.
