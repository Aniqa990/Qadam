import { createApp } from "./app";
import { env } from "./config/env";
import { ensureStorageBucket } from "./services/knowledge.service";
import { logger } from "./utils/logger";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Qadam backend listening on port ${env.PORT}`, {
    env: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
  });
});

// Fire-and-forget: ensure the "knowledge" storage bucket exists.
// A failure here only logs a warning — the first document upload will
// surface a clearer error if the bucket is truly unavailable.
ensureStorageBucket();
