import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import ProjectCard from "@/components/ProjectCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { listProjects } from "@/lib/projects";
import type { ProjectSummary } from "@/types/project";

/**
 * frontend-routes.md "/ngo/dashboard" - overview of the organization's
 * projects with quick stats and a shortcut into project management. Recent
 * registrations join in Phase 5 once the registrations module exists.
 */
export default function NgoDashboardPage() {
  const { apiList } = useApi();
  const { profile } = useAuth();
  const orgName = (profile as { name?: string } | null)?.name ?? "Your organization";

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    // One page is plenty for an NGO's MVP portfolio; `total` stays exact.
    listProjects(apiList, { limit: 100 })
      .then((result) => {
        setProjects(result.data);
        setTotal(result.pagination.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"));
  }, [apiList]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{orgName}</p>
          </div>
          <Link
            to="/ngo/projects/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create project
          </Link>
        </div>

        {error && <ErrorState message={error} onRetry={load} />}
        {!error && projects === null && <LoadingState label="Loading your projects..." />}

        {!error && projects !== null && (
          <>
            <section aria-label="Project statistics" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Total projects" value={total} />
              <StatCard
                label="Live"
                value={projects.filter((p) => p.status === "upcoming" || p.status === "active").length}
              />
              <StatCard label="Drafts" value={projects.filter((p) => p.status === "draft").length} />
              <StatCard
                label="Volunteers registered"
                value={projects.reduce((sum, p) => sum + p.registered_count, 0)}
              />
            </section>

            <section aria-label="Your projects" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your projects</h2>
                <Link to="/ngo/projects" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>

              {projects.length === 0 ? (
                <EmptyState
                  title="No projects yet"
                  description="Create your first project to start recruiting volunteers. You can save it as a draft and publish it whenever you're ready."
                  action={
                    <Link
                      to="/ngo/projects/new"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Create your first project
                    </Link>
                  }
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {projects.slice(0, 4).map((project) => (
                    <div key={project.id} className="space-y-2">
                      <ProjectCard project={project} />
                      {(project.status === "upcoming" || project.status === "active") && (
                        <Link
                          to={`/ngo/matching/${project.id}`}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Find Matches
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
