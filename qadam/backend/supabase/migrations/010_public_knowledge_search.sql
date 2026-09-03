-- 010: Public knowledge search for volunteer assistant queries
-- Allows volunteers to search across all NGOs' published knowledge chunks.

-- =============================================================================
-- match_public_knowledge: search knowledge chunks across ALL NGOs
-- Used by the volunteer chat path to answer questions about NGO data.
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
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM knowledge_chunks kc
    WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
$func$;
