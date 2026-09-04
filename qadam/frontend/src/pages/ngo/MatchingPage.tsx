import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import MatchCard from "@/components/MatchCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { getProject } from "@/lib/projects";
import { getVolunteerMatches } from "@/lib/matching";
import type { ProjectDetail } from "@/types/project";
import type { VolunteerMatch } from "@/types/matching";

/**
 * frontend-routes.md "/ngo/matching/:projectId" — ranked list of volunteer
 * matches for a specific project. NGO-only; the backend verifies project
 * ownership. Displays composite score + per-factor breakdown for each
 * volunteer (AGENTS.md "Matching" weights: distance 0.50, skills 0.30,
 * embedding 0.20).
 */
export default function MatchingPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { api } = useApi();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [matches, setMatches] = useState<VolunteerMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!projectId) return;
    setError(null);

    Promise.all([
      getProject(api, projectId),
      getVolunteerMatches(api, projectId, 20),
    ])
      .then(([proj, vols]) => {
        setProject(proj);
        setMatches(vols);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load matches")
      );
  }, [api, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Back link */}
      <Link
        to="/ngo/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      {/* Loading */}
      {!error && matches === null && (
        <LoadingState label="Finding volunteer matches..." />
      )}

      {/* Error */}
      {error && <ErrorState message={error} onRetry={load} />}

      {/* Loaded */}
      {!error && matches !== null && project && (
        <>
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold">Volunteer Matches</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.title}
            </p>
          </div>

          {/* Match results */}
          {matches.length === 0 ? (
            <EmptyState
              title="No volunteer matches yet"
              description="No volunteers currently match this project's requirements. Try adjusting the required skills or eligibility, or check back as more volunteers join the platform."
              action={
                <Link
                  to={`/ngo/projects/${projectId}/edit`}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Edit project
                </Link>
              }
            />
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {matches.length} volunteer{matches.length !== 1 ? "s" : ""} ranked by match quality
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {matches.map((match, idx) => (
                  <MatchCard
                    key={match.volunteer_id}
                    match={match}
                    rank={idx + 1}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
