import { logger } from "../../utils/logger";

/**
 * STUB - the real pipeline lands with the matching phase (Phase 5):
 * build the project embedding input text (title + category + description +
 * required_skills + responsibilities - never location, capacity, or status,
 * see database-schema.md "project_embeddings"), call the Hugging Face
 * Inference API, and upsert into project_embeddings keyed by content_hash so
 * unchanged content is skipped.
 *
 * The signature is final: project.service already calls this after create,
 * content-changing updates, and publish, so the wiring is in place and the
 * real implementation only needs to replace this body.
 */
export async function regenerateProjectEmbedding(projectId: string): Promise<void> {
  logger.info("Project embedding regeneration requested (stub - no-op until the matching phase)", {
    projectId,
  });
}
