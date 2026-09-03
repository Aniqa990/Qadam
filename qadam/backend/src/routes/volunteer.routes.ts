import { Router } from "express";
import * as volunteerController from "../controllers/volunteer.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createVolunteerProfileSchema,
  updateVolunteerProfileSchema,
} from "../validators/volunteer.validator";

const router = Router();

/**
 * Volunteer profile routes - volunteer-only by definition (the service also
 * double-checks the role; authorization is never client-supplied). GET/POST
 * form the onboarding pair, PUT is the profile-edit path.
 */
router.use(authMiddleware, resolveUserMiddleware);

router.get("/profile", requireRole("volunteer"), volunteerController.getProfile);

router.post(
  "/profile",
  requireRole("volunteer"),
  validate(createVolunteerProfileSchema),
  volunteerController.createProfile
);

router.put(
  "/profile",
  requireRole("volunteer"),
  validate(updateVolunteerProfileSchema),
  volunteerController.updateProfile
);

export default router;
