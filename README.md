# Qadam

AI-powered social-good volunteer platform connecting NGOs with suitable
volunteers and measuring community impact.

This is the **Phase 1 scaffold** (see `implementation-plan.md`): project
structure, tooling, and configuration only — no application features yet.

## Stack

- **Frontend**: React + Vite + TypeScript, React Router, Tailwind CSS, shadcn/ui
- **Backend**: Node.js + TypeScript + Express (layered: routes → middleware → validators → controllers → services)
- **Database**: Supabase PostgreSQL + pgvector
- **Auth**: Clerk
- **LLM**: Gemini (primary) → Qwen/DashScope (fallback), behind `llm.service.ts`
- **Embeddings**: Hugging Face Inference API
- **Maps/Geocoding**: MapLibre GL + OpenFreeMap, BigDataCloud reverse geocoding

## Getting started

### 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (enable the `pgvector` extension)
- A [Clerk](https://clerk.com) application
- Free-tier API keys: [Gemini](https://ai.google.dev/), [DashScope/Qwen](https://dashscope.console.aliyun.com/), [Hugging Face](https://huggingface.co/settings/tokens), [BigDataCloud](https://www.bigdatacloud.com/)

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in the values. Never commit `.env` — see `AGENTS.md` for the full list
of required variables and which ones must never reach the frontend.

### 4. Run both apps

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

- Backend: http://localhost:4000 (health check at `/api/health`)
- Frontend: http://localhost:5173 (proxies `/api/*` to the backend)

### 5. Verify Phase 1

- [ ] `GET http://localhost:4000/api/health` returns `{ success: true, data: { status: "ok", ... } }`
- [ ] Frontend loads at `localhost:5173` and displays the backend health check
- [ ] Backend refuses to start with a clear error if any required `.env` value is missing (try removing one)
- [ ] No secrets appear in any `VITE_`-prefixed variable

## Phase 2: Clerk Authentication

### 1. Run the profiles migration

Phase 2's webhook needs somewhere to write, so `volunteers`/`ngos` are pulled
forward from Phase 3 now (full Phase 3 migration adds the rest of the
schema later). In the Supabase SQL editor, run:

```
backend/migrations/0001_profiles.sql
```

### 2. Configure the Clerk webhook

Clerk needs a **publicly reachable URL** to call `POST /api/auth/webhook` -
`localhost` won't work directly during local dev. Use a tunnel:

```bash
# in a third terminal, with the backend running on :4000
ngrok http 4000
```

Then in the Clerk dashboard (**Configure → Webhooks**):

1. Add endpoint: `https://<your-ngrok-subdomain>.ngrok.app/api/auth/webhook`
2. Subscribe to the `user.created` event
3. Copy the **Signing Secret** into `backend/.env` as `CLERK_WEBHOOK_SECRET`

### 3. Test the flow

1. Go to `http://localhost:5173/register`
2. Choose **Volunteer** or **NGO**
3. Complete Clerk's sign-up form
4. Clerk fires `user.created` → your backend webhook creates the matching
   row in `volunteers`/`ngos` and promotes `role` from `unsafeMetadata` to
   `publicMetadata`
5. You should land on `/` and see "Signed in as volunteer" (or `ngo`)

### 4. Verify Phase 2

- [ ] Signing up as a Volunteer creates a row in `volunteers` with the right `auth_user_id`
- [ ] Signing up as an NGO creates a row in `ngos` instead
- [ ] `GET /api/auth/me` (with a valid session token) returns `{ id, email, role, profile }`
- [ ] Hitting a protected route while signed out redirects to `/login`
- [ ] A volunteer visiting `/ngo/onboarding` gets redirected away (and vice versa)
- [ ] Webhook requests with an invalid/missing svix signature are rejected (401)


## Project structure

See `architecture.md` for the full system diagram and module boundaries, and
`implementation-plan.md` for the phased build order.

## Development rules

See `AGENTS.md` before making changes — it defines the architecture
conventions (layering, AI provider abstraction, security rules) this
codebase must follow.
