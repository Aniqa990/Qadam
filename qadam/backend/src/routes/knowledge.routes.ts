import { Router } from "express";
import multer from "multer";
import * as knowledgeController from "../controllers/knowledge.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";

const router = Router();

/**
 * Knowledge document routes - NGO-only by definition (the service also
 * double-checks the role). All routes require auth + user resolution.
 *
 * Multer is configured with memoryStorage so the file buffer is available
 * directly (no temp file). The 10 MB limit is enforced here and also by
 * the chk_knowledge_file_size DB constraint.
 */
router.use(authMiddleware, resolveUserMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, and TXT files are allowed"));
    }
  },
});

router.post(
  "/documents",
  requireRole("ngo"),
  upload.single("file"),
  knowledgeController.uploadDocument
);

router.get(
  "/documents",
  requireRole("ngo"),
  knowledgeController.listDocuments
);

router.delete(
  "/documents/:id",
  requireRole("ngo"),
  knowledgeController.deleteDocument
);

export default router;
