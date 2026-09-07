import { supabase } from "../../lib/supabase";
import { AIProviderError, AppError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { generateEmbedding } from "./embedding.service";
import * as llm from "./llm.service";

/**
 * RAG query orchestration (ai-architecture.md "rag.service.ts").
 *
 * POST /api/ai/assistant/chat — Global Knowledge Assistant:
 *   - NGO callers: embed the question, pgvector similarity search scoped to
 *     that NGO's own document chunks, grounded LLM answer with sources.
 *   - Volunteer callers: answer from public project/NGO data (no private RAG).
 *   - Caller role/identity resolved server-side from the session.
 *   - If retrieval finds nothing relevant, return an explicit "not enough
 *     information" answer — never let the LLM invent policy.
 *   - Returns { answer, sources } with document/chunk references.
 */

// -- Config --------------------------------------------------------------------

/**
 * Minimum cosine similarity to consider a chunk relevant.
 * MiniLM cosine scores for on-topic Q↔chunk pairs often land ~0.25–0.55;
 * 0.45 was filtering valid hits to an empty set.
 */
const RAG_SIMILARITY_THRESHOLD = 0.28;

/** Maximum number of chunks to retrieve per query. */
const RAG_MAX_CHUNKS = 5;

/** Maximum active projects to include as volunteer context. */
const VOLUNTEER_CONTEXT_PROJECTS = 5;

// -- Types ---------------------------------------------------------------------

export interface ChatSource {
  document_id: string;
  chunk_id: string;
  file_name: string;
  similarity: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

type MatchedChunk = {
  chunk_id: string;
  content: string;
  document_id: string;
  similarity: number;
  ngo_id?: string;
};

// -- System prompts ------------------------------------------------------------

const SHARED_SYSTEM =
  "You are Qadam Assistant, a helpful guide for a volunteer platform " +
  "connecting NGOs with volunteers. Be concise, warm, and factual. " +
  "Never invent information. If you cannot answer from the provided " +
  "context, say so clearly. " +
  "Format answers for a chat bubble: short paragraphs, optional bullet " +
  "lists with '- ' markers, and **bold** only for key terms. " +
  "Do not put bare file names on their own line. Cite sources once in " +
  "prose (e.g. 'According to HopeReach Foundation's rural education " +
  "framework…') — the UI already shows source chips separately.";

const NGO_SYSTEM =
  `${SHARED_SYSTEM} ` +
  "You are answering questions for an NGO user. Ground your answer ONLY " +
  "in the retrieved knowledge-base chunks provided below. If the chunks do " +
  "not contain enough information to answer the question, respond exactly: " +
  '"The available knowledge base does not contain enough information to ' +
  'answer this question."';

const VOLUNTEER_SYSTEM =
  `${SHARED_SYSTEM} ` +
  "You are answering questions for a volunteer user. Ground your answer " +
  "in the public project data and NGO knowledge-base content provided below. " +
  "If the context does not contain enough information, say so clearly. " +
  "You may also answer general platform questions (how to register, how " +
  "matching works, etc.) from your own knowledge. " +
  "When drawing on NGO documents, name the organization naturally in the " +
  "sentence — do not append raw .pdf filenames at the end.";

// -- Public API ----------------------------------------------------------------

/**
 * Handle a chat message. Resolves caller role from req.identity (never
 * from a client flag) and routes to NGO RAG or volunteer context path.
 */
export async function chatAssistant(
  identity: { role: string; domainId: string },
  message: string
): Promise<ChatResponse> {
  if (identity.role === "ngo") {
    return chatForNgo(identity.domainId, message);
  }
  return chatForVolunteer(message);
}

// -- Vector search helpers -----------------------------------------------------

function formatEmbeddingForRpc(embedding: number[]): string {
  // pgvector accepts the canonical text form "[0.1,0.2,...]".
  return `[${embedding.join(",")}]`;
}

/**
 * NGO-scoped RAG retrieval via match_knowledge_chunks.
 * Always requires a real NGO UUID — never omit ngo_uuid (NULL filter
 * matches zero rows in SQL because ngo_id = NULL is unknown).
 */
async function searchNgoKnowledgeChunks(
  ngoId: string,
  questionEmbedding: number[]
): Promise<MatchedChunk[]> {
  if (!ngoId || typeof ngoId !== "string") {
    throw new AppError(
      "NGO identity is required for knowledge search",
      401,
      "AUTHENTICATION_ERROR"
    );
  }

  const queryEmbedding = formatEmbeddingForRpc(questionEmbedding);
  const params = {
    query_embedding: queryEmbedding,
    ngo_uuid: ngoId,
    match_threshold: RAG_SIMILARITY_THRESHOLD,
    match_count: RAG_MAX_CHUNKS,
  };

  console.log("[RAG] match_knowledge_chunks request", {
    ngo_uuid: params.ngo_uuid,
    match_threshold: params.match_threshold,
    match_count: params.match_count,
    embeddingDimensions: questionEmbedding.length,
  });

  const { data: chunks, error } = await supabase.rpc("match_knowledge_chunks", params);

  const matched = (chunks ?? []) as MatchedChunk[];

  console.log("[RAG] match_knowledge_chunks response", {
    ngo_uuid: params.ngo_uuid,
    chunkCount: matched.length,
    topSimilarity: matched[0]?.similarity ?? null,
    error: error?.message ?? null,
  });

  if (error) {
    logger.error("RAG chunk retrieval failed", {
      error: error.message,
      ngoId,
      embeddingDimensions: questionEmbedding.length,
    });
    throw new AppError(
      "Failed to search the knowledge base. Please try again.",
      500,
      "RAG_RETRIEVAL_ERROR"
    );
  }

  if (matched.length === 0) {
    // Distinguish "no docs for this NGO" vs "docs exist but below threshold".
    const { count, error: countError } = await supabase
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("ngo_id", ngoId);

    console.log("[RAG] zero hits diagnostic", {
      ngo_uuid: ngoId,
      storedChunkCount: countError ? null : count,
      countError: countError?.message ?? null,
      match_threshold: RAG_SIMILARITY_THRESHOLD,
    });
  }

  return matched;
}

/** Cross-NGO public knowledge search for volunteer callers. */
async function searchPublicKnowledgeChunks(
  questionEmbedding: number[]
): Promise<MatchedChunk[]> {
  const queryEmbedding = formatEmbeddingForRpc(questionEmbedding);
  const params = {
    query_embedding: queryEmbedding,
    match_threshold: RAG_SIMILARITY_THRESHOLD,
    match_count: RAG_MAX_CHUNKS,
  };

  console.log("[RAG] match_public_knowledge request", {
    match_threshold: params.match_threshold,
    match_count: params.match_count,
    embeddingDimensions: questionEmbedding.length,
  });

  const { data: knowledgeChunks, error } = await supabase.rpc(
    "match_public_knowledge",
    params
  );

  const matched = (knowledgeChunks ?? []) as MatchedChunk[];

  console.log("[RAG] match_public_knowledge response", {
    chunkCount: matched.length,
    topSimilarity: matched[0]?.similarity ?? null,
    error: error?.message ?? null,
  });

  if (error) {
    logger.warn("Public knowledge search failed; continuing with projects only", {
      error: error.message,
    });
    return [];
  }

  return matched;
}

// -- NGO path (RAG) ------------------------------------------------------------

async function chatForNgo(
  ngoId: string,
  message: string
): Promise<ChatResponse> {
  // 1. Embed the question.
  const questionEmbedding = await generateEmbedding(message);

  // 2. pgvector similarity search scoped to this NGO's chunks.
  const matchedChunks = await searchNgoKnowledgeChunks(ngoId, questionEmbedding);

  // 3. If nothing relevant was found, return an explicit fallback.
  if (matchedChunks.length === 0) {
    return {
      answer:
        "The available knowledge base does not contain enough information to answer this question.",
      sources: [],
    };
  }

  // 4. Resolve file names from the document rows.
  const documentIds = [...new Set(matchedChunks.map((c) => c.document_id))];
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id, file_name")
    .in("id", documentIds);

  const fileNameMap = new Map<string, string>();
  for (const doc of (docs ?? []) as { id: string; file_name: string }[]) {
    fileNameMap.set(doc.id, doc.file_name);
  }

  // 5. Build grounded prompt with retrieved chunks.
  const contextText = matchedChunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} — ${fileNameMap.get(c.document_id) ?? "Unknown document"}]\n${c.content}`
    )
    .join("\n\n");

  const prompt =
    `Context (retrieved knowledge-base chunks):\n${contextText}\n\n` +
    `Question: ${message}`;

  // 6. Call LLM (Gemini first, Qwen fallback).
  const answer = await callLLMSafely({
    prompt,
    systemInstruction: NGO_SYSTEM,
    temperature: 0.3,
    maxTokens: 1024,
  });

  // 7. Build sources list.
  const sources: ChatSource[] = matchedChunks.map((c) => ({
    document_id: c.document_id,
    chunk_id: c.chunk_id,
    file_name: fileNameMap.get(c.document_id) ?? "Unknown document",
    similarity: c.similarity,
  }));

  return { answer, sources };
}

// -- Volunteer path (public context, no private RAG) ---------------------------

async function chatForVolunteer(message: string): Promise<ChatResponse> {
  // 1. Embed the question for knowledge-base search.
  const questionEmbedding = await generateEmbedding(message);

  // 2. Fetch relevant public project data as context.
  const { data: projects } = await supabase
    .from("projects")
    .select("title, category, description, location_name, required_skills, ngo_id")
    .in("status", ["upcoming", "active"])
    .order("created_at", { ascending: false })
    .limit(VOLUNTEER_CONTEXT_PROJECTS);

  // 3. Search public knowledge chunks across ALL NGOs via pgvector.
  const matchedChunks = await searchPublicKnowledgeChunks(questionEmbedding);

  // 4. Resolve NGO names and document file names.
  const ngoIds = [
    ...new Set([
      ...(projects ?? [])
        .map((p) => (p as { ngo_id: string }).ngo_id)
        .filter(Boolean),
      ...matchedChunks.map((c) => c.ngo_id).filter(Boolean),
    ]),
  ] as string[];
  const { data: ngos } = ngoIds.length
    ? await supabase.from("ngos").select("id, name").in("id", ngoIds)
    : { data: [] };

  const ngoNameMap = new Map<string, string>();
  for (const ngo of (ngos ?? []) as { id: string; name: string }[]) {
    ngoNameMap.set(ngo.id, ngo.name);
  }

  // Resolve document file names for matched chunks.
  const docIds = [...new Set(matchedChunks.map((c) => c.document_id))];
  const { data: docs } = docIds.length
    ? await supabase
        .from("knowledge_documents")
        .select("id, file_name, ngo_id")
        .in("id", docIds)
    : { data: [] };

  const fileNameMap = new Map<string, string>();
  const docNgoMap = new Map<string, string>();
  for (const doc of (docs ?? []) as {
    id: string;
    file_name: string;
    ngo_id: string;
  }[]) {
    fileNameMap.set(doc.id, doc.file_name);
    docNgoMap.set(doc.id, doc.ngo_id);
  }

  // 5. Build context text from public project data.
  const contextParts: string[] = [];

  if (projects && projects.length > 0) {
    const projectText = (projects as Record<string, unknown>[])
      .map((p, i) => {
        const skills = Array.isArray(p.required_skills)
          ? (p.required_skills as string[]).join(", ")
          : "";
        return (
          `[Project ${i + 1}]\n` +
          `Title: ${p.title}\n` +
          `Category: ${p.category}\n` +
          `NGO: ${ngoNameMap.get(p.ngo_id as string) ?? "Unknown"}\n` +
          `Location: ${(p.location_name as string) ?? "Not specified"}\n` +
          `Skills: ${skills || "None specified"}\n` +
          `Description: ${(p.description as string).slice(0, 300)}`
        );
      })
      .join("\n\n");
    contextParts.push(`--- Public Projects ---\n${projectText}`);
  } else {
    contextParts.push("--- Public Projects ---\nNo active projects are currently available.");
  }

  // 6. Build context text from matched knowledge chunks.
  if (matchedChunks.length > 0) {
    const knowledgeText = matchedChunks
      .map((c, i) => {
        const ngoName =
          ngoNameMap.get(docNgoMap.get(c.document_id) ?? c.ngo_id ?? "") ??
          "Unknown NGO";
        const fileName = fileNameMap.get(c.document_id) ?? "Unknown document";
        return `[Knowledge ${i + 1} — ${ngoName}: ${fileName}]\n${c.content}`;
      })
      .join("\n\n");
    contextParts.push(`--- NGO Knowledge Base ---\n${knowledgeText}`);
  }

  const contextText = contextParts.join("\n\n");

  const prompt =
    `Public data:\n${contextText}\n\n` +
    `Question: ${message}`;

  // 7. Call LLM (Gemini first, Qwen fallback).
  const answer = await callLLMSafely({
    prompt,
    systemInstruction: VOLUNTEER_SYSTEM,
    temperature: 0.4,
    maxTokens: 1024,
  });

  // 8. Build sources list from matched knowledge chunks.
  const sources: ChatSource[] = matchedChunks.map((c) => ({
    document_id: c.document_id,
    chunk_id: c.chunk_id,
    file_name: fileNameMap.get(c.document_id) ?? "Unknown document",
    similarity: c.similarity,
  }));

  return { answer, sources };
}

// -- Helpers -------------------------------------------------------------------

/**
 * Call the LLM with graceful error handling. AI failures return a clear
 * fallback message rather than crashing the request.
 */
async function callLLMSafely(params: llm.GenerateTextParams): Promise<string> {
  try {
    return await llm.generateText(params);
  } catch (err) {
    if (err instanceof AIProviderError) {
      logger.warn("LLM generation failed in RAG pipeline", {
        code: err.code,
        message: err.message,
      });
      return (
        "I'm sorry, I was unable to generate a response at this time. " +
        "Please try again in a moment."
      );
    }
    throw err;
  }
}
