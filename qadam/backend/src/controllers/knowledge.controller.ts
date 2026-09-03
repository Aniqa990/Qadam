import type { NextFunction, Request, Response } from "express";
import type { RequestIdentity } from "../types/auth.types";
import type { UploadedFile } from "../services/knowledge.service";
import * as knowledgeService from "../services/knowledge.service";
import { AppError, AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";

/**
 * Thin HTTP handlers for the knowledge document module. Controllers only read
 * validated request data, call the service, and shape the response - all
 * business logic and authorization live in knowledge.service.ts.
 */

function identity(req: Request): RequestIdentity {
  if (!req.identity) {
    throw new AuthenticationError();
  }
  return req.identity;
}

/**
 * POST /api/knowledge/documents
 *
 * Upload a document for RAG processing. Accepts multipart/form-data with
 * a single "file" field. Ingestion runs synchronously; the response
 * includes the final document status.
 */
export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const multerFile = req.file;
    if (!multerFile) {
      throw new AppError("No file provided", 400, "MISSING_FILE");
    }

    const file: UploadedFile = {
      buffer: multerFile.buffer,
      originalname: multerFile.originalname,
      mimetype: multerFile.mimetype,
      size: multerFile.size,
    };

    const result = await knowledgeService.uploadDocument(identity(req), file);
    return sendSuccess(res, {
      id: result.id,
      file_name: result.file_name,
      file_type: result.file_type,
      file_size: result.file_size,
      status: result.status,
    }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/knowledge/documents
 *
 * List all documents for the authenticated NGO.
 */
export async function listDocuments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await knowledgeService.listDocuments(identity(req));
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/knowledge/documents/:id
 *
 * Delete a document and all its chunks.
 */
export async function deleteDocument(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await knowledgeService.deleteDocument(
      identity(req),
      req.params.id!
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
