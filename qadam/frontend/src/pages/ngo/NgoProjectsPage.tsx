import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import ProjectCard from "@/components/ProjectCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { listProjects } from "@/lib/projects";
import { ui } from "@/lib/ui";
import type { PaginationInfo, ProjectStatus, ProjectSummary } from "@/types/project";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

const STATUS_FILTERS: { value: ProjectStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "draft", label: "Draft" },
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * frontend-routes.md "/ngo/projects" - the organization's own projects across
 * all statuses, filterable by lifecycle state (the backend role-scopes this
 * list and includes drafts for NGO callers).
 */
export default function NgoProjectsPage() {
  const { apiList } = useApi();
  const [status, setStatus] = useState<ProjectStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listProjects(apiList, { page, limit: PAGE_SIZE, status })
      .then((result) => {
        setProjects(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"));
  }, [apiList, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  function changeStatus(next: ProjectStatus | undefined) {
    setStatus(next);
    setPage(1); // a new filter always starts from the first page
  }

  return (
    <main className={cn(ui.page, "space-y-6")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={ui.sectionTitle}>My projects</h1>
          <p className={ui.sectionSub}>Manage drafts, live opportunities, and completed work.</p>
        </div>
        <Link to="/ngo/projects/new" className={ui.btnPrimary}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create project
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter projects by status">
        {STATUS_FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => changeStatus(filter.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && projects === null && <LoadingState label="Loading your projects..." />}

      {!error && projects !== null && pagination !== null && (
        <>
          {projects.length === 0 ? (
            status === undefined ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project to start recruiting volunteers."
                action={
                  <Link to="/ngo/projects/new" className={ui.btnPrimary}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create project
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title={`No ${status} projects`}
                description="Try a different status filter."
                action={
                  <button
                    type="button"
                    onClick={() => changeStatus(undefined)}
                    className={ui.btnSecondary}
                  >
                    Clear filter
                  </button>
                }
              />
            )
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {projects.map((project) => (
                  <div key={project.id} className="space-y-2">
                    <ProjectCard project={project} />
                    {(project.status === "upcoming" || project.status === "active") && (
                      <Link
                        to={`/ngo/matching/${project.id}`}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Find Matches
                      </Link>
                    )}
                  </div>
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                  <p className="text-slate-500">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total} projects
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                      className={cn(ui.btnSecondary, "text-sm disabled:cursor-not-allowed disabled:opacity-50")}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                      className={cn(ui.btnSecondary, "text-sm disabled:cursor-not-allowed disabled:opacity-50")}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
