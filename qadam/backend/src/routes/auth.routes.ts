import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";

const router = Router();

/**
 * Public: Clerk calls this server-to-server, authenticated by svix
 * signature rather than a user session. Must NOT sit behind authMiddleware.
 */
router.post("/webhook", authController.handleClerkWebhook);

/**
 * Protected: standard pipeline from architecture.md - authenticate the
 * Clerk session, then resolve it to a volunteer/ngo identity.
 */
router.get("/me", authMiddleware, resolveUserMiddleware, authController.getMe);

export default router;
