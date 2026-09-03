import { useCallback, useEffect, useState } from "react";
import ProjectCard from "@/components/ProjectCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { listProjects, PROJECT_CATEGORIES } from "@/lib/projects";
import type { PaginationInfo, ProjectSummary } from "@/types/project";

const PAGE_SIZE = 12;

/** Filter form state - applied to the API only on submit. */
interface FilterValues {
  search: string;
  category: string;
  skill: string;
  location: string;
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: FilterValues = {
  search: "",
  category: "",
  skill: "",
  location: "",
  date_from: "",
  date_to: "",
};

/** True when any filter has a non-empty value. */
function hasFilters(filters: FilterValues): boolean {
  return Object.values(filters).some((value) => value.trim() !== "");
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * frontend-routes.md "/projects" - browse projects. The backend scopes by
 * role: volunteers see published/active/completed opportunities; NGOs see
 * their own projects. Deterministic filters only (cause, skill, date
 * window, location) - semantic matching arrives with the matching phase.
 */
export default function BrowseProjectsPage() {
  const { apiList } = useApi();

  const [draft, setDraft] = useState<FilterValues>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listProjects(apiList, {
      page,
      limit: PAGE_SIZE,
      search: applied.search.trim() || undefined,
      category: applied.category || undefined,
      skill: applied.skill.trim() || undefined,
      location: applied.location.trim() || undefined,
      date_from: applied.date_from || undefined,
      date_to: applied.date_to || undefined,
    })
      .then((result) => {
        setProjects(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"));
  }, [apiList, page, applied]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setApplied({ ...draft });
    setPage(1); // a new filter set always starts from the first page
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">Browse projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find opportunities that match your cause, skills, schedule, and city.
          </p>
        </div>

        {/* Filters - deterministic discovery, no AI ranking yet */}
        <form onSubmit={applyFilters} className="space-y-3 rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Search</span>
              <input
                type="search"
                value={draft.search}
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                placeholder="Title or description"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Cause</span>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className={inputClass}
              >
                <option value="">All causes</option>
                {PROJECT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Skill</span>
              <input
                type="text"
                value={draft.skill}
                onChange={(e) => setDraft({ ...draft, skill: e.target.value })}
                placeholder="e.g. teaching"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Location</span>
              <input
                type="text"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="City or country"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">From date</span>
              <input
                type="date"
                value={draft.date_from}
                onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">To date</span>
              <input
                type="date"
                value={draft.date_to}
                onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Clear
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Apply filters
            </button>
          </div>
        </form>

        {error && <ErrorState message={error} onRetry={load} />}
        {!error && projects === null && <LoadingState label="Loading projects..." />}

        {!error && projects !== null && pagination !== null && (
          <>
            {projects.length === 0 ? (
              hasFilters(applied) ? (
                <EmptyState
                  title="No projects match your filters"
                  description="Try widening the date range or clearing some filters."
                  action={
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  title="No projects yet"
                  description="Organizations haven't published any opportunities yet. Check back soon."
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
