import { Router } from "express";
import * as registrationController from "../controllers/registration.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createRegistrationSchema,
  listRegistrationsQuerySchema,
  registrationIdParamsSchema,
} from "../validators/registration.validator";

const router = Router();

/**
 * Every registration route needs the full auth pipeline. Creating a
 * registration is volunteer-only; reads and cancels accept both roles and
 * are scoped/ownership-checked in registration.service (volunteers touch
 * only their own, NGOs only those on their own projects).
 */
router.use(authMiddleware, resolveUserMiddleware);

router.post(
  "/",
  requireRole("volunteer"),
  validate(createRegistrationSchema),
  registrationController.createRegistration
);

router.get(
  "/",
  validate(listRegistrationsQuerySchema, "query"),
  registrationController.listRegistrations
);

router.get(
  "/:id",
  validate(registrationIdParamsSchema, "params"),
  registrationController.getRegistration
);

router.put(
  "/:id/cancel",
  validate(registrationIdParamsSchema, "params"),
  registrationController.cancelRegistration
);

export default router;
