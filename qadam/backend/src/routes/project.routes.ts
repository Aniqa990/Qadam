import { Router } from "express";
import * as projectController from "../controllers/project.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  updateProjectSchema,
} from "../validators/project.validator";

const router = Router();

/**
 * Every project route needs the full auth pipeline - reads are role-scoped
 * (NGO sees own projects incl. drafts, volunteers see upcoming/active/
 * completed only) and writes are NGO-only plus ownership-checked in the
 * service.
 */
router.use(authMiddleware, resolveUserMiddleware);

// Reads - any authenticated role
router.get("/", validate(listProjectsQuerySchema, "query"), projectController.listProjects);
router.get("/:id", validate(projectIdParamsSchema, "params"), projectController.getProject);

// Writes - NGO only; ownership is enforced per-project in project.service
router.post(
  "/",
  requireRole("ngo"),
  validate(createProjectSchema),
  projectController.createProject
);
router.put(
  "/:id",
  requireRole("ngo"),
  validate(projectIdParamsSchema, "params"),
  validate(updateProjectSchema),
  projectController.updateProject
);
router.delete(
  "/:id",
  requireRole("ngo"),
  validate(projectIdParamsSchema, "params"),
  projectController.deleteProject
);

// Lifecycle transitions - NGO only, validated state machine in project.service
router.post(
  "/:id/publish",
  requireRole("ngo"),
  validate(projectIdParamsSchema, "params"),
  projectController.publishProject
);
router.post(
  "/:id/activate",
  requireRole("ngo"),
  validate(projectIdParamsSchema, "params"),
  projectController.activateProject
);
router.post(
  "/:id/complete",
  requireRole("ngo"),
  validate(projectIdParamsSchema, "params"),
  projectController.completeProject
);
router.post(
  "/:id/cancel",
  requireRole("ngo"),
  validate(projectIdParamsSchema, "params"),
  projectController.cancelProject
);

export default router;
