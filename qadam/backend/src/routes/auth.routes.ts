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

/**
 * POST /api/auth/logout - behind auth so only logged-in users can call it.
 * The actual Clerk session teardown happens client-side; this just
 * provides a consistent API round-trip for the frontend.
 */
router.post("/logout", authMiddleware, authController.logout);

export default router;
