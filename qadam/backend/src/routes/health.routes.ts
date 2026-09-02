import { Router } from "express";
import { sendSuccess } from "../utils/response";

const router = Router();

/**
 * GET /api/health - liveness check with no auth/DB dependency, so it can be
 * used by uptime monitors and load balancers even if downstream services
 * (Supabase, Clerk, AI providers) are degraded.
 */
router.get("/", (_req, res) => {
  sendSuccess(res, {
    status: "ok",
    service: "qadam-backend",
    timestamp: new Date().toISOString(),
  });
});

export default router;
