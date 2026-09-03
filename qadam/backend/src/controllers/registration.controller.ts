import type { NextFunction, Request, Response } from "express";
import type { RequestIdentity } from "../types/auth.types";
import type {
  CreateRegistrationBody,
  ListRegistrationsQuery,
} from "../validators/registration.validator";
import * as registrationService from "../services/registration.service";
import { AuthenticationError } from "../utils/errors";
import { sendPaginated, sendSuccess } from "../utils/response";

/**
 * Thin HTTP layer for /api/registrations (api-contracts.md "Registrations
 * Module"). Handlers read the resolved identity, hand validated data to
 * registration.service, and shape the response - no business logic here.
 */

function identity(req: Request): RequestIdentity {
  if (!req.identity) {
    throw new AuthenticationError();
  }
  return req.identity;
}

export async function createRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registrationService.register(
      identity(req),
      req.body as CreateRegistrationBody
    );
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function listRegistrations(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registrationService.listRegistrations(
      identity(req),
      req.query as unknown as ListRegistrationsQuery
    );
    return sendPaginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const registration = await registrationService.getRegistration(
      identity(req),
      req.params.id as string
    );
    return sendSuccess(res, registration);
  } catch (err) {
    next(err);
  }
}

export async function cancelRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registrationService.cancelRegistration(
      identity(req),
      req.params.id as string
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
