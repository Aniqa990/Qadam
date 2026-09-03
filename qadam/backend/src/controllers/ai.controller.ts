import type { Request, Response, NextFunction } from "express";
import { generateDraft } from "../services/ai/copilot.service";
import { sendSuccess } from "../utils/response";

/**
 * Thin controller for AI endpoints (architecture.md "Controllers must remain
 * thin"). Reads validated request data, calls the copilot service, and
 * returns the HTTP response. No business logic here - that lives in
 * services/ai/copilot.service.ts.
 */

export async function copilotDraft(req: Request, res: Response, next: NextFunction) {
  try {
    // req.body has been validated by validate(copilotDraftBodySchema) in the
    // route; the { brief } shape is guaranteed here.
    const { brief } = req.body as { brief: string };
    const draft = await generateDraft(brief);
    return sendSuccess(res, draft);
  } catch (err) {
    return next(err);
  }
}
