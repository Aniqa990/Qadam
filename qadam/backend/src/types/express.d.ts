import type { AuthContext, RequestIdentity } from "./auth.types";

// Augments Express's Request type so `req.auth` / `req.identity` are typed
// everywhere without controllers/services having to cast. Set by
// auth.middleware.ts and resolveUser.middleware.ts respectively.
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      identity?: RequestIdentity;
    }
  }
}

export {};
