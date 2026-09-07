import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { establishRoleSchema } from "../validators/auth.validator";

const router = Router();

/**
 * Public: Clerk calls this server-to-server, authenticated by svix
 * signature rather than a user session. Must NOT sit behind authMiddleware.
 */
router.post("/webhook", authController.handleClerkWebhook);

/**
 * Protected but intentionally WITHOUT resolveUserMiddleware: a brand-new
 * signup may not have publicMetadata.role yet. getMe self-heals from
 * unsafeMetadata or returns status "pending_role" (200) instead of 401.
 */
router.get("/me", authMiddleware, authController.getMe);

/**
 * One-time role claim when SignUp did not include unsafeMetadata.role.
 * Only succeeds while publicMetadata.role is unset (or already matches).
 */
router.post(
  "/establish-role",
  authMiddleware,
  validate(establishRoleSchema),
  authController.establishRole
);

/**
 * POST /api/auth/logout - behind auth so only logged-in users can call it.
 * The actual Clerk session teardown happens client-side; this just
 * provides a consistent API round-trip for the frontend.
 */
router.post("/logout", authMiddleware, authController.logout);

export default router;
