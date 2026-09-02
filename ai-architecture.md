# AI Architecture

## Two AI Surfaces — Explicit Separation

Qadam ships **exactly two** AI-facing UI surfaces. They are never merged into one chat window, never served by the same endpoint, and never share auth scope or side effects.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Application                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  App Shell (Layout Component)                                │    │
│  │                                                              │    │
│  │  ┌─────────────────────────┐  ┌──────────────────────────┐  │    │
│  │  │                         │  │                          │  │    │
│  │  │  Route Content          │  │  Floating Knowledge      │  │    │
│  │  │  (pages render here)    │  │  Assistant Widget        │  │    │
│  │  │                         │  │  ┌──────┐                │  │    │
│  │  │  ┌───────────────────┐  │  │  │  💬  │  ← fixed     │  │    │
│  │  │  │ NGO: Create/Edit  │  │  │  └──────┘    bottom     │  │    │
│  │  │  │ Project Page      │  │  │     │        corner     │  │    │
│  │  │  │                   │  │  │     ▼                   │  │    │
│  │  │  │ ┌───────────────┐ │  │  │  ┌────────────────┐    │  │    │
│  │  │  │ │ Project       │ │  │  │  │ Chat popup /   │    │  │    │
│  │  │  │ │ Copilot Panel │ │  │  │  │ side panel     │    │  │    │
│  │  │  │ │ (inline/drawer│ │  │  │  │                │    │  │    │
│  │  │  │ │ next to form) │ │  │  │  │ POST /api/ai/  │    │  │    │
│  │  │  │ │               │ │  │  │  │ assistant/chat │    │  │    │
│  │  │  │ │ POST /api/ai/ │ │  │  │  │                │    │  │    │
│  │  │  │ │ copilot/draft │ │  │  │  │ Read/answer    │    │  │    │
│  │  │  │ │               │ │  │  │  │ only           │    │  │    │
│  │  │  │ └───────────────┘ │  │  │  └────────────────┘    │  │    │
│  │  │  └───────────────────┘  │  │                          │  │    │
│  │  └─────────────────────────┘  └──────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Surface 1: Global Knowledge Assistant (Floating Widget)

| Property         | Value                                                    |
|------------------|----------------------------------------------------------|
| **UI location**  | Fixed floating icon, bottom corner, app-shell level      |
| **Visibility**   | All authenticated users (Volunteer + NGO)                |
| **Mounting**     | Rendered once in the root layout, not per-route          |
| **Backend**      | `POST /api/ai/assistant/chat`                            |
| **Scope**        | Read/answer only — never creates, edits, or publishes    |
| **NGO grounding**| RAG over the calling NGO's own uploaded documents + verified metrics |
| **Volunteer grounding** | Public project and NGO data                       |
| **Auth**         | Role resolved server-side from JWT — never from client   |

### Surface 2: Project Copilot (In-Flow Panel)

| Property         | Value                                                    |
|------------------|----------------------------------------------------------|
| **UI location**  | Inline panel / drawer next to the project form           |
| **Visibility**   | NGO users only, only on Create Project / Edit Project    |
| **Mounting**     | Rendered inside the project form page component          |
| **Backend**      | `POST /api/ai/copilot/draft`                             |
| **Scope**        | Generates a structured draft — never writes to database  |
| **Approval**     | NGO reviews, edits, then explicitly submits via the normal project create/update endpoint |
| **Auth**         | NGO-only, verified server-side                            |

### Why Two Separate Endpoints

| Dimension       | `/api/ai/assistant/chat`        | `/api/ai/copilot/draft`        |
|-----------------|---------------------------------|--------------------------------|
| Auth scope      | Any authenticated role          | NGO only                       |
| Grounding data  | NGO docs (RAG) or public data   | None (generates from brief)    |
| Output type     | Free-text answer + sources      | Zod-validated structured draft |
| Side effects    | None (read-only)                | None (draft only)              |
| UI surface      | Floating widget (global)        | Inline panel (project form)    |

They share `gemini.service.ts` and `embedding.service.ts` as internal dependencies, but remain separate HTTP endpoints.

---

## Service Abstraction Layer

All AI providers are hidden behind service abstractions. No other module directly calls Gemini or Hugging Face.

```
backend/src/modules/ai/services/

  gemini.service.ts      — LLM text generation (Gemini API)
  embedding.service.ts   — Embedding generation (Hugging Face Inference API)
  copilot.service.ts     — Project draft generation (uses gemini.service)
  rag.service.ts         — RAG query orchestration (uses embedding.service + gemini.service)
  matching.service.ts    — Matching embedding operations (uses embedding.service)
```

### `gemini.service.ts`

Wraps the Gemini API for text generation.

**Responsibilities:**
- Send a prompt + system instruction to Gemini
- Parse the response text
- Handle errors: timeout, rate limit, malformed response, empty response
- Enforce a request timeout (e.g., 30 seconds)

**Interface:**
```typescript
async function generateText(params: {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string>
```

**Error handling:**
- Timeout → throw `AIProviderError` with code `TIMEOUT`
- Rate limit → throw `AIProviderError` with code `RATE_LIMITED`
- Malformed → throw `AIProviderError` with code `MALFORMED_RESPONSE`
- Empty → throw `AIProviderError` with code `EMPTY_RESPONSE`
- Network → throw `AIProviderError` with code `NETWORK_ERROR`

---

### `embedding.service.ts`

Wraps the Hugging Face Inference API for embedding generation.

**Responsibilities:**
- Send text to HF and receive a `vector(384)` embedding
- Cache nothing (caching happens at the storage level in pgvector tables)
- Handle HF API errors gracefully

**Interface:**
```typescript
async function generateEmbedding(text: string): Promise<number[]>
async function generateEmbeddings(texts: string[]): Promise<number[][]>
```

**Model:** `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, free on HF Inference API)

**Important:** The Node.js server calls HF over HTTP. It never downloads or runs the model locally.

---

## Matching Pipeline

### Overview

```
                    GET /api/matching/volunteers/:projectId
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  1. Deterministic Filtering   │
                    │  (hard constraints)            │
                    └──────────────┬───────────────┘
                                   │ eligible candidates
                                   ▼
                    ┌──────────────────────────────┐
                    │  2. Multi-Factor Scoring      │
                    │  (weighted composite score)    │
                    └──────────────┬───────────────┘
                                   │ scored candidates
                                   ▼
                    ┌──────────────────────────────┐
                    │  3. Ranking + Explanation     │
                    │  (top-N with reason breakdown)│
                    └──────────────────────────────┘
```

### Step 1: Deterministic Filtering

Hard constraints that **must** pass before any scoring. A volunteer who fails any filter is excluded entirely.

```sql
-- Pseudocode for the filter query
SELECT v.* FROM volunteers v
WHERE
  -- Project must be published or active
  EXISTS (SELECT 1 FROM projects p WHERE p.id = :projectId AND p.status IN ('published', 'active'))
  -- Project must have remaining capacity
  AND (SELECT COUNT(*) FROM registrations r WHERE r.project_id = :projectId AND r.status = 'confirmed') < p.capacity
  -- Volunteer must not already be registered
  AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.volunteer_id = v.id AND r.project_id = :projectId)
  -- Volunteer must have completed onboarding
  AND v.onboarding_complete = true
  -- Eligibility: minimum age (if specified in project.eligibility.min_age)
  AND (p.eligibility->>'min_age')::int IS NULL
     OR v.date_of_birth <= CURRENT_DATE - (p.eligibility->>'min_age')::int * INTERVAL '1 year'
  -- Distance filter (if both have location): within 100km
  AND (v.location_lat IS NULL OR p.location_lat IS NULL
       OR haversine(v.lat, v.lng, p.lat, p.lng) <= 100)
```

### Step 2: Multi-Factor Scoring

For each candidate that passes deterministic filters, compute a composite score.

**Matching Score Formula:**

```
composite_score = (
    W_skills     × S_skills
  + W_interests  × S_interests
  + W_embedding  × S_embedding
  + W_distance   × S_distance
)
```

**Weights:**

| Factor         | Weight | Source                                          |
|----------------|--------|-------------------------------------------------|
| Skills match   | 0.35   | Deterministic set overlap                       |
| Interests match| 0.20   | Deterministic set overlap                       |
| Embedding sim. | 0.30   | pgvector cosine similarity                      |
| Distance       | 0.05   | Haversine formula (when locations available)     |

**Sum of weights = 1.00**

**Individual Score Calculations:**

**S_skills** — Jaccard similarity on required vs. offered skills:
```
S_skills = |volunteer.skills ∩ project.required_skills| / |volunteer.skills ∪ project.required_skills|
```
If both sets are empty: `S_skills = 0`.

**S_interests** — Jaccard similarity on interests vs. project category + related tags:
```
S_interests = |volunteer.interests ∩ project_tags| / |volunteer.interests ∪ project_tags|
```
Where `project_tags = [project.category, ...any_interest_tags_from_project]`. If both sets are empty: `S_interests = 0`.

**S_embedding** — Cosine similarity from pgvector:
```sql
SELECT 1 - (ve.embedding <=> pe.embedding) AS similarity
FROM volunteer_embeddings ve, project_embeddings pe
WHERE ve.volunteer_id = :volunteerId AND pe.project_id = :projectId
```
If either embedding is missing: `S_embedding = 0` (and trigger async embedding generation).

**S_availability** — Compatibility score:
```
If project specifies required days:
  matched_days = |volunteer.availability.days ∩ project.required_days| / |project.required_days|
  S_availability = matched_days
Else:
  S_availability = 1.0 (no constraint → fully available)
```

**S_distance** — Proximity score (when both locations are known):
```
distance_km = haversine(volunteer.lat, volunteer.lng, project.lat, project.lng)
S_distance = max(0, 1 - distance_km / 50)
```
If either location is missing: `S_distance = 0.5` (neutral — neither rewarded nor penalized).

### Step 3: Ranking + Explanation

- Sort candidates by `composite_score` descending.
- Return top-N (default 20, configurable via `?limit=`).
- Each result includes a `reasons` object with per-factor breakdown:
  - `skills_match`: which skills matched, which are missing
  - `interests_match`: which interests aligned
  - `embedding_similarity`: raw cosine similarity value
  - `availability_match`: whether days align
  - `distance_km`: actual distance (when available)

### Embedding Lifecycle

Embeddings are **not** generated on every matching request. They are generated/updated on data changes:

| Trigger                            | Action                                         |
|------------------------------------|------------------------------------------------|
| Volunteer profile created/updated  | Regenerate `volunteer_embeddings`              |
| Volunteer skills changed           | Regenerate `volunteer_embeddings`              |
| Project created/published          | Generate `project_embeddings`                  |
| Project description/skills changed | Regenerate `project_embeddings`                |

**Embedding input text construction:**

Volunteer:
```
"Skills: {skills joined}. Interests: {interests joined}. Experience: {experience}. "
```

Project:
```
"Title: {title}. Category: {category}. Description: {description}. Required skills: {skills joined}. Responsibilities: {responsibilities joined}"
```

**Change detection:** Store a `content_hash` (SHA-256 of input text). On update, only regenerate if the hash changed.

---

## Project Copilot Flow

```
┌────────────┐         ┌────────────────┐         ┌───────────────┐
│ NGO User   │         │ copilot.service│         │ gemini.service│
│            │         │                │         │               │
│ Types brief├────────►│ Build prompt   ├────────►│ Generate text │
│ in panel   │         │ with schema    │         │ from Gemini   │
│            │         │ instructions   │         │               │
│            │◄────────┤ Parse + Zod    │◄────────┤ Return text   │
│ Reviews    │         │ validate       │         │               │
│ draft in   │         │                │         └───────────────┘
│ the panel  │         └────────────────┘
│            │
│ Edits and  │
│ Approves   │──────► POST /api/projects (normal create endpoint)
│            │         (writes to DB)
└────────────┘
```

**Copilot prompt design:**

```
System: You are a project planning assistant for a volunteer platform.
Given a brief description of a volunteer project, generate a structured
project draft. Return ONLY valid JSON matching this schema:
{ title, description, category, required_skills[], responsibilities[],
  eligibility: { min_age?, custom_requirements[]? }, capacity }

User: {brief from NGO}
```

**Zod validation schema for Copilot output:**

```typescript
const CopilotDraftSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  required_skills: z.array(z.string()).min(1).max(20),
  responsibilities: z.array(z.string()).min(1).max(20),
  eligibility: z.object({
    min_age: z.number().int().min(0).max(100).optional(),
    custom_requirements: z.array(z.string()).max(10).optional(),
  }),
  capacity: z.number().int().min(1).max(500),
});
```

If validation fails, return `502` with a message asking the user to try again or rephrase.

---

## RAG (Retrieval-Augmented Generation) Flow

### Document Ingestion Pipeline

```
NGO uploads document
        │
        ▼
  POST /api/knowledge/documents
  (multipart/form-data)
        │
        ▼
  1. Save file to Supabase Storage
     Path: knowledge/{ngo_id}/{document_id}/{filename}
        │
        ▼
  2. Update document status → 'processing'
        │
        ▼
  3. Extract text from document
     Supported formats: PDF, TXT, DOCX
     (Use pdf-parse for PDF, mammoth for DOCX, native for TXT)
        │
        ▼
  4. Chunk extracted text
     - Chunk size: ~500 tokens
     - Overlap: ~50 tokens
     - Store chunk_index for ordering
        │
        ▼
  5. Generate embeddings for each chunk
     Call embedding.service.ts → HF API
     (Batch: max 10 chunks per HF request to avoid rate limits)
        │
        ▼
  6. Store chunks + embeddings in knowledge_chunks table
        │
        ▼
  7. Update document status → 'ready', set chunk_count
     (On any failure → status = 'failed', set error_message)
```

**MVP bounds:**
- Max file size: 10 MB
- Supported formats: PDF, TXT, DOCX
- Max chunks per document: 200
- Ingestion runs synchronously in the request (acceptable for MVP with bounded file sizes)

### Query Pipeline

```
User asks question in floating widget
        │
        ▼
  POST /api/ai/assistant/chat { message }
        │
        ▼
  Auth middleware → resolve user role + identity
        │
        ├─── If NGO caller:
        │         │
        │         ▼
        │    1. Generate question embedding (embedding.service.ts)
        │         │
        │         ▼
        │    2. pgvector similarity search:
        │       SELECT content, file_name, chunk_index,
        │              1 - (embedding <=> :questionEmbedding) AS similarity
        │       FROM knowledge_chunks kc
        │       JOIN knowledge_documents kd ON kc.document_id = kd.id
        │       WHERE kd.ngo_id = :ngoId AND kd.status = 'ready'
        │       ORDER BY kc.embedding <=> :questionEmbedding
        │       LIMIT 5
        │         │
        │         ▼
        │    3. Build grounded prompt:
        │       "Answer ONLY based on the following context. If the context
        │        doesn't contain enough information, say so.
        │        Context: {retrieved chunks}
        │        Question: {user message}"
        │         │
        │         ▼
        │    4. Call gemini.service.ts → generate answer
        │         │
        │         ▼
        │    5. Return answer + source references
        │
        ├─── If Volunteer caller:
        │         │
        │         ▼
        │    1. Fetch relevant public data (projects, NGOs)
        │         based on the question (simple text search or
        │         keyword extraction for MVP)
        │         │
        │         ▼
        │    2. Build context prompt with public data
        │         │
        │         ▼
        │    3. Call gemini.service.ts → generate answer
        │         │
        │         ▼
        │    4. Return answer (no RAG sources for volunteers)
        │
        ▼
  Response: { answer, sources? }
```

**Grounding rules:**
- NGO answers are grounded **only** in retrieved chunks. Never invent facts.
- If top-K similarity scores are all below a threshold (e.g., < 0.5), respond: "The available knowledge base does not contain enough information to answer this question."
- Volunteer answers use public project/NGO data as context.
- Both callers: the assistant can answer general platform questions (how to register, how matching works, etc.) using a static FAQ context injected into the system prompt.

---

## Impact Narrative Generation

```
POST /api/impact/ngo/narrative
        │
        ▼
  1. Compute verified metrics from DB
     (total hours, volunteers, projects, categories)
        │
        ▼
  2. Build metrics summary prompt:
     "Write a brief, warm impact summary for {NGO name} based on
      these verified metrics: {metrics}. Keep it under 200 words."
        │
        ▼
  3. Call gemini.service.ts → generate narrative
        │
        ▼
  4. Return narrative text
```

This is a simple one-shot generation. No RAG. The metrics are the grounding.

---

## Error Handling Strategy

All AI operations follow the same error handling pattern:

```typescript
try {
  const result = await aiService.operation(input);
  return result;
} catch (error) {
  if (error instanceof AIProviderError) {
    // Log the error for debugging
    logger.warn('AI provider error', { type: error.code, details: error.message });

    // Return a graceful fallback — never crash the core app
    switch (error.code) {
      case 'TIMEOUT':
        throw new AppError(504, 'AI service is taking too long. Please try again.');
      case 'RATE_LIMITED':
        throw new AppError(429, 'AI service is busy. Please try again shortly.');
      case 'MALFORMED_RESPONSE':
      case 'EMPTY_RESPONSE':
        throw new AppError(502, 'AI returned an unexpected response. Please try again.');
      default:
        throw new AppError(502, 'AI service is temporarily unavailable.');
    }
  }
  throw error; // non-AI errors propagate normally
}
```

**Key principle:** An AI failure must never corrupt core application data or prevent non-AI features from working. Matching still returns deterministic scores even if embeddings are unavailable. The dashboard still shows metrics even if narrative generation fails.
