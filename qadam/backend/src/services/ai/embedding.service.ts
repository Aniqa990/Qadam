import { createHash } from "node:crypto";
import { aiConfig } from "../../config/ai";
import { supabase } from "../../lib/supabase";
import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";

/**
 * Embedding generation via the Hugging Face Inference API
 * (ai-architecture.md "embedding.service.ts").
 *
 * Responsibilities:
 *   - Call HF feature-extraction endpoint over HTTP (never run a model locally)
 *   - Build the canonical input text for volunteer / project embeddings
 *   - Detect content changes via SHA-256 content_hash (skip when unchanged)
 *   - Upsert vectors into volunteer_embeddings / project_embeddings
 *   - Throw typed AIProviderError on any HF failure so callers can
 *     log-and-continue without corrupting core application data
 *
 * Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions, free tier)
 */

/** HF Inference API request timeout in ms. */
const HF_TIMEOUT_MS = 30_000;

/** Expected embedding dimensionality for the configured model. */
const EXPECTED_DIMENSIONS = 384;

// -- Types ---------------------------------------------------------------------

export type EmbeddingVector = number[];

// -- Hugging Face Inference API wrapper ----------------------------------------

/**
 * Call the Hugging Face feature-extraction pipeline for a single text.
 * Tries the new Inference Providers endpoint (router.huggingface.co) first,
 * then falls back to the legacy api-inference endpoint if the primary has
 * a network error (DNS, connection refused, etc.).
 *
 * Throws AIProviderError on timeout, rate limit, malformed response,
 * empty response, or network error.
 */

/** Check whether a real HF token is configured (not a placeholder). */
function hasValidHfToken(): boolean {
  const token = aiConfig.huggingFace.token;
  return !!token && token !== "placeholder" && token.length > 8;
}

/** Build the request body shared by both HF endpoints. */
function buildHfBody(text: string): string {
  return JSON.stringify({ inputs: text, options: { wait_for_model: true } });
}

/** Build common request headers. */
function buildHfHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${aiConfig.huggingFace.token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Attempt a single fetch call to a HF endpoint.
 * Returns the Response on success or a typed error on network/timeout failure.
 */
async function hfFetch(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AIProviderError("TIMEOUT", "huggingface", "HF embedding request timed out");
    }
    // Re-throw as a generic network error — caller decides whether to
    // retry the fallback endpoint or propagate.
    throw new AIProviderError(
      "NETWORK_ERROR",
      "huggingface",
      err instanceof Error ? err.message : "Unknown network error"
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function generateEmbedding(text: string): Promise<EmbeddingVector> {
  if (!text.trim()) {
    throw new AIProviderError(
      "EMPTY_RESPONSE",
      "huggingface",
      "Cannot generate embedding for empty text"
    );
  }

  if (!hasValidHfToken()) {
    throw new AIProviderError(
      "NETWORK_ERROR",
      "huggingface",
      "HF_TOKEN is not configured. Set a valid Hugging Face API token in .env to enable embeddings."
    );
  }

  const model = aiConfig.huggingFace.embeddingModel;
  const body = buildHfBody(text);
  const headers = buildHfHeaders();

  // Primary: new Inference Providers endpoint (router.huggingface.co).
  // Fallback: legacy api-inference endpoint.
  const endpoints = [
    `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`,
    `https://api-inference.huggingface.co/models/${model}`,
  ];

  let response: Response | undefined;
  let lastError: AIProviderError | undefined;

  for (const url of endpoints) {
    try {
      response = await hfFetch(url, body, headers);
      break; // got a response (may still be non-2xx — handled below)
    } catch (err) {
      // Network/timeout error — try the next endpoint.
      lastError = err instanceof AIProviderError ? err : undefined;
      if (lastError?.code === "TIMEOUT") throw lastError; // no point retrying a timeout
      logger.warn("HF endpoint unreachable, trying fallback", {
        url,
        error: lastError?.message ?? "unknown",
      });
    }
  }

  if (!response) {
    // Both endpoints failed at the network level
    throw lastError ?? new AIProviderError(
      "NETWORK_ERROR",
      "huggingface",
      "All HF embedding endpoints are unreachable"
    );
  }

  if (response.status === 429) {
    throw new AIProviderError("RATE_LIMITED", "huggingface", "HF rate limit exceeded");
  }
  if (response.status === 503) {
    throw new AIProviderError(
      "RATE_LIMITED",
      "huggingface",
      "HF model is loading, try again shortly"
    );
  }
  if (!response.ok) {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "huggingface",
      `HF returned ${response.status}: ${await response.text().catch(() => "")}`
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "huggingface",
      "Failed to parse HF JSON response"
    );
  }

  // HF may return [number[]] or number[] depending on the model/endpoint.
  const vector: unknown =
    Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;

  if (!Array.isArray(vector) || vector.length === 0) {
    throw new AIProviderError(
      "EMPTY_RESPONSE",
      "huggingface",
      "HF returned an empty embedding"
    );
  }
  if (typeof vector[0] !== "number") {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "huggingface",
      "HF embedding is not a numeric vector"
    );
  }

  return vector as number[];
}

/**
 * Batch embedding generation — calls HF sequentially to stay within
 * free-tier rate limits. Each text is embedded independently; a
 * single failure does not abort the batch (the caller decides
 * whether a partial result is acceptable).
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingVector[]> {
  const results: EmbeddingVector[] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}

// -- Content hashing -----------------------------------------------------------

/** SHA-256 hex digest of the embedding input text. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// -- Embedding input text builders ---------------------------------------------

/**
 * Build the canonical embedding input for a volunteer.
 * Inputs: skills + interests + experience only (never location/availability).
 */
export function buildVolunteerEmbeddingText(input: {
  skills: string[];
  interests: string[];
  experience: string | null;
}): string {
  const skills = input.skills.join(", ");
  const interests = input.interests.join(", ");
  const experience = input.experience ?? "";
  return `Skills: ${skills}. Interests: ${interests}. Experience: ${experience}.`;
}

/**
 * Build the canonical embedding input for a project.
 * Inputs: title + category + description + required_skills + responsibilities
 * (never location, capacity, or status).
 */
export function buildProjectEmbeddingText(input: {
  title: string;
  category: string;
  description: string;
  required_skills: string[];
  responsibilities: string[];
}): string {
  const skills = input.required_skills.join(", ");
  const responsibilities = input.responsibilities.join(", ");
  return `Title: ${input.title}. Category: ${input.category}. Description: ${input.description}. Required skills: ${skills}. Responsibilities: ${responsibilities}`;
}

// -- Regeneration functions (called by services via fire-and-forget) -------------

/**
 * Generate/update the project embedding. Called by project.service after
 * create, content-changing update, and publish. Skips generation when the
 * content_hash matches (unchanged content).
 *
 * Fire-and-forget callers should catch errors — an embedding failure must
 * never fail the core project write.
 */
export async function regenerateProjectEmbedding(projectId: string): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "title, category, description, required_skills, responsibilities"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load project for embedding: ${error.message}`);
  }
  if (!data) {
    logger.warn("regenerateProjectEmbedding: project not found", { projectId });
    return;
  }

  const project = data as {
    title: string;
    category: string;
    description: string;
    required_skills: string[];
    responsibilities: string[];
  };
  const text = buildProjectEmbeddingText(project);
  const hash = contentHash(text);

  // Skip when content hasn't changed (existing row has the same hash).
  const { data: existing } = await supabase
    .from("project_embeddings")
    .select("content_hash")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing && (existing as { content_hash: string }).content_hash === hash) {
    logger.info("Project embedding skipped (content unchanged)", { projectId });
    return;
  }

  const embedding = await generateEmbedding(text);

  const { error: upsertError } = await supabase.from("project_embeddings").upsert(
    {
      project_id: projectId,
      embedding: JSON.stringify(embedding),
      content_hash: hash,
    },
    { onConflict: "project_id" }
  );
  if (upsertError) {
    throw new Error(`Failed to store project embedding: ${upsertError.message}`);
  }

  logger.info("Project embedding regenerated", {
    projectId,
    dimensions: embedding.length,
  });
}

/**
 * Generate/update the volunteer embedding. Called by volunteer.service after
 * profile create/update when skills, interests, or experience change.
 * Skips generation when the content_hash matches.
 *
 * Fire-and-forget callers should catch errors — an embedding failure must
 * never fail the core profile write.
 */
export async function regenerateVolunteerEmbedding(volunteerId: string): Promise<void> {
  const { data, error } = await supabase
    .from("volunteers")
    .select("skills, interests, experience")
    .eq("id", volunteerId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load volunteer for embedding: ${error.message}`);
  }
  if (!data) {
    logger.warn("regenerateVolunteerEmbedding: volunteer not found", { volunteerId });
    return;
  }

  const volunteer = data as {
    skills: string[];
    interests: string[];
    experience: string | null;
  };
  const text = buildVolunteerEmbeddingText(volunteer);
  const hash = contentHash(text);

  // Skip when content hasn't changed.
  const { data: existing } = await supabase
    .from("volunteer_embeddings")
    .select("content_hash")
    .eq("volunteer_id", volunteerId)
    .maybeSingle();
  if (existing && (existing as { content_hash: string }).content_hash === hash) {
    logger.info("Volunteer embedding skipped (content unchanged)", { volunteerId });
    return;
  }

  const embedding = await generateEmbedding(text);

  const { error: upsertError } = await supabase.from("volunteer_embeddings").upsert(
    {
      volunteer_id: volunteerId,
      embedding: JSON.stringify(embedding),
      content_hash: hash,
    },
    { onConflict: "volunteer_id" }
  );
  if (upsertError) {
    throw new Error(`Failed to store volunteer embedding: ${upsertError.message}`);
  }

  logger.info("Volunteer embedding regenerated", {
    volunteerId,
    dimensions: embedding.length,
  });
}
