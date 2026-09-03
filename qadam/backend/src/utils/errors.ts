/**
 * Typed error classes -> HTTP status codes (see architecture.md "Error
 * Handling"). `code` is a stable machine-readable string surfaced in the
 * response envelope's `error.code` field per api-contracts.md, e.g.:
 *   { "success": false, "error": { "code": "NOT_FOUND", "message": "...", "details": [] } }
 * Frontend/tests should switch on `code`, never on `message` text.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  details?: unknown;
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflicting resource state") {
    super(message, 409, "CONFLICT");
  }
}

/**
 * Codes match ai-architecture.md's AIProviderError contract exactly
 * (TIMEOUT / RATE_LIMITED / MALFORMED_RESPONSE / EMPTY_RESPONSE / NETWORK_ERROR).
 * Thrown by services/ai/gemini.service.ts, qwen.service.ts, and
 * embedding.service.ts (Hugging Face); llm.service.ts catches this for
 * Gemini/Qwen fallback, while embedding.service callers log-and-continue
 * so an HF outage never blocks core writes.
 */
export type AIProviderErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "MALFORMED_RESPONSE"
  | "EMPTY_RESPONSE"
  | "NETWORK_ERROR";

export type AIProvider = "gemini" | "qwen" | "huggingface";

export class AIProviderError extends Error {
  code: AIProviderErrorCode;
  provider: AIProvider;
  constructor(code: AIProviderErrorCode, provider: AIProvider, message?: string) {
    super(message ?? `AI provider error (${provider}): ${code}`);
    this.name = "AIProviderError";
    this.code = code;
    this.provider = provider;
  }
}
