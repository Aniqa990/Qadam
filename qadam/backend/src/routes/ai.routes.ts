import { Router } from "express";
import * as aiController from "../controllers/ai.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { validate } from "../middleware/validate.middleware";
import { assistantChatSchema } from "../validators/ai.validator";
import { requireRole } from "../middleware/require-role.middleware";
import { copilotDraftBodySchema } from "../validators/ai.validator";


/**
 * AI routes — mounted at /api/ai (ai-architecture.md).
 *
 * POST /api/ai/assistant/chat — Global Knowledge Assistant (Surface 1).
 * Available to any authenticated user (volunteer or NGO). Role is
 * resolved server-side from the session; the same endpoint handles
 * both NGO RAG and volunteer public-data paths.
 */
const router = Router();

/**
 * All AI routes require the full auth pipeline: authenticate + resolve user +
 * role check. The copilot is NGO-only per api-contracts.md "POST /api/ai/
 * copilot/draft". The future POST /api/ai/assistant/chat (Phase 8) will use
 * any-role auth here as well.
 */
router.use(authMiddleware, resolveUserMiddleware);

router.post(
  "/assistant/chat",
  authMiddleware,
  resolveUserMiddleware,
  validate(assistantChatSchema),
  aiController.chat
);

router.post(
  "/copilot/draft",
  requireRole("ngo"),
  validate(copilotDraftBodySchema),
  aiController.copilotDraft
);

export default router;
