import type { NextFunction, Request, Response } from "express";
import * as ragService from "../services/ai/rag.service";
import { AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";
import { generateDraft } from "../services/ai/copilot.service";

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

/**
 * POST /api/ai/assistant/chat — thin controller for the Global Knowledge
 * Assistant (ai-architecture.md "Surface 1").
 *
 * Auth pipeline: authMiddleware → resolveUserMiddleware (both attached at
 * route level). Caller role and identity are read from req.identity —
 * never from a client-supplied flag.
 */
export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.identity) {
      throw new AuthenticationError();
    }

    const { message } = req.body as { message: string };

    const result = await ragService.chatAssistant(
      { role: req.identity.role, domainId: req.identity.domainId },
      message
    );

    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
