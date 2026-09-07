import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import MatchCard from "@/components/MatchCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { getProject } from "@/lib/projects";
import { getVolunteerMatches } from "@/lib/matching";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
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
    <main className={cn(ui.page, "space-y-6")}>
      <Link
        to="/ngo/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      {!error && matches === null && (
        <LoadingState label="Finding volunteer matches..." />
      )}

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && matches !== null && project && (
        <>
          <div>
            <h1 className={ui.sectionTitle}>Volunteer Matches</h1>
            <p className={cn(ui.sectionSub, "mt-1")}>{project.title}</p>
          </div>

          {matches.length === 0 ? (
            <EmptyState
              title="No volunteer matches yet"
              description="No volunteers currently match this project's requirements. Try adjusting the required skills or eligibility, or check back as more volunteers join the platform."
              action={
                <Link to={`/ngo/projects/${projectId}/edit`} className={ui.btnPrimary}>
                  Edit project
                </Link>
              }
            />
          ) : (
            <>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
                <Users className="h-4 w-4 text-emerald-600" />
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
