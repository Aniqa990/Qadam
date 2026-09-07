import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Sparkles } from "lucide-react";
import RecommendedProjectCard from "@/components/RecommendedProjectCard";
import RegistrationCard from "@/components/RegistrationCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { listRegistrations } from "@/lib/registrations";
import { getProjectRecommendations } from "@/lib/matching";
import type { RegistrationSummary } from "@/types/registration";
import type { ProjectMatch } from "@/types/matching";

/**
 * frontend-routes.md "/volunteer/projects" - the volunteer's home after
 * onboarding: their confirmed commitments plus a browse CTA. The
 * RecommendedProjects section joins in the matching phase; discovery itself
 * lives at /projects.
 */
export default function VolunteerProjectsPage() {
  const { api, apiList } = useApi();

  const [registrations, setRegistrations] = useState<RegistrationSummary[] | null>(null);
  const [recommendations, setRecommendations] = useState<ProjectMatch[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listRegistrations(apiList, { limit: 100 })
      .then((result) => setRegistrations(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load your projects"));

    // Recommendations load independently — never block the main list.
    setLoadingRecs(true);
    getProjectRecommendations(api, 10)
      .then((data) => setRecommendations(data))
      .catch(() => setRecommendations([]))
      .finally(() => setLoadingRecs(false));
  }, [api, apiList]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmed = (registrations ?? []).filter((r) => r.status === "confirmed");

  return (
    <main className="qadam-page space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="qadam-section-title">My projects</h1>
          <p className="qadam-section-sub mt-1.5">
            Opportunities you are signed up for.
          </p>
        </div>
        <Link to="/projects" className="qadam-btn-primary">
          <Compass className="h-4 w-4" aria-hidden="true" />
          Browse opportunities
        </Link>
      </div>

      {/* Recommended projects (matching) */}
      <section
        aria-label="Recommended for you"
        className="qadam-card space-y-5 overflow-hidden border-emerald-100/80 bg-gradient-to-br from-white via-white to-emerald-50/40 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Recommended for you
              </h2>
              <p className="text-xs text-slate-500">Matched to your skills and interests</p>
            </div>
          </div>
        </div>

        {loadingRecs && (
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-56 w-72 shrink-0 animate-pulse rounded-2xl bg-slate-100"
                aria-hidden="true"
              />
            ))}
          </div>
        )}

        {!loadingRecs && recommendations.length > 0 && (
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x snap-mandatory">
            {recommendations.map((match) => (
              <div key={match.project_id} className="w-72 shrink-0 snap-start sm:w-80">
                <RecommendedProjectCard match={match} />
              </div>
            ))}
          </div>
        )}

        {!loadingRecs && recommendations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
            Complete your profile to get personalised project recommendations.
          </div>
        )}
      </section>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">
          Your commitments
        </h2>

        {error && <ErrorState message={error} onRetry={load} />}
        {!error && registrations === null && <LoadingState label="Loading your projects..." />}

        {!error && registrations !== null && (
          <>
            {confirmed.length === 0 ? (
              <EmptyState
                title="You have not joined any projects yet"
                description="Browse published opportunities and register for the ones that fit you."
                action={
                  <Link to="/projects" className="qadam-btn-primary">
                    <Compass className="h-4 w-4" aria-hidden="true" />
                    Browse opportunities
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {confirmed.map((registration) => (
                  <RegistrationCard key={registration.id} registration={registration} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
