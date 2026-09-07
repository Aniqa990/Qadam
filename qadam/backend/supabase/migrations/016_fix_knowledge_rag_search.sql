-- 016: Harden knowledge RAG vector search
--
-- IVFFlat indexes created on empty tables (migration 006) can miss neighbors.
-- Keep the functions as plain STABLE SQL (no SET LOCAL — that is illegal in
-- non-VOLATILE functions and aborts the RPC). Guard null embeddings and
-- rebuild the vector index so approximate scans see current rows.

-- =============================================================================
-- match_knowledge_chunks: NGO-scoped RAG retrieval
-- =============================================================================
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(384),
    ngo_uuid uuid,
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    chunk_id uuid,
    content text,
    document_id uuid,
    similarity float
)
LANGUAGE sql
STABLE
AS $func$
    SELECT
        kc.id AS chunk_id,
        kc.content,
        kc.document_id,
        (1 - (kc.embedding <=> query_embedding))::float AS similarity
    FROM knowledge_chunks kc
    WHERE kc.ngo_id = ngo_uuid
      AND kc.embedding IS NOT NULL
      AND (1 - (kc.embedding <=> query_embedding)) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
$func$;

-- =============================================================================
-- match_public_knowledge: volunteer path (all NGOs)
-- =============================================================================
CREATE OR REPLACE FUNCTION match_public_knowledge(
    query_embedding vector(384),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    chunk_id uuid,
    content text,
    document_id uuid,
    ngo_id uuid,
    similarity float
)
LANGUAGE sql
STABLE
AS $func$
    SELECT
        kc.id AS chunk_id,
        kc.content,
        kc.document_id,
        kc.ngo_id,
        (1 - (kc.embedding <=> query_embedding))::float AS similarity
    FROM knowledge_chunks kc
    WHERE kc.embedding IS NOT NULL
      AND (1 - (kc.embedding <=> query_embedding)) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
$func$;

-- Rebuild IVFFlat so index scans see rows inserted after the empty-table create.
REINDEX INDEX idx_knowledge_chunks_embedding;
