import type { ApiFetcher } from "./projects";

/**
 * Shape of the draft returned by POST /api/ai/copilot/draft
 * (api-contracts.md "AI Module"). Mirrors the backend's CopilotDraftSchema
 * in services/ai/copilot.service.ts - keep them in sync.
 */
export interface CopilotDraft {
  title: string;
  category: string;
  description: string;
  required_skills: string[];
  responsibilities: string[];
  eligibility: {
    min_age?: number;
    custom_requirements?: string[];
  };
  capacity: number;
}

/**
 * Calls POST /api/ai/copilot/draft with a short natural-language brief.
 * Never writes to the database - the returned draft is applied to the form
 * by the user explicitly (frontend-routes.md "/ngo/projects/new").
 */
export function generateCopilotDraft(api: ApiFetcher, brief: string): Promise<CopilotDraft> {
  return api<CopilotDraft>("/ai/copilot/draft", {
    method: "POST",
    body: JSON.stringify({ brief }),
  });
}
