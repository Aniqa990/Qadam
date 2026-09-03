import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import NgoNav from "@/components/NgoNav";
import ProjectCard from "@/components/ProjectCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { listProjects } from "@/lib/projects";
import type { PaginationInfo, ProjectStatus, ProjectSummary } from "@/types/project";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

const STATUS_FILTERS: { value: ProjectStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
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
    <>
      <NgoNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">My projects</h1>
          <Link
            to="/ngo/projects/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create project
          </Link>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter projects by status">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() => changeStatus(filter.value)}
              aria-pressed={status === filter.value}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
                status === filter.value && "border-transparent bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {filter.label}
            </button>
          ))}
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
                    <Link
                      to="/ngo/projects/new"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
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
                      className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
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
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4 text-sm">
                    <p className="text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages} · {pagination.total} projects
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page <= 1}
                        className="rounded-md border border-input bg-background px-3 py-1.5 font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={pagination.page >= pagination.totalPages}
                        className="rounded-md border border-input bg-background px-3 py-1.5 font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
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
    </>
  );
}
