-- 007: volunteer_embeddings and project_embeddings tables
-- Cached semantic embeddings for matching (384-dim, HF all-MiniLM-L6-v2).

-- =============================================================================
-- volunteer_embeddings
-- =============================================================================
CREATE TABLE volunteer_embeddings (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id    UUID        NOT NULL UNIQUE REFERENCES volunteers (id) ON DELETE CASCADE,
    embedding       vector(384) NOT NULL,
    content_hash    TEXT        NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_volunteer_embeddings_embedding
    ON volunteer_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- =============================================================================
-- project_embeddings
-- =============================================================================
CREATE TABLE project_embeddings (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID        NOT NULL UNIQUE REFERENCES projects (id) ON DELETE CASCADE,
    embedding       vector(384) NOT NULL,
    content_hash    TEXT        NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_embeddings_embedding
    ON project_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
