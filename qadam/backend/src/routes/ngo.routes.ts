import { Router } from "express";
import * as ngoController from "../controllers/ngo.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";
import { validate } from "../middleware/validate.middleware";
import { createNgoProfileSchema, updateNgoProfileSchema } from "../validators/ngo.validator";

const router = Router();

/**
 * NGO profile routes - NGO-only by definition (the service also double-checks
 * the role; authorization is never client-supplied). GET/POST form the
 * onboarding pair, PUT is the profile-edit path.
 */
router.use(authMiddleware, resolveUserMiddleware);

router.get("/profile", requireRole("ngo"), ngoController.getProfile);

router.post(
  "/profile",
  requireRole("ngo"),
  validate(createNgoProfileSchema),
  ngoController.createProfile
);

router.put(
  "/profile",
  requireRole("ngo"),
  validate(updateNgoProfileSchema),
  ngoController.updateProfile
);

export default router;
