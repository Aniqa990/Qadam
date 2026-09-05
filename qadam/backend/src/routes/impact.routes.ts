import { Router } from "express";
import * as impactController from "../controllers/impact.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";

const router = Router();

/**
 * Impact routes (api-contracts.md "Impact Module"). NGO-only; the service
 * scopes every metric to the NGO id resolved from the authenticated session,
 * never from the request. No request inputs, so there is no validator.
 */
router.use(authMiddleware, resolveUserMiddleware);

router.get("/ngo", requireRole("ngo"), impactController.getNgoImpact);

export default router;
