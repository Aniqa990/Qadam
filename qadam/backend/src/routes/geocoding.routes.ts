import { Router } from "express";
import * as geocodingController from "../controllers/geocoding.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { searchQuerySchema } from "../validators/geocoding.validator";

const router = Router();

/**
 * Geocoding routes (api-contracts.md "Geocoding Module"). Search is available
 * to any authenticated role (volunteers and NGOs both pick locations), and it
 * needs no role/profile resolution - authMiddleware alone is enough
 * (architecture.md "Request Lifecycle").
 */
router.get(
  "/search",
  authMiddleware,
  validate(searchQuerySchema, "query"),
  geocodingController.searchLocations
);

export default router;
