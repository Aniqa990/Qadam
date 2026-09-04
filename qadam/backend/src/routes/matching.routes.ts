import { Router } from "express";
import * as matchingController from "../controllers/matching.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  matchingProjectParamsSchema,
  matchingQuerySchema,
} from "../validators/matching.validator";

const router = Router();

/**
 * GET /api/matching/projects             (Volunteer-only)
 * GET /api/matching/volunteers/:projectId (NGO-only)
 *
 * Both endpoints use the hybrid matching pipeline: deterministic filters
 * (status, capacity, eligibility, distance) → multi-factor scoring
 * (distance 0.35, skills 0.30, embedding 0.20, interests 0.15) →
 * ranking + explanation. Authorization is verified in the service.
 */
router.use(authMiddleware, resolveUserMiddleware);

router.get(
  "/projects",
  requireRole("volunteer"),
  validate(matchingQuerySchema, "query"),
  matchingController.getProjectRecommendations
);

router.get(
  "/volunteers/:projectId",
  requireRole("ngo"),
  validate(matchingProjectParamsSchema, "params"),
  validate(matchingQuerySchema, "query"),
  matchingController.getVolunteerMatches
);

export default router;
