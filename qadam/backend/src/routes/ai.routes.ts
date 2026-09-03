import { Router } from "express";
import * as aiController from "../controllers/ai.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";
import { validate } from "../middleware/validate.middleware";
import { copilotDraftBodySchema } from "../validators/ai.validator";

const router = Router();

/**
 * All AI routes require the full auth pipeline: authenticate + resolve user +
 * role check. The copilot is NGO-only per api-contracts.md "POST /api/ai/
 * copilot/draft". The future POST /api/ai/assistant/chat (Phase 8) will use
 * any-role auth here as well.
 */
router.use(authMiddleware, resolveUserMiddleware);

router.post(
  "/copilot/draft",
  requireRole("ngo"),
  validate(copilotDraftBodySchema),
  aiController.copilotDraft
);

export default router;
