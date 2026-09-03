import { useState } from "react";
import { Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { generateCopilotDraft, type CopilotDraft } from "@/lib/copilot";
import type { ApiFetcher } from "@/lib/projects";

interface CopilotPanelProps {
  api: ApiFetcher;
  onApply: (draft: CopilotDraft) => void;
}

/**
 * Inline AI Copilot panel for the project create/edit flow
 * (frontend-routes.md "CopilotPanel"). Sends a short brief to
 * POST /api/ai/copilot/draft, displays the structured result, and lets the
 * NGO apply it to the form. Applying only populates fields - it never
 * submits or persists the project.
 */
export default function CopilotPanel({ api, onApply }: CopilotPanelProps) {
  const [brief, setBrief] = useState("");
  const [draft, setDraft] = useState<CopilotDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleGenerate() {
    if (!brief.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    setApplied(false);
    try {
      const result = await generateCopilotDraft(api, brief.trim());
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!draft) return;
    onApply(draft);
    setApplied(true);
  }

  return (
    <aside
      aria-label="AI Project Copilot"
      className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-primary">AI Project Copilot</h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Describe your project idea and let AI generate a professional draft. You can review and
        edit everything before saving.
      </p>

      <div className="space-y-2">
        <label htmlFor="copilot-brief" className="sr-only">
          Project idea
        </label>
        <textarea
          id="copilot-brief"
          value={brief}
          onChange={(e) => {
            setBrief(e.target.value);
            setApplied(false);
          }}
          placeholder="e.g. Weekend beach cleanup in Jeddah, 15 volunteers, focused on trash collection and environmental awareness"
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !brief.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Generating draft...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generate Project Draft
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {draft && (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">{draft.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                {draft.category.replace(/-/g, " ")} &middot; {draft.capacity} volunteers
              </p>
            </div>
            {applied ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Applied
              </span>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                className="shrink-0 rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                Apply to Form
              </button>
            )}
          </div>

          <p className="text-xs leading-relaxed text-foreground/80 line-clamp-4">
            {draft.description}
          </p>

          {draft.required_skills.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Skills</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {draft.required_skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.responsibilities.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Responsibilities</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-foreground/80">
                {draft.responsibilities.slice(0, 5).map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {draft.responsibilities.length > 5 && (
                  <li className="text-muted-foreground">
                    +{draft.responsibilities.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {(draft.eligibility.min_age != null ||
            (draft.eligibility.custom_requirements?.length ?? 0) > 0) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Eligibility</p>
              <ul className="mt-1 space-y-0.5 text-xs text-foreground/80">
                {draft.eligibility.min_age != null && (
                  <li>Minimum age: {draft.eligibility.min_age}</li>
                )}
                {draft.eligibility.custom_requirements?.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
