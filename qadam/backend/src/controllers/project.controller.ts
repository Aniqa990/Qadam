import type { NextFunction, Request, Response } from "express";
import type { RequestIdentity } from "../types/auth.types";
import type { ProjectStatus } from "../types/project.types";
import type { CreateProjectBody, ListProjectsQuery, UpdateProjectBody } from "../validators/project.validator";
import * as projectService from "../services/project.service";
import { AuthenticationError } from "../utils/errors";
import { sendPaginated, sendSuccess } from "../utils/response";

/**
 * Thin HTTP layer for /api/projects (api-contracts.md "Projects Module").
 * Every handler reads the resolved identity, hands validated data to
 * project.service, and shapes the response - no business logic here.
 */

function identity(req: Request): RequestIdentity {
  if (!req.identity) {
    throw new AuthenticationError();
  }
  return req.identity;
}

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectService.listProjects(
      identity(req),
      req.query as unknown as ListProjectsQuery
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

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.getProject(identity(req), req.params.id as string);
    return sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectService.createProject(
      identity(req),
      req.body as CreateProjectBody
    );
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectService.updateProject(
      identity(req),
      req.params.id as string,
      req.body as UpdateProjectBody
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectService.deleteProject(identity(req), req.params.id as string);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

async function transition(req: Request, res: Response, next: NextFunction, target: ProjectStatus) {
  try {
    const result = await projectService.transitionProject(
      identity(req),
      req.params.id as string,
      target
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** Publishing a draft lists it publicly as "Upcoming" (volunteer-visible). */
export function publishProject(req: Request, res: Response, next: NextFunction) {
  return transition(req, res, next, "upcoming");
}

export function activateProject(req: Request, res: Response, next: NextFunction) {
  return transition(req, res, next, "active");
}

export function completeProject(req: Request, res: Response, next: NextFunction) {
  return transition(req, res, next, "completed");
}

export function cancelProject(req: Request, res: Response, next: NextFunction) {
  return transition(req, res, next, "cancelled");
}
