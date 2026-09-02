import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ValidationError } from "../utils/errors";

type ValidateTarget = "body" | "query" | "params";

/**
 * Generic Zod validation middleware. Usage:
 *   router.post("/projects", validate(createProjectSchema), controller.create)
 * Validates req.body by default; pass { target: "query" | "params" } to
 * validate other parts of the request instead.
 */
export function validate(schema: ZodTypeAny, target: ValidateTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return next(new ValidationError("Invalid request data", result.error.flatten()));
    }
    req[target] = result.data;
    next();
  };
}
