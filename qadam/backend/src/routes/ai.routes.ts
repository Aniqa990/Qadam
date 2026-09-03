import { Router } from "express";
import * as aiController from "../controllers/ai.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { validate } from "../middleware/validate.middleware";
import { assistantChatSchema } from "../validators/ai.validator";

/**
 * AI routes — mounted at /api/ai (ai-architecture.md).
 *
 * POST /api/ai/assistant/chat — Global Knowledge Assistant (Surface 1).
 * Available to any authenticated user (volunteer or NGO). Role is
 * resolved server-side from the session; the same endpoint handles
 * both NGO RAG and volunteer public-data paths.
 */
const router = Router();

router.post(
  "/assistant/chat",
  authMiddleware,
  resolveUserMiddleware,
  validate(assistantChatSchema),
  aiController.chat
);

export default router;
