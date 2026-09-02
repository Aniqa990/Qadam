-- 006: knowledge_documents and knowledge_chunks tables

-- =============================================================================
-- knowledge_documents
-- Documents uploaded by NGOs for RAG.
-- =============================================================================
CREATE TABLE knowledge_documents (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    ngo_id          UUID            NOT NULL REFERENCES ngos (id),
    file_name       TEXT            NOT NULL,
    file_type       TEXT            NOT NULL,
    file_size       INTEGER         NOT NULL,
    storage_path    TEXT            NOT NULL,
    status          document_status NOT NULL DEFAULT 'uploaded',
    chunk_count     INTEGER         DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT chk_knowledge_file_size CHECK (file_size <= 10485760)
);

CREATE INDEX idx_knowledge_documents_ngo_id ON knowledge_documents (ngo_id);
CREATE INDEX idx_knowledge_documents_status ON knowledge_documents (status);

-- =============================================================================
-- knowledge_chunks
-- Text chunks with embeddings for RAG similarity search.
-- =============================================================================
CREATE TABLE knowledge_chunks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID        NOT NULL REFERENCES knowledge_documents (id) ON DELETE CASCADE,
    ngo_id          UUID        NOT NULL REFERENCES ngos (id),
    chunk_index     INTEGER     NOT NULL,
    content         TEXT        NOT NULL,
    embedding       vector(384),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_chunk_document_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_knowledge_chunks_document_id ON knowledge_chunks (document_id);
CREATE INDEX idx_knowledge_chunks_ngo_id      ON knowledge_chunks (ngo_id);

-- Vector index: ivfflat with 10 lists (tune after data is populated).
CREATE INDEX idx_knowledge_chunks_embedding
    ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
