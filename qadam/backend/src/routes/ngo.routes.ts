import { Router } from "express";
import multer from "multer";
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

/**
 * Logo uploads accept a single small image (PNG/JPEG/WebP, 2 MB) kept in
 * memory - same multer pattern as the knowledge document upload. The
 * service re-validates type and size; mime filtering here fails fast.
 */
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPEG, and WebP images are allowed"));
    }
  },
});

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

router.post(
  "/profile/logo",
  requireRole("ngo"),
  logoUpload.single("file"),
  ngoController.uploadLogo
);

export default router;
