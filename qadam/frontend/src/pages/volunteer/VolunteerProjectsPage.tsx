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
    <>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Opportunities you are signed up for.
            </p>
          </div>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            Browse opportunities
          </Link>
        </div>

        {/* Recommended projects (matching) */}
        <section aria-label="Recommended for you" className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Recommended for you</h2>
          </div>

          {loadingRecs && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-xl bg-muted"
                  aria-hidden="true"
                />
              ))}
            </div>
          )}

          {!loadingRecs && recommendations.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((match) => (
                <RecommendedProjectCard key={match.project_id} match={match} />
              ))}
            </div>
          )}

          {!loadingRecs && recommendations.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Complete your profile to get personalised project recommendations.
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="border-t" aria-hidden="true" />

        {error && <ErrorState message={error} onRetry={load} />}
        {!error && registrations === null && <LoadingState label="Loading your projects..." />}

        {!error && registrations !== null && (
          <>
            {confirmed.length === 0 ? (
              <EmptyState
                title="You have not joined any projects yet"
                description="Browse published opportunities and register for the ones that fit you."
                action={
                  <Link
                    to="/projects"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
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
      </main>
    </>
  );
}
