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

## Project structure

See `architecture.md` for the full system diagram and module boundaries, and
`implementation-plan.md` for the phased build order.

## Development rules

See `AGENTS.md` before making changes — it defines the architecture
conventions (layering, AI provider abstraction, security rules) this
codebase must follow.
