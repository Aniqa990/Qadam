import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env";
import { errorMiddleware } from "./middleware/error.middleware";
import { notFoundMiddleware } from "./middleware/not-found.middleware";
import healthRoutes from "./routes/health.routes";

/**
 * Express app configuration. Route modules for auth/volunteer/ngo/etc. are
 * mounted here as they're built out in later phases - see
 * implementation-plan.md. Keep this file limited to wiring: middleware order
 * and route mounting, no business logic.
 */
export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json());

  app.use("/api/health", healthRoutes);

  // Future route modules mount here, e.g.:
  // app.use("/api/auth", authRoutes);
  // app.use("/api/volunteers", volunteerRoutes);
  // app.use("/api/ngos", ngoRoutes);
  // app.use("/api/projects", projectRoutes);
  // app.use("/api/registrations", registrationRoutes);
  // app.use("/api/matching", matchingRoutes);
  // app.use("/api/attendance", attendanceRoutes);
  // app.use("/api/ai", aiRoutes);
  // app.use("/api/knowledge", knowledgeRoutes);
  // app.use("/api/impact", impactRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
