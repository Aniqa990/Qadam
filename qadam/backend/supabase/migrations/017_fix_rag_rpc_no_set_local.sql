-- 017: Fix RAG RPCs broken by SET LOCAL inside STABLE functions
-- Error observed: "SET is not allowed in a non-volatile function"
-- which caused match_public_knowledge / match_knowledge_chunks to return
-- zero chunks for every volunteer/NGO assistant query.

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

REINDEX INDEX idx_knowledge_chunks_embedding;
