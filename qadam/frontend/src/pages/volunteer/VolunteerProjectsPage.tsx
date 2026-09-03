import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import RegistrationCard from "@/components/RegistrationCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import VolunteerNav from "@/components/VolunteerNav";
import { useApi } from "@/hooks/useApi";
import { listRegistrations } from "@/lib/registrations";
import type { RegistrationSummary } from "@/types/registration";

/**
 * frontend-routes.md "/volunteer/projects" - the volunteer's home after
 * onboarding: their confirmed commitments plus a browse CTA. The
 * RecommendedProjects section joins in the matching phase; discovery itself
 * lives at /projects.
 */
export default function VolunteerProjectsPage() {
  const { apiList } = useApi();

  const [registrations, setRegistrations] = useState<RegistrationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listRegistrations(apiList, { limit: 100 })
      .then((result) => setRegistrations(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load your projects"));
  }, [apiList]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmed = (registrations ?? []).filter((r) => r.status === "confirmed");

  return (
    <>
      <VolunteerNav />
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
