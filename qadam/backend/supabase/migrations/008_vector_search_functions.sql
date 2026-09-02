-- 008: Vector similarity search RPC functions
-- Used by matching.service.ts and rag.service.ts for nearest-neighbor queries.

-- =============================================================================
-- match_volunteers: find similar volunteers by embedding cosine similarity
-- =============================================================================
CREATE OR REPLACE FUNCTION match_volunteers(
    query_embedding vector(384),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    volunteer_id uuid,
    similarity float
)
LANGUAGE sql
STABLE
AS $func$
    SELECT
        ve.volunteer_id,
        1 - (ve.embedding <=> query_embedding) AS similarity
    FROM volunteer_embeddings ve
    WHERE 1 - (ve.embedding <=> query_embedding) > match_threshold
    ORDER BY ve.embedding <=> query_embedding
    LIMIT match_count;
$func$;

-- =============================================================================
-- match_projects: find similar projects by embedding cosine similarity
-- =============================================================================
CREATE OR REPLACE FUNCTION match_projects(
    query_embedding vector(384),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    project_id uuid,
    similarity float
)
LANGUAGE sql
STABLE
AS $func$
    SELECT
        pe.project_id,
        1 - (pe.embedding <=> query_embedding) AS similarity
    FROM project_embeddings pe
    WHERE 1 - (pe.embedding <=> query_embedding) > match_threshold
    ORDER BY pe.embedding <=> query_embedding
    LIMIT match_count;
$func$;

-- =============================================================================
-- match_knowledge_chunks: RAG retrieval - find relevant chunks for an NGO
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
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM knowledge_chunks kc
    WHERE kc.ngo_id = ngo_uuid
      AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
$func$;
