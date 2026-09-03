import type { NextFunction, Request, Response } from "express";
import * as ragService from "../services/ai/rag.service";
import { AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";

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
