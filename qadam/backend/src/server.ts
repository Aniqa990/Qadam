import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Qadam backend listening on port ${env.PORT}`, {
    env: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
  });
});
